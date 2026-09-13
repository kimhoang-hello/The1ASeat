/**
 * Kiểu dùng chung của lớp engine (Phase 3).
 *
 * TÁCH KHỎI `types.ts` vì hai lớp trả lời hai câu khác nhau: `types.ts` mô tả
 * THẾ GIỚI (sản phẩm, offer, chương trình điểm), còn file này mô tả một LƯỢT
 * SUY LUẬN về thế giới đó. Trộn lại thì lớp dữ liệu bắt đầu biết về điểm số,
 * và ranh giới "dữ liệu không mã hoá kết quả" — thứ giữ cho engine tất định —
 * mất chỗ để đứng.
 *
 * Và tách khỏi từng module engine vì `portfolio → needs → scoring → rules →
 * rank` là một dây chuyền: mỗi tầng đọc đầu ra của tầng trước. Nếu kiểu nằm ở
 * module sinh ra nó thì `rank.ts` phải import cả năm module để mô tả đầu vào
 * của mình, và bất kỳ vòng import nào cũng thành lỗi lúc chạy dưới ESM.
 */

import type { ReasonCode, StrategyType, WarningCode } from "./reason-codes.ts";
import type {
  AwardStrategy,
  DataGap,
  Offer,
  OfferComponent,
  PointsProgramId,
  Product,
  ProductId,
} from "./types.ts";
import type { Goal, GoalId, GoalType, UserDataGap } from "./user-types.ts";
import type { ResolvedTripGoal } from "./user.ts";
// Chỉ KIỂU, nên vòng import này bị xoá khi biên dịch — xem chú thích đầu file.
import type { OfferClimate, OfferFacts } from "./offer-quality.ts";
import type { EarnFit } from "./earn-fit.ts";
import type { BenefitFit } from "./benefit-fit.ts";
import type { ScoringScale } from "./scoring/context.ts";
import type { TripCoverage } from "./strategies.ts";
import type { GapProbe } from "./sensitivity.ts";

/* ------------------------------------------------------------------ *
 * §7 Portfolio Analyzer
 * ------------------------------------------------------------------ */

/**
 * Số dư của MỘT chương trình, ba trạng thái chứ không phải một con số.
 *
 * `absent` = không có dòng nào (không có tài khoản).
 * `unknown` = có dòng, `balance: null` (có tài khoản, không nhớ số dư).
 * `known` = có con số.
 *
 * Đây là luật trống-≠-bằng-không ở MỨC DÒNG của Phase 2, mang nguyên vào
 * engine. Ép về `number` với `?? 0` ở biên giới này là chỗ nó chết: một người
 * có tài khoản Aeroplan® không nhớ số dư sẽ được engine kết luận là có 0 điểm,
 * rồi khuyên mở thêm thẻ để "xây từ đầu".
 */
export type BalanceKnowledge =
  | { kind: "absent" }
  | { kind: "unknown" }
  | { kind: "known"; points: number };

/**
 * Điểm với tới được một chương trình đích, và ĐI QUA ĐÂU.
 *
 * `viaTransfer` là TIỀM NĂNG, không phải số dư. Nó chỉ có nghĩa khi xét MỘT
 * chương trình đích một lần — cộng `accessible` của nhiều chương trình lại là
 * đúng lỗi §7 cấm. Vì vậy trường `sources` phải có mặt: nó nói ra đồng điểm
 * này đến từ đâu, nên hai chương trình cùng nhận từ một nguồn nhìn thấy được
 * là chúng đang tranh nhau CÙNG một đồng.
 */
export interface AccessibleBalance {
  programId: PointsProgramId;
  /** Số dư nằm SẴN trong chính chương trình này. */
  direct: number;
  /** Thêm được nếu chuyển hết mọi nguồn linh hoạt về đây. */
  viaTransfer: number;
  /** Tổng = direct + viaTransfer. Chỉ dùng cho MỘT đích tại một thời điểm. */
  total: number;
  /** Các chương trình nguồn đã góp vào `viaTransfer`, đã sắp theo id. */
  sources: PointsProgramId[];
  /** Có nguồn nào số dư chưa biết không — `total` khi đó là cận DƯỚI. */
  hasUnknownSource: boolean;
}

/**
 * Tỷ trọng của một hệ sinh thái trong danh mục.
 *
 * `share` tính trên GIÁ TRỊ (điểm × định giá), không trên số điểm: 100,000
 * Bonvoy® và 100,000 Aeroplan® không phải hai lượng bằng nhau, và một danh
 * mục "70% Bonvoy®" đo bằng số điểm có thể chỉ là 40% giá trị.
 */
export interface EcosystemExposure {
  ecosystem: string;
  share: number;
  valueCents: number;
}

export interface PortfolioAnalysis {
  /** Số dư người dùng thực sự khai, theo chương trình. */
  direct: Map<PointsProgramId, BalanceKnowledge>;
  /** Tổng giá trị (cent) của phần số dư ĐÃ BIẾT. */
  knownValueCents: number;
  /** Có ít nhất một dòng số dư `null`, nên mọi tổng là cận DƯỚI. */
  hasUnknownBalance: boolean;
  /** `declared.balances === false`: mảng rỗng KHÔNG phải "không có điểm". */
  balancesUndeclared: boolean;
  cardsUndeclared: boolean;
  /** Tập trung theo hệ sinh thái, đã sắp giảm dần rồi theo tên. §16 Rule 3. */
  concentration: EcosystemExposure[];
  /** Tỷ trọng giá trị nằm ở chương trình chuyển được. 0..1. */
  flexibilityScore: number;
  /** Chương trình các thẻ ĐANG GIỮ kiếm ra. */
  earnedPrograms: Set<PointsProgramId>;
  heldProducts: Product[];
}

/* ------------------------------------------------------------------ *
 * Chuyến đi (§6, §5.1 bàn giao)
 * ------------------------------------------------------------------ */

/**
 * Số điểm một chuyến đi cần — một KHOẢNG, và ba thừa số phải nhân đủ.
 *
 * `perPassengerOneWay` giữ lại con số gốc của `AwardStrategy` đúng như nó
 * được khai (một chiều, một người) để lời giải thích không phải nhân ngược
 * lại. `low/typical/high` là con số ĐÃ nhân đủ ba thừa số.
 *
 * `assumedPassengers` / `assumedRoundTrip` là `null` khi người dùng chưa nói —
 * và khi đó `low/typical/high` cũng `null`. KHÔNG mặc định: mặc định 1 người
 * chia ba số điểm của một gia đình, mặc định một chiều chia đôi, và cả hai sai
 * về hướng làm `NO_NEW_CARD` thắng nhờ một giả định.
 */
/** Khoảng điểm của MỘT chương trình, đã nhân đủ ba thừa số. */
export interface TripNeedByProgram {
  programId: PointsProgramId;
  perPassengerOneWayLow: number | null;
  perPassengerOneWayTypical: number | null;
  perPassengerOneWayHigh: number | null;
  /** Sàn động thấp nhất, một chiều một người — xem `floor`. */
  perPassengerOneWayFloor: number | null;
  low: number | null;
  typical: number | null;
  high: number | null;
  /**
   * Sàn THẤP NHẤT của các chiến lược `dynamic_floor` của chương trình này, đã
   * nhân đủ thừa số — `null` khi nó không có chiến lược định giá động nào.
   *
   * Tách khỏi `low` vì hai con số nói hai chuyện: `low` của bảng giá cố định
   * là mức rẻ nhất của một bảng ĐÃ BIẾT, còn sàn động là mức giá CÓ THỂ rẻ tới
   * mà không ai hứa. Một chương trình có cả hai (bảng cố định trần 230,000 và
   * sàn động 50,000) thì 100,000 điểm phủ CHẮC 43% và CÓ THỂ tới 100% — gộp
   * vào `low` là mất hẳn nửa sau (vòng Codex 7).
   */
  floor: number | null;
}

export interface TripNeed {
  strategies: AwardStrategy[];
  /** Chương trình định giá được chặng này, đã sắp theo id. */
  programs: PointsProgramId[];
  /**
   * Khoảng của TỪNG chương trình, giữ riêng — dùng cho mọi phép PHỦ.
   *
   * `low/typical/high` bên dưới là khoảng GỘP, chỉ để trình bày "chuyến này
   * tốn khoảng bao nhiêu". Đừng đem số dư đi so với nó: nó trộn mức thấp của
   * chương trình này với mức cao của chương trình kia, nên nó là một khoảng
   * không ai bán.
   */
  byProgram: TripNeedByProgram[];
  perPassengerOneWayLow: number | null;
  perPassengerOneWayTypical: number | null;
  perPassengerOneWayHigh: number | null;
  low: number | null;
  typical: number | null;
  high: number | null;
  passengers: number | null;
  roundTrip: boolean | null;
  /** Mọi chiến lược tra được đều là `dynamic_floor`: chỉ có mức SÀN. */
  floorOnly: boolean;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
}

/* ------------------------------------------------------------------ *
 * §9 Needs Engine
 * ------------------------------------------------------------------ */

/** 0 = không liên quan, 1 = cực kỳ hữu ích (§9). */
export interface Needs {
  currency: Map<PointsProgramId, number>;
  /** Khoá là `BenefitId`. */
  benefit: Map<string, number>;
  portfolio: { diversification: number; flexibility: number };
  action: { newCard: number };
}

/* ------------------------------------------------------------------ *
 * §8 Strategy Generator
 * ------------------------------------------------------------------ */

export interface StrategyScore {
  strategy: StrategyType;
  score: number;
  reasonCodes: ReasonCode[];
}

/* ------------------------------------------------------------------ *
 * §14 Eligibility ≠ Suitability
 * ------------------------------------------------------------------ */

/**
 * BA kết quả, không phải hai.
 *
 * `unknown` là vế bắt buộc: thu nhập khai "60–80K" so với ngưỡng $80,000 là
 * `straddles` (§5.3 bàn giao), và một mô hình hai giá trị phải chọn giữa loại
 * oan và nhận bừa. Cả hai đều sai; `unknown` là câu trả lời đúng, và nó còn
 * sinh ra được một câu hỏi tiếp theo cho §30.
 */
export type EligibilityStatus = "eligible" | "ineligible" | "unknown";

/**
 * Kết quả của TỪNG luật, kể cả luật không chặn.
 *
 * `failedRuleIds` chỉ kể nhóm đầu tiên làm thẻ trượt, vì phán quyết dừng ở
 * đó. Admin hỏi "vì sao thẻ X bị loại" thì cần thấy CẢ bảng: luật nào qua,
 * luật nào trượt, luật nào chưa đánh giá được — và luật `soft` trượt cũng phải
 * hiện, vì nó là thứ ngân hàng có thể vẫn áp dụng. Đặt dữ kiện của luật (loại,
 * phép so, ngưỡng) cạnh kết quả để phân biệt được lỗi ở DỮ LIỆU LUẬT với lỗi ở
 * CÂU TRẢ LỜI CỦA NGƯỜI DÙNG mà không phải mở thêm file nào.
 */
export interface EligibilityRuleTrace {
  ruleId: string;
  ruleType: string;
  operator: string;
  value: number | string | string[] | boolean;
  severity: "hard" | "soft" | "unknown";
  scope: "application" | "welcome_offer";
  ruleGroup: string | null;
  outcome: "pass" | "fail" | "unknown";
}

export interface EligibilityVerdict {
  status: EligibilityStatus;
  /** Được mở thẻ, nhưng KHÔNG được welcome bonus (Amex® once-in-a-lifetime). */
  welcomeOfferBlocked: boolean;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
  /** Luật đã chặn, để debugger của Phase 4 chỉ đúng dòng. */
  failedRuleIds: string[];
  unknownRuleIds: string[];
  /** Mọi luật đang hiệu lực của thẻ, đã sắp theo id — xem `EligibilityRuleTrace`. */
  rules: EligibilityRuleTrace[];
}

export interface SuitabilityVerdict {
  /** Người dùng đã nói KHÔNG với loại thẻ này — lọc, không phải phạt điểm. */
  excluded: boolean;
  excludedReason: string | null;
  /** Hệ số nhân lên điểm cuối, 0..1. 1 = không có gì chống lại. */
  penalty: number;
  /** §13 — 0..1, `null` khi chưa biết sức dồn. */
  minSpendFit: number | null;
  firstYearFee: number | null;
  ongoingFee: number | null;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
}

/* ------------------------------------------------------------------ *
 * §19 Explainability
 * ------------------------------------------------------------------ */

/**
 * Tên thành phần điểm — từ vựng ĐÓNG, cùng lý do với mã lý do.
 *
 * §10 cố ý dùng bộ thành phần KHÁC NHAU cho từng loại mục tiêu, nên union này
 * là hợp của bốn bảng. Điều đó đúng: một `Record` phẳng với đủ mọi thành phần
 * sẽ buộc mỗi hàm chấm điểm điền 0 cho những thành phần nó không dùng, và
 * bảng giải thích của §19 sẽ hiện ra sáu dòng bằng 0 cho mọi thẻ.
 */
export const SCORE_COMPONENT_KEYS = [
  "offer_quality",
  "spend_fit",
  "long_term_earn_fit",
  "currency_fit",
  "benefits_fit",
  "diversification",
  "trip_currency_utility",
  "points_gap_reduction",
  "flexibility_value",
  "travel_benefits",
  "new_currency_exposure",
  "transfer_flexibility",
  "fee_drag",
  "editorial",
  /* NO_NEW_CARD dùng bảng riêng — xem `rank.ts`. */
  "points_already_sufficient",
  "portfolio_already_covers",
  "no_reachable_candidate",
  "offer_climate_weak",
] as const;

export type ScoreComponentKey = (typeof SCORE_COMPONENT_KEYS)[number];

/**
 * Một dòng của bảng "vì sao thẻ này thắng" (§19).
 *
 * `weight` là con số ĐÚNG NHƯ §10 viết, không phải con số đã chuẩn hoá. Bốn
 * bảng của §10 cộng lại 100% KỂ CẢ 5% editorial, mà §15 (editorial_rules) cố
 * ý chưa làm — nên nếu chia luôn 0.95 vào đây thì bảng in ra 26.3% ở chỗ spec
 * viết 25%, và mọi lần đối chiếu về sau đều phải giải thích lại. Phép chuẩn
 * hoá nằm ở `scoring/weights.ts`, một chỗ, có tên.
 */
export interface ScoreComponent {
  key: ScoreComponentKey;
  /** Trọng số theo §10, chưa chuẩn hoá. */
  weight: number;
  /** Giá trị thô của thành phần, 0..1. */
  raw: number;
  /** `weight × raw`. */
  contribution: number;
  /** Vì sao `raw` ra con số đó — dành cho debugger §22, không cho người đọc. */
  note: string;
}

/**
 * Tầng sinh ra một điều chỉnh.
 *
 * Tường minh chứ không suy từ tiền tố tên luật: debugger dùng nó để trả lời
 * "khuyến nghị sai này đến từ LUẬT §16, từ PHÙ HỢP §14, từ ĐIỀU KIỆN §14 hay
 * từ BIÊN TẬP §17" — bốn chỗ sửa khác nhau, bốn người chịu trách nhiệm khác
 * nhau. Một quy ước đặt tên thì gãy lặng lẽ ngay lần đầu có người đặt tên lệch.
 */
export type AdjustmentLayer = "rules" | "suitability" | "eligibility" | "editorial";

/** Một lần điểm bị đổi SAU khi chấm (§16 rules, §17 editorial). */
export interface ScoreAdjustment {
  rule: string;
  layer: AdjustmentLayer;
  /** Cộng vào điểm cuối. Âm là phạt. */
  delta: number;
  reasonCode: ReasonCode | null;
}

/* ------------------------------------------------------------------ *
 * Ứng viên và kết quả (§18)
 * ------------------------------------------------------------------ */

export type CandidateKind = "open_card" | "no_new_card";

export interface Candidate {
  kind: CandidateKind;
  productId: ProductId | null;
  productSlug: string | null;
  productName: string | null;
  /** Điểm sau MỌI điều chỉnh, 0..1. */
  score: number;
  /** Điểm từ các thành phần của §10, trước §16/§17. */
  baseScore: number;
  components: ScoreComponent[];
  adjustments: ScoreAdjustment[];
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
  eligibility: EligibilityVerdict | null;
  suitability: SuitabilityVerdict | null;
}

export interface RecommendationNumbers {
  tripNeedLow: number | null;
  tripNeedTypical: number | null;
  tripNeedHigh: number | null;
  directPoints: number | null;
  accessiblePoints: number | null;
  /**
   * `accessiblePoints` là CẬN DƯỚI, không phải con số chắc chắn.
   *
   * Bật khi có ít nhất một dòng số dư `null` ở một chương trình định giá được
   * chặng — người dùng có tài khoản nhưng không nhớ số dư. Không có cờ này thì
   * "0 điểm tiếp cận được" của một người có tài khoản Aeroplan® đọc y hệt "0
   * điểm" của một người chưa từng mở tài khoản nào, và Phase 5/6 sẽ viết ra
   * hai câu giống nhau cho hai tình huống khác hẳn.
   */
  accessiblePointsIsLowerBound: boolean;
  pointsGapTypical: number | null;
  topEcosystemShare: number | null;
  flexibilityScore: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

/** §29 — bốn nguồn spec nêu đích danh, giữ nguyên bốn để §22 truy được. */
export interface ConfidenceFactors {
  dataCompleteness: number;
  dataFreshness: number;
  goalSpecificity: number;
  scoreSeparation: number;
  level: ConfidenceLevel;
  notes: string[];
}

/** §30 — câu hỏi tiếp theo đáng giá nhất, hoặc `null` khi không còn câu nào đổi được kết quả. */
export interface FollowUpQuestion {
  /** `UserDataGap["kind"]` — giữ nguyên từ vựng Phase 2 thay vì bịa bộ mới. */
  gapKind: UserDataGap["kind"];
  subject: string;
  /** Vì sao câu này đáng hỏi HÔM NAY, với chính hồ sơ này. */
  reason: string;
}

export interface Recommendation {
  goalId: GoalId | null;
  goalType: GoalType;
  strategy: StrategyScore;
  /** Mọi hành động đã cân nhắc, đã sắp giảm dần (§8). */
  strategies: StrategyScore[];
  primaryAction: Candidate;
  alternatives: Candidate[];
  /** LUÔN có mặt, kể cả khi nó không thắng (§16 Rule 8). */
  noAction: Candidate;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
  numbers: RecommendationNumbers;
  confidence: ConfidenceFactors;
}

/** Một lượt chạy. Nhiều kết quả CHỈ khi mục tiêu hoà nhau (§30 / `primaryGoal`). */
export interface RecommendationRun {
  engineVersion: string;
  /** Version bộ luật BIÊN TẬP (§15/§17) — xem `RULE_VERSION` ở `rules.ts`. */
  ruleVersion: string;
  asOf: string;
  goalResolution: "none" | "resolved" | "ambiguous";
  results: Recommendation[];
  followUp: FollowUpQuestion | null;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
  /** Chỗ trống của lớp dữ liệu mà lượt chạy này thật sự chạm vào. */
  dataGaps: DataGap[];
  userGaps: UserDataGap[];
  /**
   * Mọi thứ engine TÍNH RA giữa đầu vào và đầu ra — `derived_state` của §20.
   *
   * Engine Phase 3 đã tính đủ cả ba thứ §22 đòi (danh mục, nhu cầu, thẻ bị
   * loại) rồi vứt đi, nên câu admin hỏi nhiều nhất — "vì sao thẻ X không hiện
   * ra" — không có câu trả lời. Giữ lại ở đây thì không phải tính lại, và quan
   * trọng hơn: không thể tính lại KHÁC đi.
   */
  derived: DerivedState;
}

/* ------------------------------------------------------------------ *
 * §20 derived_state + §22 Recommendation Debugger
 *
 * Mọi kiểu dưới đây phải đi qua JSON nguyên vẹn: chúng được LƯU (§20), và một
 * `Map` hay `Set` ở đây thành `{}` khi ghi xuống — im lặng, và lượt chạy lưu
 * lại không còn giải thích được chính nó. Nên không có `Map`, không có `Set`,
 * không có `undefined` có nghĩa; mọi danh sách đều đã sắp theo khoá cố định.
 * ------------------------------------------------------------------ */

/**
 * Vì sao một sản phẩm không vào nổi tập ứng viên — bốn cửa của
 * `candidateUniverse`, theo đúng thứ tự nó kiểm.
 */
export type UniverseExclusionReason =
  | "not_credit_card"
  | "other_country"
  | "not_available"
  | "already_held";

/**
 * Một sản phẩm KHÔNG được chấm điểm, và cửa nào đã chặn nó.
 *
 * Ba tầng, ba người chịu trách nhiệm khác nhau (§14): `universe` là dữ liệu
 * sản phẩm hoặc §16 Rule 5, `suitability` là câu trả lời của người dùng,
 * `eligibility` là luật của ngân hàng.
 */
export interface ExcludedProduct {
  productId: ProductId;
  productSlug: string;
  productName: string;
  stage: "universe" | "suitability" | "eligibility";
  /** `UniverseExclusionReason`, `SuitabilityVerdict.excludedReason`, hoặc `"ineligible"`. */
  reason: string;
  failedRuleIds: string[];
}

export interface PortfolioSnapshot {
  direct: { programId: PointsProgramId; knowledge: BalanceKnowledge }[];
  knownValueCents: number;
  hasUnknownBalance: boolean;
  balancesUndeclared: boolean;
  cardsUndeclared: boolean;
  concentration: EcosystemExposure[];
  flexibilityScore: number;
  earnedPrograms: PointsProgramId[];
  heldProductIds: ProductId[];
}

export interface NeedsSnapshot {
  /** Giảm dần theo nhu cầu, hoà thì theo id. */
  currency: { programId: PointsProgramId; need: number }[];
  benefit: { benefitId: string; need: number }[];
  portfolio: { diversification: number; flexibility: number };
  action: { newCard: number };
}

/**
 * Một bản ghi dữ liệu engine ĐÃ ĐỌC cho một ứng viên.
 *
 * Đây là cửa của "lỗi nằm ở DỮ LIỆU NGUỒN": khi một offer sai, admin phải thấy
 * ngay dòng nào, kiểm lại ngày nào, từ trang nào — chứ không phải tự tra lại
 * `activeAt` bằng tay và hy vọng ra đúng dòng engine đã thấy.
 *
 * KHÔNG lưu trong `derived_state`: nó suy lại được, chính xác, từ bản chụp bộ
 * dữ liệu đã lưu cùng lượt chạy (`activeOfferId` chốt offer nào, phần còn lại
 * là `activeAt` ở `asOf`). Lưu thì mỗi lượt chạy mang thêm ~150 KB chép lại
 * đúng những URL đã nằm trong bản chụp đó. Xem `provenanceFor` ở `debug.ts`.
 */
export interface ProvenanceRow {
  table:
    | "offers"
    | "offer_components"
    | "product_fees"
    | "earning_rates"
    | "earning_caps"
    | "program_valuations"
    | "transfer_paths"
    | "award_strategies"
    | "product_benefits"
    | "eligibility_rules";
  id: string;
  verifiedAt: string | null;
  recordedAt: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  confidence: string | null;
}

/** `OfferFacts` không kèm nguyên dòng offer — id đủ để tra, bản ghi nằm trong `provenance`. */
export type OfferFactsSnapshot = Omit<OfferFacts, "active"> & {
  activeOfferId: string | null;
  componentIds: string[];
};

/** Dữ kiện KHÔNG phụ thuộc mục tiêu của một sản phẩm trong tập ứng viên. */
export interface CandidateFactsSnapshot {
  productId: ProductId;
  productSlug: string;
  productName: string;
  /** Qua cả điều kiện lẫn phù hợp, nên được chấm điểm. */
  selectable: boolean;
  offer: OfferFactsSnapshot;
  earn: EarnFit;
  benefits: BenefitFit;
  travelBenefitCount: number;
  eligibility: EligibilityVerdict;
  suitability: SuitabilityVerdict;
}

/**
 * Ứng viên đã chấm có hiện ra cho người dùng không, và nếu không thì vì sao.
 *
 * Hai cách một thẻ được chấm điểm tốt mà vẫn vô hình: bị một hạng khác CÙNG
 * HỌ chiếm chỗ (`bestPerFamily`), hoặc nằm dưới vạch cắt số gợi ý. Không ghi
 * lại thì "thẻ X hạng 3 mà không thấy đâu" trông như một lỗi xếp hạng.
 */
export type CandidateVisibility =
  | "primary"
  | "alternative"
  | "no_action"
  | "hidden_same_family"
  | "hidden_beyond_cutoff";

export interface RankedCandidate {
  /** 1 = đứng đầu. */
  rank: number;
  visibility: CandidateVisibility;
  /** Với `hidden_same_family`: sản phẩm cùng họ đã hiện ra thay nó. */
  hiddenBy: ProductId | null;
  candidate: Candidate;
}

/** Những con số §29 thật sự đọc — để "vì sao chỉ `medium`" có câu trả lời bằng số. */
export interface ConfidenceInputs {
  topScore: number | null;
  secondScore: number | null;
  rivalCount: number;
  oldestVerifiedAt: string | null;
  /** Dòng dữ liệu CŨ NHẤT mà lượt chạy dựa vào — thứ cần kiểm lại khi độ tươi thấp. */
  oldestVerifiedRow: { table: string; id: string } | null;
}

/** Bản ghi có `verifiedAt` cũ nhất trong những gì lượt chạy đọc (§29 độ tươi). */
export interface OldestVerified {
  table: string;
  id: string;
  verifiedAt: string;
}

export interface GoalTrace {
  goalId: GoalId | null;
  goalType: GoalType;
  /** Mục tiêu đã chuẩn hoá: chuyến đi đã giải + số điểm cần. */
  goal: GoalContext;
  tripCoverage: TripCoverage | null;
  needs: NeedsSnapshot;
  /** TOÀN BỘ bảng xếp hạng, kể cả `NO_NEW_CARD` và những thẻ không hiện ra. */
  ranking: RankedCandidate[];
  confidenceInputs: ConfidenceInputs;
  /** Chỗ trống THUỘC VỀ mục tiêu này — đúng thứ §29 của nó đã đọc. */
  userGaps: UserDataGap[];
  dataGaps: DataGap[];
}

export interface DerivedState {
  /** Sản phẩm vào tập ứng viên, đã sắp theo id. */
  universe: ProductId[];
  /** Mọi sản phẩm KHÔNG được chấm điểm, kèm cửa đã chặn nó. */
  excluded: ExcludedProduct[];
  portfolio: PortfolioSnapshot;
  /** Mốc phí khi người dùng chưa khai ngưỡng — xem `evaluateSuitability`. */
  medianFeeCents: number;
  climate: OfferClimate;
  scale: ScoringScale;
  /** Mọi sản phẩm trong tập ứng viên, chọn được hay không. */
  candidates: CandidateFactsSnapshot[];
  goals: GoalTrace[];
  /**
   * §30 đã cân những câu hỏi nào, và câu trả lời thử nào đổi được người thắng
   * — xem `sensitivity.ts`. Rỗng khi không câu nào đo được (hoặc lượt chạy là
   * một lượt THỬ bên trong phép đo).
   */
  followUpProbes: GapProbe[];
}

/* ------------------------------------------------------------------ *
 * Đầu vào đã chuẩn hoá
 * ------------------------------------------------------------------ */

/** Offer đang chạy của một sản phẩm, kèm các mốc của nó. */
export interface ActiveOffer {
  offer: Offer;
  components: OfferComponent[];
}

export interface GoalContext {
  goal: Goal;
  trip: ResolvedTripGoal | null;
  tripNeed: TripNeed | null;
}
