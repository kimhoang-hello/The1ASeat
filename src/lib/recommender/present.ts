/**
 * Một bản ghi lượt chạy (§20) → thứ trang hiển thị.
 *
 * Ranh giới: file này KHÔNG chạy engine, không xếp lại thứ hạng, không cộng
 * điểm. Nó đọc `outputSnapshot` — đúng những gì đã được lưu — và dịch sang câu
 * chữ. Nghĩa là trang và bản ghi trong kho không thể nói hai chuyện khác nhau,
 * và một khiếu nại "khuyến nghị này sai" tra lại được bằng `reco:debug` trên
 * đúng `runId` người dùng nhìn thấy.
 *
 * AFFILIATE (§16 Rule 7). Ở đây có đúng MỘT chỗ đọc `affiliateAvailable`: dựng
 * nút "Đăng ký ngay". Thứ tự, điểm số, lý do, cảnh báo đều lấy nguyên từ bản
 * ghi. `present.test.ts` đổi cờ affiliate của mọi thẻ rồi đòi mọi thứ trừ nút
 * CTA giữ nguyên từng chữ.
 */

import { isReferralUrl } from "../affiliate-links.ts";
import type { CreditCardOffer } from "../content/types.ts";
import type { Candidate } from "../recommendation/engine-types.ts";
import type { RecommendationRunRecord } from "../recommendation/runs.ts";
import type { ReasonCode, WarningCode } from "../recommendation/reason-codes.ts";
import type {
  PointsProgramId,
  RecommendationDataset,
  SpendCategory,
} from "../recommendation/types.ts";
import type { GoalType, UserState } from "../recommendation/user-types.ts";
import {
  COMPONENT_LABEL,
  COMPONENT_STRENGTH,
  CONFIDENCE_BY_CAUSE,
  CONFIDENCE_LABEL,
  REASON_COVERED_BY_WARNING,
  REASON_TEXT,
  STRATEGY_TEXT,
  WARNING_TEXT,
  type ReasonText,
} from "./copy.ts";
import {
  CABIN_LABEL,
  CATEGORY_LABEL,
  publicQuestionKey,
  questionKey,
  REGION_LABEL,
} from "./questions.ts";

/**
 * Một lý do đã dịch, KÈM mã gốc. Trang chỉ đọc `text`/`tone`; mã có mặt để lớp
 * giải thích Phase 6 biết lý do nào dựng trên ƯỚC LƯỢNG ("đã đủ điểm") mà không
 * phải đoán ngược từ câu chữ.
 */
export interface ReasonRow extends ReasonText {
  code: ReasonCode;
}

export interface ActionView {
  kind: "open_card" | "no_new_card";
  slug: string | null;
  name: string;
  /** Ảnh thẻ từ Contentful — vắng khi thẻ chưa có entry. */
  image: string | null;
  welcomeBonus: string | null;
  annualFee: string | null;
  /** Link đăng ký, và link đó có phải link affiliate không. */
  apply: { url: string; affiliate: boolean } | null;
  reasons: ReasonRow[];
  warnings: string[];
  /** Cho phần "cách tính" — người đọc kỹ mới mở ra. */
  score: number;
  components: { label: string; weight: number; raw: number; contribution: number }[];
  /** Ngân hàng có thể vẫn từ chối — nói ra khi engine chưa kiểm được điều kiện. */
  eligibilityUncertain: boolean;
  /**
   * Câu nói thẻ này KHÁC hành động chính ở chỗ nào — chỉ có ở lựa chọn thay
   * thế.
   *
   * Lấy lý do đầu tiên mà hành động chính KHÔNG có. Không có câu riêng thì để
   * `null`: ba dòng giống hệt nhau dưới ba cái tên khác nhau không giúp ai
   * chọn, mà còn làm người đọc tưởng mình đọc nhầm.
   */
  lead: string | null;
  /**
   * Hai dòng điểm đóng góp nhiều nhất — dùng khi engine không phát ra mã lý do
   * "ủng hộ" nào.
   *
   * Có những thẻ thắng mà không có mã nào nói ra vì sao: chúng thắng bằng tổng
   * điểm, không bằng một đặc điểm nổi bật. Im lặng ở đó là để người đọc nhìn
   * một cái tên không kèm lý do — nên nói thẳng cái đã đẩy nó lên đầu, bằng
   * chính các dòng của bảng điểm.
   */
  strengths: string[];
  /**
   * Mốc chi để nhận trọn welcome bonus, quy về 90 ngày (đô la).
   *
   * Đây là VIỆC PHẢI LÀM sau khi mở thẻ, và là con số quyết định một welcome
   * bonus có thật hay chỉ là con số quảng cáo. `null` = offer không có mốc chi
   * nào dựng được từ dữ liệu — KHÁC với "không đòi chi tiêu gì", nên trang
   * không được in $0 ở đó.
   */
  minSpendPer90Days: number | null;
  /**
   * Vì sao "chưa mở thẻ" lại thắng — chỉ có ở ứng viên `no_new_card`.
   *
   * Bốn lý do khác hẳn nhau: đã đủ điểm, ví đã che được nhu cầu, thị trường
   * offer đang thấp, hoặc KHÔNG THẺ NÀO với tới được (điều kiện và ngưỡng phí
   * của chính người dùng). In chung một câu "ví bạn đã đủ" cho cả bốn là nói
   * sai với người thứ tư — họ không đủ gì cả, chỉ là chưa có lựa chọn nào hợp.
   */
  noCardReason: "points_sufficient" | "portfolio_covers" | "offers_weak" | "nothing_fits" | null;
  /**
   * Người này KHÔNG nhận được welcome bonus của thẻ (Amex® once-in-a-lifetime).
   *
   * Thẻ vẫn có thể là lựa chọn đúng — vì tỷ lệ tích điểm, vì quyền lợi — nhưng
   * câu "chi $2,959 trong 3 tháng để nhận trọn welcome bonus" thì thành một lời
   * hứa ngân hàng sẽ không giữ.
   */
  welcomeBonusBlocked: boolean;
}

export interface TripNumbersView {
  /** Những thừa số còn thiếu, kèm khoá câu hỏi để hỏi thẳng. */
  missing: { label: string; questionKey: string }[];
  /**
   * Chặng này CHƯA CÓ trong award chart của site.
   *
   * Khác hẳn "còn thiếu vài câu trả lời": người dùng trả lời thêm bao nhiêu
   * câu cũng không ra con số. Nói nhầm hai thứ này là bắt họ điền một form vô
   * ích rồi vẫn không có kết quả.
   */
  routeNotPriced: boolean;
  destination: string;
  cabin: string | null;
  passengers: number | null;
  roundTrip: boolean | null;
  needLow: number | null;
  needTypical: number | null;
  needHigh: number | null;
  accessible: number | null;
  accessibleIsLowerBound: boolean;
  gap: number | null;
  /** 0..1 — phần chuyến đi mà số điểm hiện tại phủ được. */
  coverage: number | null;
  coverageIsEstimate: boolean;
}

export interface ResultView {
  runId: string;
  asOf: string;
  engineVersion: string;
  goalType: GoalType;
  goalTitle: string;
  strategy: string;
  primary: ActionView;
  alternatives: ActionView[];
  /** `null` khi "chưa mở thẻ" CHÍNH LÀ hành động chính. */
  noAction: ActionView | null;
  warnings: string[];
  confidence: { level: "high" | "medium" | "low"; label: string; sentence: string };
  trip: TripNumbersView | null;
  /**
   * Ngày kiểm của dòng dữ liệu CŨ NHẤT mà lượt chạy này dựa vào.
   *
   * Phân biệt "số mình tự ước lượng" với "số chép từ trang của ngân hàng và
   * kiểm ngày nào" là việc của trang: người đọc sắp mang con số này đi quyết
   * định tiền bạc, và một con số không có ngày thì không kiểm lại được.
   */
  dataVerifiedAt: string | null;
}

/* ------------------------------------------------------------------ *
 * Lý do và cảnh báo
 * ------------------------------------------------------------------ */

const TONE_ORDER = { good: 0, caution: 1, info: 2 } as const;

/**
 * Mã → câu, bỏ trùng, và xếp theo: ủng hộ → cần cân nhắc → ngữ cảnh.
 *
 * Thứ tự này là một quyết định biên tập: người đọc phải thấy lý do CHỌN trước,
 * nhưng không bao giờ được thấy nó mà không có phần "nhưng". Cả hai nhóm nằm
 * trên cùng một danh sách, không có nhóm nào gập lại.
 */
export function reasonsOf(
  codes: readonly ReasonCode[],
  /** Cảnh báo sẽ hiện ở khối riêng — lý do trùng nội dung với chúng thì bỏ. */
  warnings: readonly WarningCode[] = [],
): ReasonRow[] {
  const shownWarnings = new Set(warnings);
  const seen = new Set<string>();
  const rows: ReasonRow[] = [];
  for (const code of codes) {
    const twin = REASON_COVERED_BY_WARNING[code];
    if (twin !== undefined && shownWarnings.has(twin)) continue;
    const row = REASON_TEXT[code];
    if (row === undefined || seen.has(row.text)) continue;
    seen.add(row.text);
    rows.push({ ...row, code });
  }
  return rows.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export function warningsOf(codes: readonly WarningCode[]): string[] {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const code of codes) {
    const text = WARNING_TEXT[code];
    if (text === undefined || seen.has(text)) continue;
    seen.add(text);
    rows.push(text);
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * Một ứng viên → một hành động
 * ------------------------------------------------------------------ */

interface CardLookup {
  offers: Map<string, CreditCardOffer>;
  /** Dữ kiện offer engine ĐÃ ĐỌC, theo slug — nguồn của con số mốc chi. */
  facts: Map<string, { minSpendPer90Days: number | null }>;
}

function lookup(record: RecommendationRunRecord, offers: readonly CreditCardOffer[]): CardLookup {
  return {
    offers: new Map(offers.map((offer) => [offer.slug, offer])),
    facts: new Map(
      record.derivedState.candidates.map((row) => [
        row.productSlug,
        // Mốc của TOÀN BỘ offer, không phải của phần người này với tới được:
        // câu "chi bao nhiêu để nhận trọn bonus" hỏi về con số thứ nhất.
        { minSpendPer90Days: row.offer.fullRequiredPerNinetyDays },
      ]),
    ),
  };
}

/** Dòng điểm nào đưa `NO_NEW_CARD` lên đầu — bảng điểm riêng của nó ở `rank.ts`. */
function noCardReasonOf(candidate: Candidate): ActionView["noCardReason"] {
  const top = [...candidate.components]
    .filter((row) => row.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)[0];
  switch (top?.key) {
    case "points_already_sufficient":
      return "points_sufficient";
    case "portfolio_already_covers":
      return "portfolio_covers";
    case "offer_climate_weak":
      return "offers_weak";
    case "no_reachable_candidate":
      return "nothing_fits";
    default:
      return null;
  }
}

function actionOf(
  candidate: Candidate,
  cards: CardLookup,
  /** Lý do của hành động chính — để lựa chọn thay thế nói ra chỗ KHÁC. */
  primaryReasons: ReadonlySet<string> = new Set(),
  /**
   * Cảnh báo SẼ ĐƯỢC HIỆN cho chính hành động này — chỉ hành động chính có.
   *
   * Chỉ bỏ lý do trùng với cảnh báo khi cảnh báo đó thật sự xuất hiện trên
   * màn hình. Lựa chọn thay thế không có khối cảnh báo, nên bỏ lý do ở đó là
   * xoá vế cảnh báo duy nhất của nó: một thẻ người dùng từng giữ sẽ mất câu
   * "bạn không nhận được welcome bonus" rồi rơi xuống câu quảng cáo chính con
   * số bonus đó (Codex, vòng UX).
   */
  shownWarnings: readonly WarningCode[] = [],
): ActionView {
  const slug = candidate.productSlug;
  const offer = slug === null ? undefined : cards.offers.get(slug);
  return {
    kind: candidate.kind,
    slug,
    name: candidate.productName ?? "Chưa mở thẻ mới",
    image: offer?.cardImage ?? offer?.image ?? null,
    welcomeBonus: offer?.welcomeBonus ?? null,
    annualFee: offer?.annualFee ?? null,
    // CHỖ DUY NHẤT đọc affiliate. Không có link apply thì không có nút — và
    // `affiliateAvailable` chỉ đổi thuộc tính `rel`, không đổi việc có nút hay
    // không (thẻ nào cũng đáng có đường đăng ký).
    // Cờ affiliate đọc từ CHÍNH link sắp render, không từ bản chụp: bản ghi có
    // thể là của sáng nay, còn link thì lấy từ Contentful lúc này. Một link
    // vừa đổi thành link có hoa hồng mà bản chụp nói "không" sẽ ra một nút
    // thiếu `rel="sponsored"` và thiếu câu disclosure (Codex vòng 2).
    apply:
      offer?.applyUrl === undefined
        ? null
        : { url: offer.applyUrl, affiliate: isReferralUrl(offer.applyUrl) },
    reasons: reasonsOf(candidate.reasonCodes, shownWarnings),
    warnings: warningsOf(candidate.warnings),
    score: candidate.score,
    components: candidate.components.map((row) => ({
      label: COMPONENT_LABEL[row.key],
      weight: row.weight,
      raw: row.raw,
      contribution: row.contribution,
    })),
    eligibilityUncertain: candidate.eligibility?.status === "unknown",
    // Câu của lựa chọn thay thế ưu tiên vế CẦN CÂN NHẮC: một thẻ $799 hiện ra
    // dưới dòng "kiếm điểm linh hoạt" trong khi điều người đọc cần biết là
    // "phí cao hơn mức bạn nói" thì dòng đó đang bán hàng.
    lead: (() => {
      const own = reasonsOf(candidate.reasonCodes, shownWarnings).filter(
        (row) => !primaryReasons.has(row.text),
      );
      return (own.find((row) => row.tone === "caution") ?? own[0])?.text ?? null;
    })(),
    // Điểm mạnh chỉ nói ra những dòng THẬT SỰ mạnh, và chỉ cho thẻ.
    //
    // Hai bộ lọc, mỗi cái vá một câu nói dối: dòng dưới 0.6 không phải "điểm
    // mạnh" (nó chỉ là dòng đóng góp nhiều nhất trong một bảng yếu), và
    // `spend_fit` bằng 1 theo QUY ƯỚC khi offer không có mốc chi nào biết được
    // — in "mốc chi vừa sức bạn" ở đó là khẳng định một thứ chưa ai biết.
    strengths:
      candidate.kind === "no_new_card"
        ? []
        : [...candidate.components]
            .filter((row) => row.raw >= 0.6 && row.contribution > 0 && row.key !== "editorial")
            .filter(
              (row) =>
                row.key !== "spend_fit" ||
                (slug !== null && cards.facts.get(slug)?.minSpendPer90Days != null),
            )
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 2)
            .map((row) => COMPONENT_STRENGTH[row.key]),
    minSpendPer90Days: slug === null ? null : (cards.facts.get(slug)?.minSpendPer90Days ?? null),
    noCardReason: candidate.kind === "no_new_card" ? noCardReasonOf(candidate) : null,
    welcomeBonusBlocked: candidate.eligibility?.welcomeOfferBlocked === true,
  };
}

/* ------------------------------------------------------------------ *
 * Mục tiêu và chuyến đi
 * ------------------------------------------------------------------ */

const GOAL_TITLE: Record<GoalType, string> = {
  next_card: "Thẻ nên mở tiếp theo",
  trip: "Chuyến bay bạn đang nhắm",
  earn_points: "Tích thêm điểm hằng ngày",
  diversify: "Đa dạng hoá điểm",
};

function tripView(record: RecommendationRunRecord, index: number): TripNumbersView | null {
  const trace = record.derivedState.goals[index];
  const result = record.outputSnapshot.results[index];
  const trip = trace?.goal.trip;
  if (trip == null || result === undefined) return null;
  const coverage = trace.tripCoverage;
  const goalId = trace.goalId ?? "";
  const missing: { label: string; questionKey: string }[] = [];
  if (trip.cabin === null) missing.push({ label: "hạng ghế", questionKey: `trip_cabin_unknown:${goalId}` });
  if (trip.passengers === null) {
    missing.push({ label: "số người", questionKey: `trip_passengers_unknown:${goalId}` });
  }
  if (trip.roundTrip === null) {
    missing.push({ label: "khứ hồi hay một chiều", questionKey: `trip_round_trip_unknown:${goalId}` });
  }
  return {
    missing,
    routeNotPriced: (result.warnings as string[]).includes("AWARD_ROUTE_NOT_IN_DATASET"),
    destination: REGION_LABEL[trip.destinationRegion],
    cabin: trip.cabin === null ? null : CABIN_LABEL[trip.cabin],
    passengers: trip.passengers,
    roundTrip: trip.roundTrip,
    needLow: result.numbers.tripNeedLow,
    needTypical: result.numbers.tripNeedTypical,
    needHigh: result.numbers.tripNeedHigh,
    accessible: result.numbers.accessiblePoints,
    accessibleIsLowerBound: result.numbers.accessiblePointsIsLowerBound,
    gap: result.numbers.pointsGapTypical,
    coverage: coverage?.coverage ?? null,
    // "Ước lượng" nói ra rằng con số phủ là điểm giữa của một khoảng — số dư
    // chưa biết, hoặc chương trình chỉ công bố giá sàn. Trình bày nó như một
    // con số chắc chắn là đúng lỗi §29 sinh ra để tránh.
    coverageIsEstimate: coverage !== null && coverage.coverageKnown === false,
  };
}

/* ------------------------------------------------------------------ *
 * Độ chắc chắn
 * ------------------------------------------------------------------ */

/**
 * Độ chắc chắn: nói NGUYÊN NHÂN NÀO NGƯỜI DÙNG LÀM GÌ ĐƯỢC, rồi mới tới nguyên
 * nhân yếu nhất về mặt số học.
 *
 * Trên bộ dữ liệu hiện tại, `scoreSeparation` gần như luôn là yếu tố thấp nhất
 * — các thẻ tốt ở Canada chênh nhau rất ít. Nếu chỉ lấy yếu tố thấp nhất thì
 * MỌI hồ sơ đều nhận đúng một câu "hai lựa chọn ngang nhau", kể cả người chưa
 * khai gì — và câu đó che mất thứ họ sửa được ngay: trả lời thêm.
 */
function confidenceOf(
  factors: {
    dataCompleteness: number;
    dataFreshness: number;
    goalSpecificity: number;
    scoreSeparation: number;
    level: "high" | "medium" | "low";
  },
  hasFollowUp: boolean,
): { level: "high" | "medium" | "low"; label: string; sentence: string } {
  if (factors.level === "high") {
    return {
      level: factors.level,
      label: CONFIDENCE_LABEL.high,
      sentence: "Mình có đủ thông tin cho kết luận này.",
    };
  }
  const WEAK = 0.75;
  const weak = (
    [
      ["dataCompleteness", factors.dataCompleteness],
      ["goalSpecificity", factors.goalSpecificity],
      ["dataFreshness", factors.dataFreshness],
      ["scoreSeparation", factors.scoreSeparation],
    ] as const
  )
    .filter(([, value]) => value < WEAK)
    .sort((a, b) => a[1] - b[1]);

  // Còn câu để hỏi và dữ liệu còn thiếu → nói điều đó trước: đó là thứ người
  // đọc bấm một cái là sửa được.
  const actionable = hasFollowUp && factors.dataCompleteness < WEAK ? "dataCompleteness" : null;
  const lead = actionable ?? weak[0]?.[0] ?? "scoreSeparation";
  const tied = lead !== "scoreSeparation" && factors.scoreSeparation < WEAK;
  const base = CONFIDENCE_BY_CAUSE[lead];
  return {
    level: factors.level,
    label: base.label,
    sentence: tied
      ? `${base.sentence} Hai thẻ đứng đầu cũng đang gần như ngang điểm nhau.`
      : base.sentence,
  };
}

/* ------------------------------------------------------------------ *
 * Ráp lại
 * ------------------------------------------------------------------ */

/**
 * Bao nhiêu lựa chọn khác thì đủ.
 *
 * Ba: đủ để thấy mình có lựa chọn, ít để còn quyết định được. Engine đã cắt
 * `alternatives` theo luật của nó; đây chỉ là trần của trang.
 */
const MAX_ALTERNATIVES = 3;

export function presentRun(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
  offers: readonly CreditCardOffer[],
  goalIndex = 0,
): ResultView | null {
  const result = record.outputSnapshot.results[goalIndex];
  if (result === undefined) return null;
  const cards = lookup(record, offers);
  const runWarnings = [...result.warnings, ...record.outputSnapshot.warnings];
  const primary = actionOf(result.primaryAction, cards, new Set(), runWarnings);
  const primaryReasons = new Set(primary.reasons.map((row) => row.text));
  const noActionIsPrimary = result.primaryAction.kind === "no_new_card";

  return {
    runId: record.id,
    asOf: record.dataSnapshotAt,
    engineVersion: record.engineVersion,
    goalType: result.goalType,
    goalTitle: GOAL_TITLE[result.goalType],
    strategy: STRATEGY_TEXT[result.strategy.strategy],
    primary,
    // Mỗi lựa chọn thay thế phải nói một câu KHÁC nhau: ba dòng giống hệt dưới
    // ba cái tên không giúp ai chọn. Câu đã dùng thì thẻ sau lấy câu kế tiếp.
    alternatives: (() => {
      const used = new Set(primaryReasons);
      return result.alternatives.slice(0, MAX_ALTERNATIVES).map((row) => {
        // KHÔNG truyền cảnh báo: hàng thay thế không có khối cảnh báo nào để
        // truyền sang.
        const view = actionOf(row, cards, used);
        if (view.lead !== null) used.add(view.lead);
        return view;
      });
    })(),
    // "Chưa mở thẻ nào" luôn là một ứng viên (§16 Rule 8), nên nó luôn hiện ra
    // — như một lựa chọn thật, không phải như một dòng chữ an ủi ở cuối trang.
    noAction: noActionIsPrimary ? null : actionOf(result.noAction, cards, primaryReasons),
    // Cảnh báo trùng câu với một lý do đã hiện ngay trên thẻ thì bỏ: người đọc
    // gặp đúng một câu hai lần, và khối "lưu ý" loãng đi vì nó.
    warnings: warningsOf(runWarnings).filter(
      (text) => !primary.reasons.some((reason) => reason.text === text),
    ),
    confidence: confidenceOf(result.confidence, record.outputSnapshot.followUp !== null),
    trip: tripView(record, goalIndex),
    dataVerifiedAt: record.derivedState.goals[goalIndex]?.confidenceInputs.oldestVerifiedAt ?? null,
  };
}

/** Số điểm, dấu phẩy ngăn nghìn — quy ước số của site. */
export function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}

/**
 * Câu nói phần phủ chuyến đi, hoặc `null` khi không nên nói.
 *
 * Hai luật, dùng chung cho trang và lời giải thích (rà đối kháng Phase 6):
 * phần phủ ≥ 1 thì không in phần trăm vượt 100 ("phủ khoảng 140%" đọc như lời
 * hứa dư dả); và phần phủ ≥ 1 mà vẫn còn thiếu điểm là hai ước lượng mâu thuẫn
 * — giữ con số thiếu, bỏ câu phủ.
 */
export function coverageStatement(trip: Pick<TripNumbersView, "coverage" | "gap">): string | null {
  if (trip.coverage === null || trip.coverage < 0) return null;
  if (trip.coverage >= 1) return trip.gap !== null && trip.gap > 0 ? null : "điểm hiện tại phủ được cả chuyến này";
  return `điểm hiện tại phủ khoảng ${Math.round(trip.coverage * 100)}% chuyến này`;
}

/**
 * Số điểm một chuyến bay cần, nói ĐÚNG cái đã biết.
 *
 * Chỉ biết một đầu thì nói ra là đầu nào: "60,000" trần cho một chặng chỉ biết
 * giá sàn là nói thấp đi con số thật (rà đối kháng Phase 6, 17/09/2026). Dùng
 * chung cho ô số trên trang và mệnh đề của lời giải thích — hai chỗ không được
 * nói hai chuyện.
 */
export function formatNeed(low: number | null, high: number | null): string | null {
  if (low !== null && high !== null) {
    return low === high ? `${formatPoints(low)} điểm` : `${formatPoints(low)} – ${formatPoints(high)} điểm`;
  }
  if (low !== null) return `ít nhất ${formatPoints(low)} điểm (chưa biết mức cao nhất)`;
  if (high !== null) return `tối đa ${formatPoints(high)} điểm (chưa biết mức thấp nhất)`;
  return null;
}

export function programName(dataset: RecommendationDataset, id: PointsProgramId): string {
  return dataset.pointsPrograms.find((row) => row.id === id)?.name ?? (id as string);
}

/* ------------------------------------------------------------------ *
 * "Mình đang dựa vào những gì bạn đã nói"
 * ------------------------------------------------------------------ */

export interface AnsweredRow {
  label: string;
  value: string;
  /** Khoá câu hỏi để sửa lại — `null` khi không sửa được (mục tiêu, nước ở). */
  questionKey: string | null;
}

function amountText(amount: { low: number; high: number | null } | null): string | null {
  if (amount === null) return null;
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (amount.high === null) return `${money(amount.low)} trở lên`;
  if (amount.high === amount.low) return money(amount.low);
  return `${money(amount.low)} – ${money(amount.high)}`;
}

/**
 * Những gì người dùng ĐÃ nói, đúng thứ engine đọc.
 *
 * Có mặt vì một khuyến nghị dựa trên hồ sơ mà người đọc không thấy được là một
 * hộp đen: họ không kiểm được mình có gõ nhầm không, và không sửa được khi gõ
 * nhầm. Mỗi dòng mang theo khoá câu hỏi, nên "Sửa" mở lại đúng câu đó.
 */
export function answeredRows(state: UserState, dataset: RecommendationDataset): AnsweredRow[] {
  const rows: AnsweredRow[] = [];
  const id = state.profile.id as string;
  /** Câu hỏi về chính người dùng — khoá không mang id phiên. */
  const self = (kind: Parameters<typeof publicQuestionKey>[0]) => publicQuestionKey(kind, id, id);
  const goal = state.goals[0];
  if (goal !== undefined) {
    rows.push({
      label: "Mục tiêu",
      value:
        goal.type === "trip"
          ? `Bay ${REGION_LABEL[goal.destinationRegion]}`
          : GOAL_TITLE[goal.type],
      questionKey: null,
    });
  }
  if (goal?.type === "trip") {
    if (goal.cabin !== null) {
      rows.push({ label: "Hạng ghế", value: CABIN_LABEL[goal.cabin], questionKey: questionKey("trip_cabin_unknown", goal.id as string) });
    }
    if (goal.passengers !== null) {
      rows.push({ label: "Số người", value: `${goal.passengers}`, questionKey: questionKey("trip_passengers_unknown", goal.id as string) });
    }
    if (goal.roundTrip !== null) {
      rows.push({
        label: "Loại vé",
        value: goal.roundTrip ? "Khứ hồi" : "Một chiều",
        questionKey: questionKey("trip_round_trip_unknown", goal.id as string),
      });
    }
    if (goal.flexibility !== null) {
      rows.push({
        label: "Ngày bay linh hoạt",
        value: { low: "Cố định", medium: "Xê dịch được vài ngày", high: "Rất linh hoạt" }[
          goal.flexibility
        ],
        questionKey: questionKey("trip_flexibility_unknown", goal.id as string),
      });
    }
    if (goal.travelStart !== null) {
      rows.push({
        label: "Thời gian bay",
        value: `Tháng ${Number(goal.travelStart.slice(5, 7))}/${goal.travelStart.slice(0, 4)}`,
        questionKey: questionKey("trip_dates_unknown", goal.id as string),
      });
    }
  }
  if (state.declared.cards) {
    const nameOf = (productId: string) =>
      dataset.products.find((product) => product.id === productId)?.name;
    const named = (status: (card: UserState["cards"][number]) => boolean) =>
      state.cards
        .filter(status)
        .map((card) => nameOf(card.productId as string))
        .filter((name): name is string => name !== undefined);
    const held = named((card) => card.status === "active");
    rows.push({
      label: "Thẻ đang giữ",
      value: held.length === 0 ? "Chưa có thẻ nào" : held.join(", "),
      questionKey: self("cards_undeclared"),
    });
    const closed = named((card) => card.status !== "active");
    if (closed.length > 0) {
      rows.push({
        label: "Thẻ từng giữ",
        value: closed.join(", "),
        questionKey: self("cards_undeclared"),
      });
    }
    // Năm đóng thẻ đổi được cửa welcome bonus, nên nó phải sửa được — mỗi thẻ
    // một dòng, vì mỗi thẻ là một câu hỏi riêng.
    for (const card of state.cards) {
      if (card.status === "active" || card.closedDate === null) continue;
      rows.push({
        label: `Năm đóng ${nameOf(card.productId as string) ?? "thẻ"}`,
        value: card.closedDate.slice(0, 4),
        questionKey: questionKey("card_closed_date_unknown", card.id as string),
      });
    }
  }
  if (state.declared.balances) {
    rows.push({
      label: "Điểm đang có",
      value:
        state.balances.length === 0
          ? "Chưa có điểm nào"
          : state.balances.map((row) => programName(dataset, row.programId)).join(", "),
      questionKey: self("balances_undeclared"),
    });
    // Mỗi số dư ĐÃ KHAI một dòng riêng: con số đó quyết định "còn thiếu bao
    // nhiêu điểm", nên gõ nhầm một chữ số phải sửa được mà không phải khai lại
    // cả danh sách.
    for (const row of state.balances) {
      if (row.balance === null) continue;
      rows.push({
        label: `Số điểm ${programName(dataset, row.programId)}`,
        value: formatPoints(row.balance),
        questionKey: questionKey("point_balance_amount_unknown", row.programId as string),
      });
    }
  }
  const capacity = amountText(state.spend?.minimumSpendCapacity3m ?? null);
  if (capacity !== null) {
    rows.push({
      label: "Dồn được trong 3 tháng",
      value: capacity,
      questionKey: self("minimum_spend_capacity_unknown"),
    });
  }
  const monthly = amountText(state.spend?.monthlyTotal ?? null);
  if (monthly !== null) {
    rows.push({
      label: "Chi tiêu mỗi tháng",
      value: monthly,
      questionKey: self("monthly_total_unknown"),
    });
  }
  // Chi tiêu theo hạng mục: engine hỏi từng hạng mục một, nên sửa cũng từng
  // hạng mục một.
  for (const [category, amount] of Object.entries(state.spend?.byCategory ?? {})) {
    const text = amountText(amount ?? null);
    if (text === null) continue;
    rows.push({
      label: `Chi cho ${CATEGORY_LABEL[category as SpendCategory]}`,
      value: text,
      questionKey: questionKey("spend_category_unknown", category as string),
    });
  }
  const income = amountText(state.profile.annualPersonalIncome);
  if (income !== null || state.profile.personalIncomeDeclined) {
    rows.push({
      label: "Thu nhập cá nhân",
      value: income ?? "Không muốn trả lời",
      questionKey: self("personal_income_unknown"),
    });
  }
  const household = amountText(state.profile.annualHouseholdIncome);
  if (household !== null || state.profile.householdIncomeDeclined) {
    rows.push({
      label: "Thu nhập hộ gia đình",
      value: household ?? "Không muốn trả lời",
      questionKey: self("household_income_unknown"),
    });
  }
  const fee = state.profile.annualFeeTolerancePerCard;
  if (fee !== null) {
    rows.push({
      label: "Phí thường niên chấp nhận",
      value: fee >= 10_000 ? "Bao nhiêu cũng được nếu đáng" : `Tới $${fee.toLocaleString("en-US")}`,
      questionKey: self("annual_fee_tolerance_unknown"),
    });
  }
  const yesNo = (value: boolean) => (value ? "Có" : "Không");
  if (state.profile.businessCardsAllowed !== null) {
    rows.push({
      label: "Xét thẻ doanh nghiệp",
      value: yesNo(state.profile.businessCardsAllowed),
      questionKey: self("business_cards_preference_unknown"),
    });
  }
  if (state.profile.hasBusiness !== null) {
    rows.push({
      label: "Có doanh nghiệp / tự doanh",
      value: yesNo(state.profile.hasBusiness),
      questionKey: self("business_ownership_unknown"),
    });
  }
  if (state.profile.isStudent !== null) {
    rows.push({
      label: "Đang là sinh viên",
      value: yesNo(state.profile.isStudent),
      questionKey: self("student_status_unknown"),
    });
  }
  return rows;
}
