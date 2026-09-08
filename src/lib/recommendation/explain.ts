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
  /** Id các sản phẩm là thẻ DOANH NGHIỆP — xem `nextQuestion`. */
  businessProductIds?: ReadonlySet<string>;
}

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
  const eligibilityUncertain = input.ranked.some(
    (candidate) => candidate.eligibility?.status === "unknown",
  );
  // Hỏi về thẻ doanh nghiệp khi và chỉ khi một thẻ doanh nghiệp đang trong
  // bảng. Bản đầu suy điều đó từ mã `ELIGIBILITY_UNCERTAIN` — một mã dùng
  // chung cho mọi loại điều kiện chưa rõ — nên nó hỏi nhầm khi một thẻ thường
  // thiếu thông tin thu nhập, và im lặng khi một thẻ doanh nghiệp đủ điều kiện
  // đang đứng đầu.
  const businessIds = input.businessProductIds ?? new Set<string>();
  const businessCandidateInPlay = input.ranked
    .slice(0, 5)
    .some((candidate) => candidate.productId !== null && businessIds.has(candidate.productId));

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

  const best = [...usable].sort((a, b) => {
    const pa = QUESTION_PRIORITY[a.kind] as number;
    const pb = QUESTION_PRIORITY[b.kind] as number;
    if (pa !== pb) return pa - pb;
    // Cùng loại thì theo `subject`: hai hạng mục chi tiêu chưa biết phải cho
    // ra cùng một câu hỏi ở mọi lượt chạy.
    return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
  })[0];

  return { gapKind: best.kind, subject: best.subject, reason: best.reason };
}
