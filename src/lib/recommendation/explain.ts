/**
 * §19 Explainability + §30 Missing Information Strategy.
 *
 * Hai việc trông không liên quan, nằm chung một file vì chúng là hai nửa của
 * cùng một câu hỏi: engine BIẾT gì, và nó KHÔNG biết gì. §19 trình bày vế đầu
 * ("vì sao thẻ này thắng"), §30 biến vế sau thành đúng MỘT câu hỏi tiếp theo.
 *
 * §27 nói logic phát ra MÃ, không phát ra câu tiếng Việt. Nên ở đây cũng không
 * có câu tiếng Việt nào dành cho người đọc — chỉ có mã, thứ tự của chúng, và
 * bảng số. Phase 5 và Phase 6 dịch.
 */

import { REASON_CODES, WARNING_CODES } from "./reason-codes.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";
import type { Candidate, FollowUpQuestion, ScoreComponent } from "./engine-types.ts";
import type { UserDataGap } from "./user-types.ts";

const REASON_ORDER = new Map(REASON_CODES.map((code, index) => [code, index]));
const WARNING_ORDER = new Map(WARNING_CODES.map((code, index) => [code, index]));

/**
 * Gộp mã lại, bỏ trùng, và sắp theo THỨ TỰ KHAI BÁO của `reason-codes.ts`.
 *
 * Sắp theo thứ tự khai báo chứ không theo thứ tự phát ra: thứ tự phát ra là
 * thứ tự các khối code chạy, nên sắp lại một khối trong `rules.ts` sẽ đổi thứ
 * tự lời giải thích mà không đổi gì về nội dung. Cùng một lượt chạy phải cho
 * cùng một chuỗi, tới từng phần tử.
 */
export function mergeReasonCodes(...groups: readonly (readonly ReasonCode[])[]): ReasonCode[] {
  const seen = new Set<ReasonCode>();
  for (const group of groups) for (const code of group) seen.add(code);
  return [...seen].sort((a, b) => (REASON_ORDER.get(a) ?? 0) - (REASON_ORDER.get(b) ?? 0));
}

export function mergeWarnings(...groups: readonly (readonly WarningCode[])[]): WarningCode[] {
  const seen = new Set<WarningCode>();
  for (const group of groups) for (const code of group) seen.add(code);
  return [...seen].sort((a, b) => (WARNING_ORDER.get(a) ?? 0) - (WARNING_ORDER.get(b) ?? 0));
}

/**
 * Bảng "vì sao thẻ này thắng" của §19, sắp theo đóng góp giảm dần.
 *
 * Trả về DỮ LIỆU, không trả về chuỗi đã định dạng: §22 cần nó cho bảng admin,
 * Phase 6 cần nó cho câu tiếng Việt, và cả hai cần cùng những con số.
 */
export function scoreTable(candidate: Candidate): ScoreComponent[] {
  return [...candidate.components].sort((a, b) =>
    b.contribution !== a.contribution
      ? b.contribution - a.contribution
      : a.key < b.key
        ? -1
        : 1,
  );
}

/* ------------------------------------------------------------------ *
 * §30 — câu hỏi tiếp theo đáng giá nhất
 * ------------------------------------------------------------------ */

/**
 * Thứ tự giá trị của các chỗ trống.
 *
 * Số nhỏ hơn = hỏi trước. Đây là một BẢNG chứ không phải một chuỗi `if`, vì
 * §30 nói rõ ý định: "identify the highest-value follow-up question" — tức là
 * một phép chọn có xếp hạng, và một chuỗi `if` giấu mất thứ hạng vào thứ tự
 * dòng code.
 *
 * Hai `kind` CỐ Ý vắng mặt: `personal_income_declined` và
 * `household_income_declined`. Chúng là câu trả lời "tôi không muốn nói", và
 * đem chúng ra hỏi lại là hỏi đúng điều người dùng vừa từ chối. Phase 2 tách
 * chúng khỏi "chưa hỏi" đúng vì chỗ này.
 */
const QUESTION_PRIORITY: Partial<Record<UserDataGap["kind"], number>> = {
  goal_missing: 0,
  goal_priority_ambiguous: 1,
  // Ngay sau mục tiêu: một câu trả lời gỡ được TOÀN BỘ tập ứng viên khỏi
  // trạng thái "chưa đánh giá được".
  country_unknown: 2,
  trip_cabin_unknown: 3,
  trip_passengers_unknown: 4,
  trip_round_trip_unknown: 5,
  cards_undeclared: 6,
  balances_undeclared: 7,
  minimum_spend_capacity_unknown: 8,
  spend_profile_missing: 9,
  personal_income_unknown: 10,
  household_income_unknown: 11,
  business_cards_preference_unknown: 12,
  point_balance_amount_unknown: 13,
  annual_fee_tolerance_unknown: 14,
  spend_category_unknown: 15,
  card_closed_date_unknown: 16,
  business_ownership_unknown: 17,
  student_status_unknown: 18,
  trip_dates_unknown: 19,
  trip_flexibility_unknown: 20,
};

export interface FollowUpInput {
  gaps: readonly UserDataGap[];
  ranked: readonly Candidate[];
  /**
   * Bảng của TỪNG mục tiêu khi nhiều mục tiêu hoà nhau chạy song song. Vắng
   * thì chỉ có `ranked`. Mọi bộ lọc bên dưới hỏi "có mục tiêu NÀO…": thẻ
   * doanh nghiệp thắng ở mục tiêu thứ hai vẫn là lý do để hỏi về thẻ doanh
   * nghiệp (vòng Codex 9).
   */
  rankings?: readonly (readonly Candidate[])[];
  /** Id các sản phẩm là thẻ DOANH NGHIỆP — xem `nextQuestion`. */
  businessProductIds?: ReadonlySet<string>;
  /**
   * Đo giá trị THẬT của một câu hỏi: tỷ lệ câu trả lời thử ĐỔI ĐƯỢC người
   * thắng, 0..1, hoặc `null` khi không đo được. Xem `sensitivity.ts`.
   *
   * Tuỳ chọn: vắng nó thì chỉ còn bảng ưu tiên tĩnh — đúng hành vi trước Phase
   * 4, và đúng thứ các lượt chạy thử bên trong phép đo dùng (một phép đo không
   * được tự đo chính nó).
   */
  measure?: (gap: UserDataGap) => number | null;
}

/**
 * Chỗ trống GÁC CỔNG cả lượt chạy — hỏi trước mọi câu khác, không đo.
 *
 * Không có mục tiêu thì không có gì để khuyên; không biết nước ở thì cả tập
 * ứng viên chưa đánh giá được; chưa khai thẻ/số dư thì engine có thể đang
 * khuyên đúng cái thẻ người dùng đang cầm. Giá trị của chúng không đo được
 * bằng câu trả lời thử (không có "thẻ đang giữ điển hình" nào), nên chúng giữ
 * nguyên chỗ trong bảng ưu tiên.
 */
const GATEKEEPERS: ReadonlySet<UserDataGap["kind"]> = new Set([
  "goal_missing",
  "goal_priority_ambiguous",
  "country_unknown",
  "cards_undeclared",
  "balances_undeclared",
]);

/**
 * Chỗ trống được ĐẨY LÊN ĐẦU vì chính khuyến nghị hiện tại phụ thuộc vào nó.
 *
 * §30 nói hỏi câu "highest-value", và giá trị của một câu hỏi không cố định —
 * nó phụ thuộc thẻ nào đang thắng. Ngưỡng phí là câu hỏi hạng 14 với người
 * được khuyên một thẻ $0, và là câu hỏi QUAN TRỌNG NHẤT với người đang được
 * khuyên một thẻ $799 mà chưa khai ngưỡng nào.
 */
const URGENT = -1;

/**
 * Một câu hỏi, hoặc `null` khi không câu nào đổi được kết quả.
 *
 * Hai bộ lọc trước khi xếp hạng, và cả hai đều là "đừng hỏi thứ không ai đọc":
 *
 *  1. Chỗ trống không có trong bảng ưu tiên thì không hỏi. Bảng là danh sách
 *     TRẮNG, nên một `kind` mới thêm vào Phase 2 sẽ im lặng cho tới khi có
 *     người quyết định nó đáng hỏi ở vị trí nào — an toàn hơn là tự động chen
 *     vào cuối hàng đợi và đẩy một câu hữu ích ra.
 *  2. Câu về thu nhập chỉ đáng hỏi khi CÓ một ứng viên đang vướng điều kiện.
 *     Người đã đủ điều kiện cho mọi thẻ trong bảng thì con số thu nhập của họ
 *     không đổi được gì, và hỏi nó là tiêu mất suất câu hỏi duy nhất.
 */
export function nextQuestion(input: FollowUpInput): FollowUpQuestion | null {
  const rankings = input.rankings ?? [input.ranked];
  const eligibilityUncertain = rankings.some((ranked) =>
    ranked.some((candidate) => candidate.eligibility?.status === "unknown"),
  );
  // Hỏi về thẻ doanh nghiệp khi và chỉ khi một thẻ doanh nghiệp đang trong
  // bảng. Bản đầu suy điều đó từ mã `ELIGIBILITY_UNCERTAIN` — một mã dùng
  // chung cho mọi loại điều kiện chưa rõ — nên nó hỏi nhầm khi một thẻ thường
  // thiếu thông tin thu nhập, và im lặng khi một thẻ doanh nghiệp đủ điều kiện
  // đang đứng đầu.
  const businessIds = input.businessProductIds ?? new Set<string>();
  const businessCandidateInPlay = rankings.some((ranked) =>
    ranked
      .slice(0, 5)
      .some((candidate) => candidate.productId !== null && businessIds.has(candidate.productId)),
  );

  const usable = input.gaps.filter((gap) => {
    if (QUESTION_PRIORITY[gap.kind] === undefined) return false;
    if (
      (gap.kind === "personal_income_unknown" || gap.kind === "household_income_unknown") &&
      !eligibilityUncertain
    ) {
      return false;
    }
    if (gap.kind === "business_cards_preference_unknown" && !businessCandidateInPlay) return false;
    return true;
  });

  if (usable.length === 0) return null;

  // Thẻ thắng cuộc đang dựa vào một dữ kiện chưa ai hỏi thì hỏi CHÍNH nó —
  // người thắng của MỌI mục tiêu đang chạy.
  const urgent = new Set<UserDataGap["kind"]>();
  for (const winner of rankings.map((ranked) => ranked[0]).filter((row) => row !== undefined)) {
    // Phí cao mà chưa khai ngưỡng: `suitability.ts` đã hạ điểm và phát mã, và
    // câu hỏi này là thứ duy nhất biến phỏng đoán đó thành một câu trả lời.
    if (winner.reasonCodes.includes("ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN")) {
      urgent.add("annual_fee_tolerance_unknown");
    }
    // Thẻ doanh nghiệp đang thắng mà chưa biết người này có doanh nghiệp
    // không: `business_required` là luật CỨNG, nên câu trả lời "không" xoá
    // thẻ này khỏi bảng hoàn toàn.
    if (winner.productId !== null && businessIds.has(winner.productId)) {
      urgent.add("business_ownership_unknown");
    }
  }

  /*
   * Ba tầng, theo thứ tự:
   *
   *   1. Chỗ trống gác cổng (`GATEKEEPERS`) — theo bảng ưu tiên.
   *   2. Câu hỏi ĐO ĐƯỢC là đổi được người thắng — câu đổi được nhiều câu trả
   *      lời thử nhất lên trước. §30 nói đúng thế: "if missing information
   *      could materially change the recommendation".
   *   3. Mọi câu còn lại — theo bảng ưu tiên, câu khẩn lên đầu.
   *
   * Tầng 2 KHÔNG thay bảng ưu tiên, nó đặt lên trên: khi không câu nào đổi
   * được gì, hành vi y hệt trước. Và phép đo chỉ chạy cho những câu đã qua hai
   * bộ lọc ở trên — không đo thu nhập khi không thẻ nào vướng điều kiện.
   */
  const measured = new Map<UserDataGap, number>();
  if (input.measure !== undefined) {
    for (const gap of usable) {
      if (GATEKEEPERS.has(gap.kind)) continue;
      const value = input.measure(gap);
      if (value !== null && value > 0) measured.set(gap, value);
    }
  }
  const tier = (gap: UserDataGap) => (GATEKEEPERS.has(gap.kind) ? 0 : measured.has(gap) ? 1 : 2);
  const best = [...usable].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 1) {
      const va = measured.get(a) as number;
      const vb = measured.get(b) as number;
      if (va !== vb) return vb - va;
    }
    const pa = urgent.has(a.kind) ? URGENT : (QUESTION_PRIORITY[a.kind] as number);
    const pb = urgent.has(b.kind) ? URGENT : (QUESTION_PRIORITY[b.kind] as number);
    if (pa !== pb) return pa - pb;
    // Cùng loại thì theo `subject`: hai hạng mục chi tiêu chưa biết phải cho
    // ra cùng một câu hỏi ở mọi lượt chạy.
    return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
  })[0];

  const basis: FollowUpQuestion["basis"] = GATEKEEPERS.has(best.kind)
    ? "gatekeeper"
    : measured.has(best)
      ? "measured"
      : urgent.has(best.kind)
        ? "urgent"
        : "priority";
  return {
    gapKind: best.kind,
    subject: best.subject,
    reason: best.reason,
    basis,
    flipShare: basis === "measured" ? (measured.get(best) as number) : null,
  };
}
