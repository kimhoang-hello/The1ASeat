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
  japanTripFunded,
  USER_FIXTURES,
} from "../recommendation/data/user-fixtures.ts";
import { executeRun } from "../recommendation/runs.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import type { UserState } from "../recommendation/user-types.ts";
import { asksForAttention, followUpAfterSkips } from "./follow-up.ts";
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
