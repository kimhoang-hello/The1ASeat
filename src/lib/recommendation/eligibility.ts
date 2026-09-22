/**
 * §14 — vế ĐỦ ĐIỀU KIỆN: người này có khả năng đáp ứng yêu cầu ngân hàng công
 * bố không.
 *
 * Tách hẳn khỏi PHÙ HỢP (`suitability.ts`). Một người có thể đủ điều kiện cho
 * thẻ phí $799 mà vẫn nói "tối đa $200" — thẻ đó KHÔNG PHÙ HỢP, chứ không phải
 * KHÔNG ĐỦ ĐIỀU KIỆN, và gộp hai thứ lại làm hỏng cả hai hướng: hoặc giấu mất
 * thẻ khỏi người sẵn sàng nghe, hoặc bảo một người rằng ngân hàng sẽ từ chối
 * họ trong khi thật ra chỉ có ví của họ từ chối.
 *
 * BA kết quả, không phải hai. `unknown` là vế bắt buộc, và nó đến từ hai chỗ
 * khác nhau — thiếu dữ liệu, và khoảng thu nhập BẮC QUA ngưỡng. Cả hai đều
 * không được ép thành "trượt": khoảng "60–80K" so với ngưỡng $80,000 bao trùm
 * đúng những người vế đó sinh ra để nhận (§5.3 bàn giao).
 *
 * ĐIỂM TÍN DỤNG KHÔNG PHẢI ĐIỀU KIỆN CỨNG (§3.10). `EligibilityRuleType` không
 * có nhánh nào cho nó và đừng thêm — engine không biết điểm tín dụng của ai,
 * và đoán nó ra rồi loại người là thứ tệ nhất một công cụ như thế này làm được.
 */

import { activeAt } from "./temporal.ts";
import { compareToThreshold, everHeld, holdsNow, asArray } from "./user.ts";
import type { DatasetIndex } from "./indexes.ts";
import { RULE_SHAPES } from "./rule-shapes.ts";
import type { EligibilityRule, ProductId, RuleLookback } from "./types.ts";
import type { UserCard, UserState } from "./user-types.ts";
import type { EligibilityVerdict } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

type RuleOutcome = "pass" | "fail" | "unknown";

/**
 * Vì sao một luật ra `unknown` — bốn nguồn lỗi khác nhau, bốn người sửa khác
 * nhau, mà cùng một chữ `unknown` trên trace:
 *
 *   rule_not_understood — operator ngoài dự kiến: DỮ LIỆU NGUỒN cần sửa;
 *   user_field_missing  — người dùng chưa khai (hoặc từ chối khai): ĐẦU VÀO;
 *   user_range_straddles — khoảng người dùng khai bắc qua ngưỡng: ĐẦU VÀO,
 *                          nhưng hỏi lại cho hẹp hơn thì trả lời được;
 *   not_modelled        — mô hình người dùng không có trường này: ENGINE.
 *
 * Trace từng chỉ ghi `outcome`, nên admin nhìn 17 thẻ "điều kiện unknown" mà
 * không biết nên sửa dữ liệu hay hỏi người dùng (vòng rà Phase 4).
 */
export type RuleUnknownCause =
  | "rule_not_understood"
  | "user_field_missing"
  | "user_range_straddles"
  | "not_modelled";

interface RuleEvaluation {
  outcome: RuleOutcome;
  unknownCause: RuleUnknownCause | null;
}

const known = (outcome: "pass" | "fail"): RuleEvaluation => ({ outcome, unknownCause: null });
const unknown = (cause: RuleUnknownCause): RuleEvaluation => ({ outcome: "unknown", unknownCause: cause });

/** Thu nhập so với ngưỡng — ba kết quả, xem `compareToThreshold`. */
function incomeOutcome(
  amount: { low: number; high: number | null } | null,
  threshold: number,
): RuleEvaluation {
  // Ngưỡng 0 = "đã kiểm và không yêu cầu thu nhập". Đó là một DỮ KIỆN khác hẳn
  // "chưa biết yêu cầu", và nó đúng với mọi người — kể cả người chưa khai.
  if (threshold <= 0) return known("pass");
  // Từ chối nói và chưa hỏi đều dẫn tới `unknown` ở đây; chúng khác nhau ở chỗ
  // §30 còn hỏi lại được cái nào, và `userGaps` đã tách sẵn hai ca đó.
  if (amount == null) return unknown("user_field_missing");
  const verdict = compareToThreshold(amount, threshold);
  return verdict === "at_or_above"
    ? known("pass")
    : verdict === "below"
      ? known("fail")
      : unknown("user_range_straddles");
}

function boolOutcome(value: boolean | null, required: boolean): RuleEvaluation {
  if (value == null) return unknown("user_field_missing");
  return known(value === required ? "pass" : "fail");
}

/**
 * Operator mà KIỂU cho phép nhiều hơn operator có nghĩa với từng loại luật —
 * `minimum_personal_income lte` đọc NGƯỢC hoàn toàn mà không có dấu hiệu nào,
 * và đọc ngược một luật cứng là loại đúng những người đủ điều kiện, hoặc hứa
 * một thẻ ngân hàng sẽ từ chối.
 *
 * Nên: operator ngoài `RULE_SHAPES` thì trả `unknown` — engine nói nó không
 * đánh giá được, §29 hạ độ tin cậy. Bảng đó cũng là bảng validator dùng, nên
 * mọi luật qua được validator đều được engine đánh giá; ca `unknown` ở đây chỉ
 * còn là dữ liệu sai dạng lọt vào mà không qua validator.
 */
function operatorUnderstood(rule: EligibilityRule): boolean {
  return RULE_SHAPES[rule.ruleType]?.operators.includes(rule.operator) ?? false;
}

/**
 * Ngày cách `day` đúng `months` tháng lịch về trước; ngày cuối tháng thì kẹp
 * (31/03 lùi một tháng là 28/02, không phải 03/03).
 */
export function monthsBefore(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const index = year * 12 + (month - 1) - months;
  const y = Math.floor(index / 12);
  const m = index - y * 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(Math.min(date, last)).padStart(2, "0")}`;
}

type WindowHit = "hit" | "clear" | "unknown";

function eitherHit(a: WindowHit, b: WindowHit): WindowHit {
  if (a === "hit" || b === "hit") return "hit";
  return a === "clear" && b === "clear" ? "clear" : "unknown";
}

/**
 * MỘT thẻ người dùng từng giữ có rơi vào cửa sổ của luật không.
 *
 * Mốc nằm ĐÚNG ngày cắt thì tính là trong cửa sổ: nghiêng về phía "không hứa
 * bonus", vì hứa sai tốn của người đọc một đơn mở thẻ, còn thận trọng sai chỉ
 * tốn một câu cảnh báo.
 *
 * Thiếu ngày thì `unknown`, KHÔNG BAO GIỜ `clear` — trừ một suy luận chắc
 * chắn: thẻ đã đóng TRƯỚC ngày cắt thì cũng đã mở trước ngày cắt. Đó là cách
 * câu hỏi "đóng tháng nào" (thứ duy nhất §30 hỏi) trả lời được luật TD® vốn đếm
 * theo ngày MỞ.
 */
function cardInWindow(card: UserCard, lookback: RuleLookback, cutoff: string): WindowHit {
  const current = holdsNow(card);
  const closed = current ? null : card.closedDate;
  const closedHit: WindowHit = current ? "clear" : closed == null ? "unknown" : closed >= cutoff ? "hit" : "clear";
  const openedHit: WindowHit =
    card.openedDate != null
      ? card.openedDate >= cutoff
        ? "hit"
        : "clear"
      : closed != null && closed < cutoff
        ? "clear"
        : "unknown";
  switch (lookback.anchor) {
    case "opened":
      return openedHit;
    case "opened_or_closed":
      return eitherHit(openedHit, closedHit);
    case "held":
      // Đang giữ = đang là chủ thẻ ngay trong cửa sổ, mở từ bao giờ cũng vậy.
      return current ? "hit" : closedHit;
  }
}

function evaluateRule(rule: EligibilityRule, state: UserState, asOf: string): RuleEvaluation {
  const profile = state.profile;
  if (!operatorUnderstood(rule)) return unknown("rule_not_understood");
  switch (rule.ruleType) {
    case "residency": {
      // Không biết người này ở đâu thì KHÔNG được kết luận là trượt. Luật cư
      // trú áp cho MỌI thẻ, nên coi thiếu-dữ-liệu là trượt sẽ loại sạch tập
      // ứng viên và trả về `NO_NEW_CARD` — một khuyến nghị trông có lý, dựng
      // trên một dữ kiện chưa ai hỏi. §14 tách `unknown` khỏi `ineligible`
      // đúng vì chỗ này.
      if (profile?.country == null) return unknown("user_field_missing");
      const listed = (Array.isArray(rule.value) ? rule.value : [String(rule.value)]).includes(profile.country);
      // `not_in`: ngân hàng loại một danh sách nước — trong danh sách là trượt.
      return known(listed === (rule.operator !== "not_in") ? "pass" : "fail");
    }
    case "minimum_personal_income":
      return incomeOutcome(profile?.annualPersonalIncome ?? null, Number(rule.value));
    case "minimum_household_income":
      return incomeOutcome(profile?.annualHouseholdIncome ?? null, Number(rule.value));
    case "business_required":
      // `hasBusiness` (có doanh nghiệp không) chứ KHÔNG phải
      // `businessCardsAllowed` (có muốn xét thẻ doanh nghiệp không). Gộp hai
      // trường đó lại sai theo cả hai hướng — xem README Phase 2.
      return boolOutcome(profile?.hasBusiness ?? null, rule.value === true);
    case "student_status_required":
      return boolOutcome(profile?.isStudent ?? null, rule.value === true);
    case "existing_cardholder_excluded":
      if (asArray(state.cards).some((card) => card?.productId === rule.productId && holdsNow(card))) {
        return known("fail");
      }
      // Không thấy thẻ đó trong danh sách CHƯA KHAI thì chưa biết — không phải
      // "chưa từng giữ". Trống ≠ không (bài học Phase 2, `UserState.declared`).
      return state.declared?.cards === true ? known("pass") : unknown("user_field_missing");
    case "previous_cardholder_excluded":
      // `closed` VÀ `previously_held` ĐỀU là từng giữ. Viết
      // `status === "previously_held"` ở đây là để mọi thẻ đã đóng lọt qua —
      // và hậu quả không phải một lỗi, mà là một khuyến nghị trông hợp lý hứa
      // khoản bonus ngân hàng sẽ từ chối.
      if (asArray(state.cards).some((card) => card?.productId === rule.productId && everHeld(card))) {
        return known("fail");
      }
      return state.declared?.cards === true ? known("pass") : unknown("user_field_missing");
    case "previous_cardholder_within_months": {
      const lookback = rule.lookback;
      const months = Number(rule.value);
      if (lookback == null || lookback.productIds.length === 0 || !Number.isInteger(months) || months <= 0) {
        return unknown("rule_not_understood");
      }
      const counted = new Set<string>(lookback.productIds);
      const cutoff = monthsBefore(asOf, months);
      const hits = asArray(state.cards)
        .filter((card) => card != null && counted.has(card.productId as string) && everHeld(card))
        .map((card) => cardInWindow(card, lookback, cutoff));
      if (hits.includes("hit")) return known("fail");
      // Từng giữ mà không rõ ngày: đây là ca của lỗi 21/09/2026 — TD® Aeroplan®
      // Visa Infinite đã đóng, không rõ ngày, và engine hứa trọn 50,000 điểm.
      // Không đánh giá được thì §29 hạ độ tin cậy và §30 hỏi tháng đóng thẻ.
      if (hits.includes("unknown")) return unknown("user_field_missing");
      return state.declared?.cards === true ? known("pass") : unknown("user_field_missing");
    }
    case "previous_cardholder_same_category": {
      // Điều khoản Aeroplan®: "a maximum of one New Card Bonus for each type of
      // Aeroplan Credit Card …, regardless of issuer" — once-in-a-lifetime theo
      // LOẠI thẻ, xuyên ngân hàng (user chốt 21/09/2026). Từng giữ thẻ cùng
      // loại ở bất kỳ ngân hàng nào là mất bonus, như luật trọn đời của Amex®.
      const lookback = rule.lookback;
      if (lookback == null || lookback.productIds.length === 0 || rule.value !== true) {
        return unknown("rule_not_understood");
      }
      const counted = new Set<string>(lookback.productIds);
      if (asArray(state.cards).some((card) => card != null && counted.has(card.productId as string) && everHeld(card))) {
        return known("fail");
      }
      return state.declared?.cards === true ? known("pass") : unknown("user_field_missing");
    }
    case "banking_relationship_required":
      // Mô hình người dùng không khai quan hệ ngân hàng — §31 không hỏi, nên
      // không có trường nào để đọc. `unknown` là câu trả lời đúng; trả `pass`
      // là bịa ra một dữ kiện, trả `fail` là loại oan.
      return unknown("not_modelled");
  }
}

/**
 * Gộp kết quả của một NHÓM luật (`ruleGroup`).
 *
 * Nhóm là phép HOẶC, và đó là toàn bộ lý do nó tồn tại: ngân hàng Canada công
 * bố điều kiện theo cặp — "$60,000 cá nhân HOẶC $100,000 hộ gia đình" — và vế
 * hộ gia đình sinh ra để NHẬN những người có thu nhập cá nhân dưới ngưỡng.
 * Đọc hai dòng đó như phép VÀ là loại thẳng đúng những người vế kia cứu.
 */
function combineGroup(outcomes: RuleOutcome[]): RuleOutcome {
  if (outcomes.some((outcome) => outcome === "pass")) return "pass";
  if (outcomes.every((outcome) => outcome === "fail")) return "fail";
  return "unknown";
}

/**
 * `unknownRequirements` là các sản phẩm mà LỚP DỮ LIỆU nói là chưa biết điều
 * kiện (`DataGap` `eligibility_unknown`) — 11 thẻ hôm nay.
 *
 * Bắt buộc phải truyền vào, vì không có nó thì phép suy luận ở đây sai theo
 * hướng tệ nhất: luật cư trú áp cho MỌI thẻ, nên một thẻ chỉ có đúng dòng
 * `residency` trông y hệt một thẻ đã kiểm và không có yêu cầu nào khác. Cả hai
 * cùng trả `eligible`, và thẻ chưa ai kiểm điều kiện thoát được cả hình phạt
 * lẫn cảnh báo dành cho chỗ chưa biết. README của Phase 1 đã nói thẳng: "có
 * luật không có nghĩa là đã biết điều kiện".
 */
export function evaluateEligibility(
  productId: ProductId,
  state: UserState,
  ix: DatasetIndex,
  asOf: string,
  unknownRequirements: ReadonlySet<string> = new Set(),
): EligibilityVerdict {
  const rules = activeAt(ix.rulesByProduct.get(productId) ?? [], asOf)
    // Thứ tự cố định cho `failedRuleIds` / `unknownRuleIds` — chúng đi vào
    // debugger của Phase 4, và hai lượt chạy giống nhau phải cho cùng một danh
    // sách.
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const reasonCodes: ReasonCode[] = [];
  const warnings: WarningCode[] = [];
  // HAI cặp danh sách, một cho mỗi cửa: luật chặn MỞ THẺ và luật chỉ chặn
  // BONUS. Chung một cặp thì một thẻ bị loại vì thu nhập được debugger kể thêm
  // luật once-in-a-lifetime — thứ chỉ làm mất bonus (vòng Codex 18).
  const failedRuleIds: string[] = [];
  const unknownRuleIds: string[] = [];
  const welcomeFailedRuleIds: string[] = [];
  const welcomeUnknownRuleIds: string[] = [];

  // Luật `soft` và `unknown` không chặn: chúng là ghi chú, và severity nằm
  // trong dữ liệu đúng vì engine không tự phân biệt được.
  const hard = rules.filter((rule) => rule.severity === "hard");

  const applicationGroups = new Map<string, EligibilityRule[]>();
  const welcomeGroups = new Map<string, EligibilityRule[]>();
  for (const rule of hard) {
    const target = rule.scope === "welcome_offer" ? welcomeGroups : applicationGroups;
    // Luật không thuộc nhóm nào tự là một nhóm một phần tử — phép HOẶC trên
    // một phần tử chính là phép VÀ của nó với phần còn lại.
    const key = rule.ruleGroup ?? `solo:${rule.id}`;
    target.set(key, [...(target.get(key) ?? []), rule]);
  }

  function verdictOf(groups: Map<string, EligibilityRule[]>, failed: string[], unknownIds: string[]): RuleOutcome {
    let sawUnknown = false;
    for (const [, group] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const evaluations = group.map((rule) => evaluateRule(rule, state, asOf));
      const outcomes = evaluations.map((evaluation) => evaluation.outcome);
      const combined = combineGroup(outcomes);
      if (combined === "fail") {
        failed.push(...group.map((rule) => rule.id as string));
        return "fail";
      }
      if (combined === "unknown") {
        sawUnknown = true;
        unknownIds.push(
          ...group
            .filter((_row, index) => outcomes[index] === "unknown")
            .map((rule) => rule.id as string),
        );
        // CHỈ khi khoảng người dùng khai BẮC QUA ngưỡng — đúng nghĩa câu "nằm
        // ngay quanh ngưỡng" trên trang. Bản trước gắn mã này cho MỌI nhóm thu
        // nhập chưa biết, nên người khai $80–150K cá nhân (dưới hẳn $200,000
        // của Avion® Visa Infinite Privilege) mà chưa khai thu nhập hộ được
        // bảo là "có thể đạt" — cái chưa biết là vế hộ gia đình, và
        // ELIGIBILITY_UNCERTAIN đã nói đúng điều đó.
        if (evaluations.some((evaluation) => evaluation.unknownCause === "user_range_straddles")) {
          if (!reasonCodes.includes("INCOME_MAY_NOT_QUALIFY")) {
            reasonCodes.push("INCOME_MAY_NOT_QUALIFY");
          }
        }
      }
    }
    return sawUnknown ? "unknown" : "pass";
  }

  let application = verdictOf(applicationGroups, failedRuleIds, unknownRuleIds);
  const welcome = verdictOf(welcomeGroups, welcomeFailedRuleIds, welcomeUnknownRuleIds);

  // Mọi luật ĐÃ BIẾT đều qua, nhưng lớp dữ liệu nói là chưa biết hết. "Qua hết
  // những gì ta biết" không phải "đủ điều kiện".
  if (application === "pass" && unknownRequirements.has(productId as string)) {
    application = "unknown";
    unknownRuleIds.push(`gap:eligibility_unknown:${productId}`);
  }

  if (application === "unknown") {
    reasonCodes.push("ELIGIBILITY_UNCERTAIN");
    warnings.push("ELIGIBILITY_NOT_VERIFIABLE");
  }

  const welcomeOfferBlocked = welcome === "fail";
  if (welcomeOfferBlocked) {
    reasonCodes.push("WELCOME_BONUS_UNAVAILABLE");
    warnings.push("WELCOME_BONUS_BLOCKED_BY_PAST_CARD");
  }
  // Cửa BONUS chưa biết KHÔNG phải cửa mở. Bản trước chỉ nhìn `fail`, nên
  // người chưa khai thẻ nào được hứa trọn bonus Amex® once-in-a-lifetime — đúng
  // người có thể đã từng giữ thẻ đó (vòng Codex 18).
  const welcomeOfferUncertain = welcome === "unknown";
  if (welcomeOfferUncertain) {
    reasonCodes.push("WELCOME_BONUS_UNCERTAIN");
    warnings.push("WELCOME_BONUS_NOT_VERIFIABLE");
  }

  return {
    status: application === "fail" ? "ineligible" : application === "unknown" ? "unknown" : "eligible",
    welcomeOfferBlocked,
    welcomeOfferUncertain,
    reasonCodes,
    warnings,
    failedRuleIds,
    unknownRuleIds,
    welcomeFailedRuleIds,
    welcomeUnknownRuleIds,
    // MỌI luật, đánh giá bằng CHÍNH `evaluateRule` ở trên — không phải một
    // phép đánh giá thứ hai viết cho debugger. `verdictOf` dừng ở nhóm trượt
    // đầu tiên, nên `failedRuleIds` một mình không kể được các nhóm sau; bảng
    // này thì kể hết, kể cả luật `soft` không chặn.
    rules: rules.map((rule) => ({
      ruleId: rule.id as string,
      ruleType: rule.ruleType,
      operator: rule.operator,
      value: rule.value,
      severity: rule.severity,
      scope: rule.scope,
      ruleGroup: rule.ruleGroup,
      ...evaluateRule(rule, state, asOf),
    })),
  };
}
