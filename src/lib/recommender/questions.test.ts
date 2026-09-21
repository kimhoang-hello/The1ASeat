/**
 * Hợp đồng của bảng câu hỏi — hai luật ở đầu `questions.ts`, mỗi luật một bài
 * ĐỎ ĐƯỢC:
 *
 *  1. mọi lựa chọn cho ra hồ sơ `validateUserState` không báo lỗi;
 *  2. trả lời xong thì chính chỗ trống đó biến mất.
 *
 * Luật 2 là thứ chặn vòng lặp: một lựa chọn không xoá được chỗ trống của nó sẽ
 * làm engine hỏi lại đúng câu vừa trả lời, mãi mãi. Bài cuối cùng chạy nguyên
 * một phiên trả lời tự động và đòi nó DỪNG.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { offlineDataset } from "../recommendation/data/index.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import { userGaps } from "../recommendation/user-gaps.ts";
import { validateUserState } from "../recommendation/user-validate.ts";
import type { UserDataGap, UserState } from "../recommendation/user-types.ts";
import {
  applyAnswer,
  applyAnswerChecked,
  isQuestionKind,
  publicQuestionKey,
  questionFromKey,
  goalFrom,
  newUserState,
  questionFor,
  questionKey,
  type AnswerForm,
  type QuestionContext,
  type QuestionSpec,
} from "./questions.ts";
import { GOAL_OPTIONS } from "./questions.ts";

const TODAY = "2026-09-15";
const DATA = datasetAt(offlineDataset(), TODAY);
const CTX: QuestionContext = { dataset: DATA, today: TODAY };

function form(values: Record<string, string | string[]>): AnswerForm {
  return {
    get: (name) => {
      const value = values[name];
      return typeof value === "string" ? value : null;
    },
    getAll: (name) => {
      const value = values[name];
      return Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    },
  };
}

/** Mọi cách trả lời một câu hỏi — đúng những gì người dùng bấm được. */
function answerSets(spec: QuestionSpec): Record<string, string | string[]>[] {
  switch (spec.input.type) {
    case "choice":
      // Lựa chọn `terminal` không ghi gì vào hồ sơ — trang xử lý riêng, và có
      // bài kiểm riêng ở dưới.
      return spec.input.options
        .filter((option) => option.terminal !== true)
        .map((option) => ({ answer: option.value }));
    case "number": {
      const { min, max } = spec.input;
      return [{ answer: String(min) }, { answer: String(Math.min(max, 2)) }, { answer: String(max) }];
    }
    case "month":
      return [{ month: spec.input.months[0].value }, { month: spec.input.months.at(-1)!.value }];
    case "cards": {
      const all = spec.input.groups.flatMap((group) => group.cards.map((card) => card.value));
      return [
        // "Chưa có thẻ nào" — đúng ca Test A, và là câu trả lời mà một mảng
        // rỗng KHÔNG kể được nếu thiếu `declared`.
        {},
        { holding: [all[0]] },
        { holding: all.slice(0, 3), closed: all.slice(3, 5) },
        // Cùng một thẻ ở cả hai danh sách: người dùng bấm nhầm, và validator
        // cấm hai dòng đang-giữ cho một sản phẩm.
        { holding: [all[0]], closed: [all[0]] },
      ];
    }
    case "programs": {
      const all = spec.input.programs.map((row) => row.value);
      return [{}, { programs: [all[0]] }, { programs: all }];
    }
  }
}

function stateWithGoal(goalValue: string): UserState {
  const state = newUserState("u_test", TODAY, "CA");
  const goal = goalFrom(goalValue, "u_test", TODAY);
  assert.ok(goal !== null, `mục tiêu ${goalValue} dựng được`);
  state.goals = [goal];
  return state;
}

/** Hồ sơ đủ khác nhau để sinh ra MỌI loại chỗ trống hỏi được. */
function seeds(): UserState[] {
  // Hồ sơ vừa dựng, chưa chọn mục tiêu — trạng thái của người vừa bấm vào
  // trang, và nguồn duy nhất của `goal_missing`.
  const rows = [newUserState("u_test", TODAY, "CA"), ...GOAL_OPTIONS.map((option) => stateWithGoal(option.value))];
  // Thêm một hồ sơ đã khai thẻ đã đóng — nguồn duy nhất của
  // `card_closed_date_unknown`.
  const closed = stateWithGoal("next_card");
  const spec = questionFor({ kind: "cards_undeclared", subject: "u_test" }, closed, CTX);
  assert.ok(spec !== null);
  const all = spec.input.type === "cards" ? spec.input.groups.flatMap((g) => g.cards) : [];
  const applied = applyAnswer(closed, spec, form({ closed: [all[0].value] }), CTX);
  assert.ok(applied.ok);
  rows.push(applied.state);
  // Và một hồ sơ đã khai có điểm — nguồn của `point_balance_amount_unknown`.
  const balances = stateWithGoal("trip:SEA_VIETNAM");
  const balanceSpec = questionFor({ kind: "balances_undeclared", subject: "u_test" }, balances, CTX);
  assert.ok(balanceSpec !== null);
  const programs = balanceSpec.input.type === "programs" ? balanceSpec.input.programs : [];
  const withBalances = applyAnswer(balances, balanceSpec, form({ programs: [programs[0].value] }), CTX);
  assert.ok(withBalances.ok);
  rows.push(withBalances.state);
  // Hồ sơ đã khai chi tiêu: mở ra `spend_category_unknown` và
  // `monthly_total_unknown`.
  const spend = stateWithGoal("earn_points");
  const spendSpec = questionFor({ kind: "spend_profile_missing", subject: "u_test" }, spend, CTX);
  assert.ok(spendSpec !== null);
  const withSpend = applyAnswer(spend, spendSpec, form({ answer: "2500-5000" }), CTX);
  assert.ok(withSpend.ok);
  rows.push(withSpend.state);
  return rows;
}

const SEEDS = seeds();

/** Chỗ trống hỏi được của một hồ sơ, không trùng lặp theo `key`. */
function askable(state: UserState): { gap: UserDataGap; spec: QuestionSpec }[] {
  const rows: { gap: UserDataGap; spec: QuestionSpec }[] = [];
  for (const gap of userGaps(state)) {
    const spec = questionFor(gap, state, CTX);
    if (spec !== null) rows.push({ gap, spec });
  }
  return rows;
}

test("mọi chỗ trống hỏi được đều có câu hỏi, và câu hỏi nào cũng có lựa chọn", () => {
  const seen = new Set<UserDataGap["kind"]>();
  for (const state of SEEDS) {
    for (const { gap, spec } of askable(state)) {
      seen.add(gap.kind);
      assert.equal(spec.key, questionKey(gap.kind, gap.subject));
      assert.ok(spec.title.length > 0, `${gap.kind}: thiếu câu hỏi`);
      assert.ok(spec.help.length > 0, `${gap.kind}: thiếu lời giải thích vì sao hỏi`);
      assert.ok(answerSets(spec).length > 0, `${gap.kind}: không có cách nào trả lời`);
    }
  }
  // Bộ hồ sơ mẫu phải chạm tới mọi loại câu hỏi mà giao diện có thể gặp — nếu
  // không, những bài dưới đây đang kiểm một phần và tưởng là kiểm cả.
  const expected: UserDataGap["kind"][] = [
    "goal_missing",
    "cards_undeclared",
    "balances_undeclared",
    "point_balance_amount_unknown",
    "minimum_spend_capacity_unknown",
    "spend_profile_missing",
    "spend_category_unknown",
    "personal_income_unknown",
    "household_income_unknown",
    "annual_fee_tolerance_unknown",
    "business_cards_preference_unknown",
    "business_ownership_unknown",
    "student_status_unknown",
    "trip_cabin_unknown",
    "trip_passengers_unknown",
    "trip_round_trip_unknown",
    "trip_flexibility_unknown",
    "trip_dates_unknown",
    "card_closed_date_unknown",
  ];
  for (const kind of expected) assert.ok(seen.has(kind), `bộ hồ sơ mẫu không sinh ra "${kind}"`);
});

test("hồ sơ đến từ nơi khác — có phần chi tiêu mà chưa có tổng tháng — vẫn hỏi được", () => {
  // Luồng của trang không tạo ra trạng thái này (câu "chi tiêu" ghi luôn tổng
  // tháng), nhưng hồ sơ trong database sống lâu hơn một phiên bản giao diện.
  const state = stateWithGoal("earn_points");
  state.spend = {
    userId: state.profile.id,
    monthlyTotal: null,
    byCategory: {},
    minimumSpendCapacity3m: null,
    updatedAt: TODAY,
  };
  const gap = userGaps(state).find((row) => row.kind === "monthly_total_unknown");
  assert.ok(gap !== undefined);
  const spec = questionFor(gap, state, CTX);
  assert.ok(spec !== null);
  const applied = applyAnswer(state, spec, form(answerSets(spec)[0]), CTX);
  assert.ok(applied.ok);
  assert.ok(userGaps(applied.state).every((row) => row.kind !== "monthly_total_unknown"));
});

test("mọi lựa chọn cho ra hồ sơ HỢP LỆ", () => {
  for (const state of SEEDS) {
    for (const { spec } of askable(state)) {
      for (const values of answerSets(spec)) {
        const applied = applyAnswer(state, spec, form(values), CTX);
        assert.ok(applied.ok, `${spec.key} ${JSON.stringify(values)}: ${applied.ok ? "" : applied.error}`);
        const errors = validateUserState(applied.state, DATA).filter((issue) => issue.level === "error");
        assert.deepEqual(
          errors.map((issue) => `${issue.entity}: ${issue.message}`),
          [],
          `${spec.key} ${JSON.stringify(values)} sinh hồ sơ hỏng`,
        );
      }
    }
  }
});

test("trả lời xong thì CHÍNH chỗ trống đó biến mất", () => {
  for (const state of SEEDS) {
    for (const { gap, spec } of askable(state)) {
      for (const values of answerSets(spec)) {
        const applied = applyAnswer(state, spec, form(values), CTX);
        assert.ok(applied.ok);
        const still = userGaps(applied.state).some(
          (row) => row.kind === gap.kind && row.subject === gap.subject,
        );
        assert.equal(still, false, `${spec.key} ${JSON.stringify(values)}: chỗ trống vẫn còn → hỏi lại mãi`);
      }
    }
  }
});

test("áp câu trả lời KHÔNG sửa hồ sơ được truyền vào", () => {
  const state = stateWithGoal("trip:JAPAN");
  const before = JSON.stringify(state);
  const spec = questionFor({ kind: "trip_cabin_unknown", subject: "g_1" }, state, CTX);
  assert.ok(spec !== null);
  const applied = applyAnswer(state, spec, form({ answer: "business" }), CTX);
  assert.ok(applied.ok);
  assert.equal(JSON.stringify(state), before);
  assert.equal(applied.state.goals[0].type === "trip" && applied.state.goals[0].cabin, "business");
});

test("giá trị lạ bị từ chối, không lặng lẽ ghi vào hồ sơ", () => {
  const state = stateWithGoal("next_card");
  const cases: [UserDataGap["kind"], string, Record<string, string | string[]>][] = [
    ["annual_fee_tolerance_unknown", "u_test", { answer: "999" }],
    ["student_status_unknown", "u_test", { answer: "maybe" }],
    ["country_unknown", "u_test", { answer: "vn" }],
    ["cards_undeclared", "u_test", { holding: ["khong-co-that"] }],
    ["balances_undeclared", "u_test", { programs: ["khong-co-that"] }],
    ["goal_missing", "u_test", { answer: "trip:MARS" }],
  ];
  for (const [kind, subject, values] of cases) {
    const spec = questionFor({ kind, subject }, state, CTX);
    assert.ok(spec !== null, kind);
    const applied = applyAnswer(state, spec, form(values), CTX);
    assert.equal(applied.ok, false, `${kind} nhận giá trị lạ`);
  }
});

test("hồ sơ mới LUÔN có nước ở — không tồn tại trạng thái 'chưa hỏi' hợp lệ", () => {
  // Validator từ chối `country: null`, nên màn hình đầu phải hỏi trước khi
  // dựng hồ sơ. Bài này là thứ đỏ lên nếu ai đó đổi `newUserState` thành mặc
  // định im lặng.
  const state = newUserState("u_test", TODAY, "CA");
  assert.equal(state.profile.country, "CA");
  assert.deepEqual(
    validateUserState(state, DATA).filter((issue) => issue.level === "error"),
    [],
  );
});

test("người ở nước khác KHÔNG bị ghi thành Canada", () => {
  // Trang nói thẳng là công cụ chỉ phục vụ thẻ Canada; điều duy nhất không
  // được làm là im lặng coi họ như người ở Canada.
  const state = stateWithGoal("next_card");
  const spec = questionFor({ kind: "country_unknown", subject: "u_test" }, state, CTX);
  assert.ok(spec !== null);
  const applied = applyAnswer(state, spec, form({ answer: "other" }), CTX);
  assert.equal(applied.ok, false);
});

test("một phiên trả lời hết mọi câu sẽ DỪNG, và hồ sơ cuối vẫn hợp lệ", () => {
  for (const goal of ["next_card", "trip:SEA_VIETNAM"]) {
    let state = stateWithGoal(goal);
    let steps = 0;
    for (;;) {
      const rows = askable(state);
      if (rows.length === 0) break;
      steps += 1;
      assert.ok(steps < 60, `${goal}: bảng câu hỏi không dừng (còn ${rows.length} câu)`);
      const { spec } = rows[0];
      const applied = applyAnswer(state, spec, form(answerSets(spec)[1] ?? answerSets(spec)[0]), CTX);
      assert.ok(applied.ok, `${spec.key}: ${applied.ok ? "" : applied.error}`);
      state = applied.state;
    }
    const errors = validateUserState(state, DATA).filter((issue) => issue.level === "error");
    assert.deepEqual(errors.map((issue) => issue.message), []);
  }
});

test("khoá câu hỏi lạ bị từ chối trước khi dựng câu hỏi", () => {
  // `?sua=` đi qua URL, và form đi qua mạng: cả hai đều là chuỗi người lạ gõ.
  const state = stateWithGoal("next_card");
  for (const key of ["", ":", "linh-tinh:x", "goal_missing", "goal_missing:", "__proto__:x"]) {
    assert.equal(questionFromKey(key, state, CTX), null, JSON.stringify(key));
  }
  assert.ok(questionFromKey("cards_undeclared:u_test", state, CTX) !== null);
  assert.equal(isQuestionKind("cards_undeclared"), true);
  assert.equal(isQuestionKind("toString"), false);
});

test("câu trả lời hợp lệ mà MÂU THUẪN với câu đã khai thì bị chặn TRƯỚC khi lưu", () => {
  // Thu nhập hộ gia đình không thể thấp hơn thu nhập cá nhân — validator từ
  // chối. Ghi xuống database rồi mới phát hiện thì mọi lần mở trang sau đều
  // nổ trên chính hàng đã lưu.
  const state = stateWithGoal("next_card");
  state.profile.annualHouseholdIncome = { low: 60_000, high: 80_000 };
  const spec = questionFor({ kind: "personal_income_unknown", subject: "u_test" }, state, CTX);
  assert.ok(spec !== null);
  const validate = (candidate: UserState) => validateUserState(candidate, DATA);
  const blocked = applyAnswerChecked(state, spec, form({ answer: "150000-" }), CTX, validate);
  assert.equal(blocked.ok, false);
  const fine = applyAnswerChecked(state, spec, form({ answer: "0-60000" }), CTX, validate);
  assert.equal(fine.ok, true);
});

test("số người bay ghi ĐÚNG con số, không dồn về một trần", () => {
  const state = stateWithGoal("trip:SEA_VIETNAM");
  const spec = questionFor({ kind: "trip_passengers_unknown", subject: "g_1" }, state, CTX);
  assert.ok(spec !== null && spec.input.type === "number");
  for (const count of [1, 5, 9]) {
    const applied = applyAnswer(state, spec, form({ answer: String(count) }), CTX);
    assert.ok(applied.ok);
    const goal = applied.state.goals[0];
    assert.equal(goal.type === "trip" && goal.passengers, count);
  }
});

test("đổi ý về câu thu nhập: cờ 'không muốn trả lời' và con số không bao giờ cùng tồn tại", () => {
  // Validator cấm khai cả hai. Không xoá vế kia khi đổi ý thì người dùng kẹt
  // vĩnh viễn ở đúng câu này (Codex vòng 2, Phase 5 UI).
  const state = stateWithGoal("next_card");
  const spec = questionFor({ kind: "personal_income_unknown", subject: "u_test" }, state, CTX);
  assert.ok(spec !== null);
  const declined = applyAnswer(state, spec, form({ answer: "decline" }), CTX);
  assert.ok(declined.ok);
  assert.equal(declined.state.profile.personalIncomeDeclined, true);
  assert.equal(declined.state.profile.annualPersonalIncome, null);

  const changed = applyAnswer(declined.state, spec, form({ answer: "80000-150000" }), CTX);
  assert.ok(changed.ok);
  assert.equal(changed.state.profile.personalIncomeDeclined, false);
  // Nấc thu nhập mở ở đầu trên: "$80,000 – $150,000" không chạm ngưỡng $150,000.
  assert.deepEqual(changed.state.profile.annualPersonalIncome, { low: 80_000, high: 149_999 });
  assert.deepEqual(
    validateUserState(changed.state, DATA).filter((issue) => issue.level === "error"),
    [],
  );
});

test("khoá đi ra URL KHÔNG mang id phiên", () => {
  // `profile.id` chính là id trong cookie: lọt vào URL là lọt vào lịch sử
  // trình duyệt, access log và Google Analytics.
  const state = stateWithGoal("next_card");
  const key = publicQuestionKey("annual_fee_tolerance_unknown", "u_test", "u_test");
  assert.equal(key, "annual_fee_tolerance_unknown:toi");
  assert.ok(!key.includes("u_test"));
  // Và khoá đó vẫn mở đúng câu hỏi của chính người đang đăng nhập.
  assert.ok(questionFromKey(key, state, CTX) !== null);
});

test('nút "chưa có gì" thắng mọi ô đã tick trong cùng form', () => {
  // Nút nằm cùng form với danh sách, nên trình duyệt vẫn gửi các ô đang tick.
  // Không có cờ ghi đè thì máy chủ lưu đúng những thẻ người dùng vừa đổi ý bỏ.
  const state = stateWithGoal("next_card");
  const cards = questionFor({ kind: "cards_undeclared", subject: "u_test" }, state, CTX);
  assert.ok(cards !== null && cards.input.type === "cards");
  const someCard = cards.input.groups[0].cards[0].value;
  const applied = applyAnswer(state, cards, form({ none: "1", holding: [someCard] }), CTX);
  assert.ok(applied.ok);
  assert.deepEqual(applied.state.cards, []);
  assert.equal(applied.state.declared.cards, true);

  const balances = questionFor({ kind: "balances_undeclared", subject: "u_test" }, state, CTX);
  assert.ok(balances !== null && balances.input.type === "programs");
  const program = balances.input.programs[0].value;
  const noPoints = applyAnswer(state, balances, form({ none: "1", programs: [program] }), CTX);
  assert.ok(noPoints.ok);
  assert.deepEqual(noPoints.state.balances, []);
  assert.equal(noPoints.state.declared.balances, true);
});

test("?loi= chỉ in câu lỗi trang tự phát ra — không in chữ tuỳ ý, không chép giá trị form", async () => {
  const { knownError, RECO_ERROR } = await import("./errors.ts");
  assert.equal(knownError("Gọi 1-800-xxx để nhận thưởng"), null);
  assert.equal(knownError(null), null);
  for (const message of Object.values(RECO_ERROR)) assert.equal(knownError(message), message);

  // Câu lỗi THẬT của `applyAnswer` phải qua được danh sách — kể cả khi form
  // gửi slug bịa: câu lỗi không được mang slug đó theo.
  const state = stateWithGoal("next_card");
  const spec = questionFor({ kind: "cards_undeclared", subject: "u_test" }, state, CTX);
  assert.ok(spec !== null);
  const result = applyAnswer(state, spec, form({ holding: ["<b>bia</b>"] }), CTX);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(!result.error.includes("bia"), result.error);
    assert.equal(knownError(result.error), result.error);
  }
});

test("nấc thu nhập trùng MỌI ngưỡng thu nhập trong dữ liệu: không câu trả lời nào bắc qua ngưỡng", async () => {
  const { compareToThreshold } = await import("../recommendation/user.ts");
  const cases = [
    { kind: "personal_income_unknown", ruleType: "minimum_personal_income", field: "annualPersonalIncome" },
    { kind: "household_income_unknown", ruleType: "minimum_household_income", field: "annualHouseholdIncome" },
  ] as const;
  for (const { kind, ruleType, field } of cases) {
    const state = stateWithGoal("next_card");
    const spec = questionFor({ kind, subject: "u_test" }, state, CTX);
    assert.ok(spec !== null && spec.input.type === "choice");
    const thresholds = DATA.eligibilityRules
      .filter((rule) => rule.ruleType === ruleType && rule.severity === "hard" && Number(rule.value) > 0)
      .map((rule) => Number(rule.value));
    assert.ok(thresholds.length > 0);
    for (const option of spec.input.options.filter((row) => row.value !== "decline")) {
      const applied = applyAnswer(state, spec, form({ answer: option.value }), CTX);
      assert.ok(applied.ok, `${kind} ${option.value}`);
      const amount = applied.state.profile[field];
      assert.ok(amount != null);
      for (const threshold of thresholds) {
        assert.notEqual(
          compareToThreshold(amount, threshold),
          "straddles",
          `${kind}: "${option.label}" bắc qua ngưỡng $${threshold}`,
        );
      }
    }
  }
  // Câu giúp nói đúng ngưỡng cao nhất có thật, không phải một con số chép tay.
  const personal = questionFor({ kind: "personal_income_unknown", subject: "u_test" }, stateWithGoal("next_card"), CTX);
  const top = Math.max(
    ...DATA.eligibilityRules
      .filter((rule) => rule.ruleType === "minimum_personal_income")
      .map((rule) => Number(rule.value)),
  );
  assert.ok(personal?.help.includes(`$${top.toLocaleString("en-US")}`), personal?.help);
});

test("nhãn nấc thu nhập khớp đúng khoảng lưu (người thu nhập đúng ngưỡng không bấm nhầm nấc dưới)", () => {
  const state = stateWithGoal("next_card");
  const spec = questionFor({ kind: "personal_income_unknown", subject: "u_test" }, state, CTX);
  assert.ok(spec !== null && spec.input.type === "choice");
  for (const option of spec.input.options.filter((row) => row.value !== "decline")) {
    const applied = applyAnswer(state, spec, form({ answer: option.value }), CTX);
    assert.ok(applied.ok);
    const amount = applied.state.profile.annualPersonalIncome!;
    if (amount.high !== null && amount.low > 0) {
      assert.ok(option.label.endsWith(`$${amount.high.toLocaleString("en-US")}`), `${option.label} ≠ ${JSON.stringify(amount)}`);
    }
  }
});
