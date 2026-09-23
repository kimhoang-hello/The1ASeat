/**
 * "Bỏ qua" phải thật sự bỏ qua.
 *
 * Nếu câu vừa bỏ qua lại hiện ra ở lượt sau thì nút đó là nút giả, và người
 * dùng kẹt ở đúng câu họ không muốn trả lời.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { offlineDataset } from "../recommendation/data/index.ts";
import {
  beginnerNoCards,
  flexiblePointsSufficient,
  japanTripFunded,
  USER_FIXTURES,
} from "../recommendation/data/user-fixtures.ts";
import { executeRun } from "../recommendation/runs.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import type { UserState } from "../recommendation/user-types.ts";
import { asksForAttention, followUpAfterSkips, presentForPage } from "./follow-up.ts";
import { questionKey } from "./questions.ts";

const ASOF = "2026-09-08";
const DATA = datasetAt(offlineDataset(), ASOF);

let counter = 0;
function runFor(state: UserState) {
  counter += 1;
  return executeRun(
    { state, data: DATA, asOf: ASOF },
    { id: `run_followup_${counter}`, createdAt: "2026-09-08T00:00:00.000Z", userId: "u_test" },
  ).record;
}

test("chưa bỏ qua gì thì giữ nguyên câu engine chọn", () => {
  const record = runFor(beginnerNoCards);
  assert.deepEqual(followUpAfterSkips(record, DATA, new Set()), record.outputSnapshot.followUp);
});

test("bỏ qua một câu thì ra câu KHÁC, không phải câu vừa bỏ", () => {
  for (const state of [beginnerNoCards, japanTripFunded]) {
    const record = runFor(state);
    const first = record.outputSnapshot.followUp;
    assert.ok(first !== null, "nhân vật mẫu này phải còn câu để hỏi");
    const skipped = new Set([questionKey(first.gapKind, first.subject)]);
    const second = followUpAfterSkips(record, DATA, skipped);
    assert.ok(second === null || !skipped.has(questionKey(second.gapKind, second.subject)));
  }
});

test("bỏ qua HẾT thì không còn câu nào, và trang chỉ hiện kết quả", () => {
  const record = runFor(beginnerNoCards);
  const skipped = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    const next = followUpAfterSkips(record, DATA, skipped);
    if (next === null) break;
    skipped.add(questionKey(next.gapKind, next.subject));
  }
  assert.equal(followUpAfterSkips(record, DATA, skipped), null);
});

test("thứ tự vẫn là thứ tự của engine: câu ĐO ĐƯỢC lên trước câu theo bảng ưu tiên", () => {
  // Lọc theo danh sách đã bỏ qua KHÔNG được biến §30 thành một bảng ưu tiên
  // khác: giá trị đo được lấy lại từ chính bản ghi (`followUpProbes`).
  const record = runFor(japanTripFunded);
  const measured = record.derivedState.followUpProbes.filter((probe) => probe.flips > 0);
  if (measured.length < 2) return;
  const skipped = new Set([questionKey(measured[0].gapKind, measured[0].subject)]);
  const next = followUpAfterSkips(record, DATA, skipped);
  assert.ok(next !== null);
  const stillMeasured = measured.some(
    (probe) => probe.gapKind === next.gapKind && probe.subject === next.subject,
  );
  assert.ok(stillMeasured || next.basis === "gatekeeper", "câu tiếp theo rơi khỏi tầng đo được");
});

test("câu được chọn là câu ĐO ĐƯỢC cao nhất — engine không hỏi câu rẻ hơn", () => {
  let measured = 0;
  for (const state of USER_FIXTURES) {
    const record = runFor(state);
    const follow = record.outputSnapshot.followUp;
    if (follow?.basis !== "measured") continue;
    measured += 1;
    const share = (probe: { flips: number; valid: number }) =>
      probe.valid === 0 ? 0 : probe.flips / probe.valid;
    const best = Math.max(...record.derivedState.followUpProbes.map(share), 0);
    const chosen = record.derivedState.followUpProbes.find(
      (probe) => probe.gapKind === follow.gapKind && probe.subject === follow.subject,
    );
    assert.ok(chosen !== undefined);
    assert.ok(
      share(chosen) + 1e-9 >= best,
      `${state.profile.id}: hỏi ${follow.gapKind} (${share(chosen).toFixed(2)}) trong khi có câu ${best.toFixed(2)}`,
    );
  }
  assert.ok(measured > 0, "không nhân vật nào có câu đo được — bài này đang kiểm rỗng");
});

test("câu KHÔNG đổi được kết quả thì không chiếm chỗ câu hỏi chính", () => {
  // `priority` = không phép đo nào nói nó đổi được gì. Nó vẫn đáng hỏi (độ đầy
  // đủ dữ liệu §29), nhưng thuộc khối gập "muốn chắc hơn".
  assert.equal(
    asksForAttention({
      gapKind: "household_income_unknown",
      subject: "u",
      reason: "",
      basis: "priority",
      flipShare: null,
    }),
    false,
  );
  for (const basis of ["measured", "urgent", "gatekeeper"] as const) {
    assert.equal(
      asksForAttention({ gapKind: "cards_undeclared", subject: "u", reason: "", basis, flipShare: null }),
      true,
      basis,
    );
  }
  // Dữ kiện chuyến đi là ngoại lệ: không đổi thứ hạng nhưng đổi chính con số
  // người dùng tới đây để xem.
  assert.equal(
    asksForAttention({
      gapKind: "trip_passengers_unknown",
      subject: "g_1",
      reason: "",
      basis: "priority",
      flipShare: null,
    }),
    true,
  );
});

test("chặng chưa có giá: không hỏi hạng ghế, số người, khứ hồi — trang đã nói trả lời cũng không ra số", () => {
  // Rà trang gợi ý 22/09/2026: bay châu Âu, khối chuyến bay nói "trả lời thêm
  // câu nào cũng không ra con số", ngay trên câu "Chuyến này bay mấy người?".
  const goal = flexiblePointsSufficient.goals[0];
  assert.ok(goal.type === "trip" && goal.destinationRegion === "EUROPE");
  const state: UserState = {
    ...flexiblePointsSufficient,
    goals: [{ ...goal, cabin: null, passengers: null, roundTrip: null }],
  };
  const record = runFor(state);
  const priceFactors = new Set(["trip_cabin_unknown", "trip_passengers_unknown", "trip_round_trip_unknown"]);
  assert.ok(
    record.outputSnapshot.userGaps.some((gap) => priceFactors.has(gap.kind)),
    "hồ sơ này phải còn thiếu thừa số giá, nếu không bài test không canh gì",
  );
  const skipped = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    const next = followUpAfterSkips(record, DATA, skipped, true);
    if (next === null) break;
    assert.ok(!priceFactors.has(next.gapKind), `vẫn hỏi ${next.gapKind} cho một chặng chưa có giá`);
    skipped.add(questionKey(next.gapKind, next.subject));
  }
});

test("bỏ qua hết câu hỏi: trang không còn bảo 'trả lời thêm vài câu'", () => {
  // Codex, rà 22/09/2026: độ chắc chắn đọc câu hỏi GỐC của engine, không phải
  // câu còn lại sau khi bỏ qua.
  const bare = structuredClone(beginnerNoCards);
  bare.declared = { cards: false, balances: false };
  bare.spend = null;
  bare.profile.annualPersonalIncome = null;
  bare.profile.annualFeeTolerancePerCard = null;
  const record = runFor(bare);
  assert.match(presentForPage(record, DATA, [], new Set()).view!.confidence.sentence, /Trả lời thêm/);
  const skipped = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    const next = followUpAfterSkips(record, DATA, skipped);
    if (next === null) break;
    skipped.add(questionKey(next.gapKind, next.subject));
  }
  const page = presentForPage(record, DATA, [], skipped);
  assert.equal(page.followUp, null);
  assert.doesNotMatch(page.view!.confidence.sentence, /Trả lời thêm/);
});
