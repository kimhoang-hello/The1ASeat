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

import type { CreditCardOffer } from "../content/types.ts";
import type { Candidate } from "../recommendation/engine-types.ts";
import type { RecommendationRunRecord } from "../recommendation/runs.ts";
import type { ReasonCode, WarningCode } from "../recommendation/reason-codes.ts";
import type { PointsProgramId, Product, RecommendationDataset } from "../recommendation/types.ts";
import type { GoalType, UserState } from "../recommendation/user-types.ts";
import {
  COMPONENT_LABEL,
  COMPONENT_STRENGTH,
  CONFIDENCE_LABEL,
  CONFIDENCE_REASON,
  REASON_TEXT,
  STRATEGY_TEXT,
  WARNING_TEXT,
  type ReasonText,
} from "./copy.ts";
import { CABIN_LABEL, REGION_LABEL } from "./questions.ts";

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
  reasons: ReasonText[];
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
}

export interface TripNumbersView {
  /** Những thừa số còn thiếu, kèm khoá câu hỏi để hỏi thẳng. */
  missing: { label: string; questionKey: string }[];
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
export function reasonsOf(codes: readonly ReasonCode[]): ReasonText[] {
  const seen = new Set<string>();
  const rows: ReasonText[] = [];
  for (const code of codes) {
    const row = REASON_TEXT[code];
    if (row === undefined || seen.has(row.text)) continue;
    seen.add(row.text);
    rows.push(row);
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
  products: Map<string, Product>;
}

function lookup(dataset: RecommendationDataset, offers: readonly CreditCardOffer[]): CardLookup {
  return {
    offers: new Map(offers.map((offer) => [offer.slug, offer])),
    products: new Map(dataset.products.map((product) => [product.slug, product])),
  };
}

function actionOf(
  candidate: Candidate,
  cards: CardLookup,
  /** Lý do của hành động chính — để lựa chọn thay thế nói ra chỗ KHÁC. */
  primaryReasons: ReadonlySet<string> = new Set(),
): ActionView {
  const slug = candidate.productSlug;
  const offer = slug === null ? undefined : cards.offers.get(slug);
  const product = slug === null ? undefined : cards.products.get(slug);
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
    apply:
      offer?.applyUrl === undefined
        ? null
        : { url: offer.applyUrl, affiliate: product?.affiliateAvailable ?? false },
    reasons: reasonsOf(candidate.reasonCodes),
    warnings: warningsOf(candidate.warnings),
    score: candidate.score,
    components: candidate.components.map((row) => ({
      label: COMPONENT_LABEL[row.key],
      weight: row.weight,
      raw: row.raw,
      contribution: row.contribution,
    })),
    eligibilityUncertain: candidate.eligibility?.status === "unknown",
    lead: reasonsOf(candidate.reasonCodes).find((row) => !primaryReasons.has(row.text))?.text ?? null,
    strengths: [...candidate.components]
      .filter((row) => row.contribution > 0 && row.key !== "editorial")
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2)
      .map((row) => COMPONENT_STRENGTH[row.key]),
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

function confidenceSentence(factors: {
  dataCompleteness: number;
  dataFreshness: number;
  goalSpecificity: number;
  scoreSeparation: number;
  level: "high" | "medium" | "low";
}): string {
  if (factors.level === "high") return "Mình có đủ thông tin cho kết luận này.";
  const weakest = (
    [
      ["dataCompleteness", factors.dataCompleteness],
      ["scoreSeparation", factors.scoreSeparation],
      ["goalSpecificity", factors.goalSpecificity],
      ["dataFreshness", factors.dataFreshness],
    ] as const
  ).reduce((low, row) => (row[1] < low[1] ? row : low));
  return `Chưa chắc chắn hoàn toàn ${CONFIDENCE_REASON[weakest[0]]}.`;
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
  const cards = lookup(dataset, offers);
  const primary = actionOf(result.primaryAction, cards);
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
    alternatives: result.alternatives
      .slice(0, MAX_ALTERNATIVES)
      .map((row) => actionOf(row, cards, primaryReasons)),
    // "Chưa mở thẻ nào" luôn là một ứng viên (§16 Rule 8), nên nó luôn hiện ra
    // — như một lựa chọn thật, không phải như một dòng chữ an ủi ở cuối trang.
    noAction: noActionIsPrimary ? null : actionOf(result.noAction, cards, primaryReasons),
    warnings: warningsOf([...result.warnings, ...record.outputSnapshot.warnings]),
    confidence: {
      level: result.confidence.level,
      label: CONFIDENCE_LABEL[result.confidence.level],
      sentence: confidenceSentence(result.confidence),
    },
    trip: tripView(record, goalIndex),
  };
}

/** Số điểm, dấu phẩy ngăn nghìn — quy ước số của site. */
export function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}

/** Khoảng điểm "120,000 – 180,000", hoặc một số khi hai đầu bằng nhau. */
export function formatPointsRange(low: number | null, high: number | null): string | null {
  if (low === null && high === null) return null;
  if (low === null) return formatPoints(high as number);
  if (high === null || high === low) return formatPoints(low);
  return `${formatPoints(low)} – ${formatPoints(high)}`;
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
      rows.push({ label: "Hạng ghế", value: CABIN_LABEL[goal.cabin], questionKey: `trip_cabin_unknown:${goal.id}` });
    }
    if (goal.passengers !== null) {
      rows.push({ label: "Số người", value: `${goal.passengers}`, questionKey: `trip_passengers_unknown:${goal.id}` });
    }
    if (goal.roundTrip !== null) {
      rows.push({
        label: "Loại vé",
        value: goal.roundTrip ? "Khứ hồi" : "Một chiều",
        questionKey: `trip_round_trip_unknown:${goal.id}`,
      });
    }
    if (goal.travelStart !== null) {
      rows.push({
        label: "Thời gian bay",
        value: `Tháng ${Number(goal.travelStart.slice(5, 7))}/${goal.travelStart.slice(0, 4)}`,
        questionKey: `trip_dates_unknown:${goal.id}`,
      });
    }
  }
  if (state.declared.cards) {
    const held = state.cards.filter((card) => card.status === "active");
    const names = held
      .map((card) => dataset.products.find((product) => product.id === card.productId)?.name)
      .filter((name): name is string => name !== undefined);
    rows.push({
      label: "Thẻ đang giữ",
      value: names.length === 0 ? "Chưa có thẻ nào" : names.join(", "),
      questionKey: `cards_undeclared:${state.profile.id}`,
    });
  }
  if (state.declared.balances) {
    const names = state.balances.map((row) => {
      const name = programName(dataset, row.programId);
      return row.balance === null ? name : `${name} (${formatPoints(row.balance)})`;
    });
    rows.push({
      label: "Điểm đang có",
      value: names.length === 0 ? "Chưa có điểm nào" : names.join(", "),
      questionKey: `balances_undeclared:${state.profile.id}`,
    });
  }
  const capacity = amountText(state.spend?.minimumSpendCapacity3m ?? null);
  if (capacity !== null) {
    rows.push({
      label: "Dồn được trong 3 tháng",
      value: capacity,
      questionKey: `minimum_spend_capacity_unknown:${state.profile.id}`,
    });
  }
  const monthly = amountText(state.spend?.monthlyTotal ?? null);
  if (monthly !== null) {
    rows.push({
      label: "Chi tiêu mỗi tháng",
      value: monthly,
      questionKey: `monthly_total_unknown:${state.profile.id}`,
    });
  }
  const income = amountText(state.profile.annualPersonalIncome);
  if (income !== null) {
    rows.push({
      label: "Thu nhập cá nhân",
      value: income,
      questionKey: `personal_income_unknown:${state.profile.id}`,
    });
  }
  const fee = state.profile.annualFeeTolerancePerCard;
  if (fee !== null) {
    rows.push({
      label: "Phí thường niên chấp nhận",
      value: fee >= 10_000 ? "Bao nhiêu cũng được nếu đáng" : `Tới $${fee.toLocaleString("en-US")}`,
      questionKey: `annual_fee_tolerance_unknown:${state.profile.id}`,
    });
  }
  if (state.profile.businessCardsAllowed !== null) {
    rows.push({
      label: "Xét thẻ doanh nghiệp",
      value: state.profile.businessCardsAllowed ? "Có" : "Không",
      questionKey: `business_cards_preference_unknown:${state.profile.id}`,
    });
  }
  return rows;
}
