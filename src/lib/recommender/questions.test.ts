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
    case "number":
      return [{ answer: "0" }, { answer: "60000" }, { answer: String(spec.input.max) }];
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
