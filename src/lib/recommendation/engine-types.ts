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
export interface TripNeed {
  strategies: AwardStrategy[];
  /** Chương trình định giá được chặng này, đã sắp theo id. */
  programs: PointsProgramId[];
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

export interface EligibilityVerdict {
  status: EligibilityStatus;
  /** Được mở thẻ, nhưng KHÔNG được welcome bonus (Amex® once-in-a-lifetime). */
  welcomeOfferBlocked: boolean;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
  /** Luật đã chặn, để debugger của Phase 4 chỉ đúng dòng. */
  failedRuleIds: string[];
  unknownRuleIds: string[];
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

/** Một lần điểm bị đổi SAU khi chấm (§16 rules, §17 editorial). */
export interface ScoreAdjustment {
  rule: string;
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
  asOf: string;
  goalResolution: "none" | "resolved" | "ambiguous";
  results: Recommendation[];
  followUp: FollowUpQuestion | null;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
  /** Chỗ trống của lớp dữ liệu mà lượt chạy này thật sự chạm vào. */
  dataGaps: DataGap[];
  userGaps: UserDataGap[];
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
