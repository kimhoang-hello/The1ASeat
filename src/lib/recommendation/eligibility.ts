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
import type { EligibilityRule, ProductId } from "./types.ts";
import type { UserState } from "./user-types.ts";
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

function evaluateRule(rule: EligibilityRule, state: UserState): RuleEvaluation {
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
      const outcomes = group.map((rule) => evaluateRule(rule, state).outcome);
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
        if (group.some((rule) => rule.ruleType.endsWith("_income"))) {
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
      ...evaluateRule(rule, state),
    })),
  };
}
