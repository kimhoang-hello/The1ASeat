// Kiểm cách dồn nhật ký rebate thành các đoạn cho section "Lịch sử rebate".
// Dữ liệu chép từ data/offer-history.json (bản 21/11/2026).

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRebateHistory, dollarsIn, type RebateHistoryEntry } from "./rebate-history.ts";

const TODAY = "2026-11-23";

test("Momentum: dồn thành 6 đoạn, đếm đủ 87 ngày", () => {
  const entries: RebateHistoryEntry[] = [
    { at: "2026-08-29", rebate: "$150" },
    { at: "2026-08-31", rebate: "$150" }, // dòng mới chỉ vì welcome bonus đổi
    { at: "2026-09-02", rebate: "$100" },
    { at: "2026-09-03", rebate: "$150" },
    { at: "2026-10-15", rebate: "$200" },
    { at: "2026-10-31", rebate: "$100" },
    { at: "2026-11-01", rebate: "$150" },
    { at: "2026-11-02", rebate: "$150" },
  ];
  const h = buildRebateHistory(entries, "$150", TODAY)!;
  assert.deepEqual(
    h.segments.map((s) => [s.from, s.to, s.amount, s.days]),
    [
      ["2026-08-29", "2026-09-01", 150, 4],
      ["2026-09-02", "2026-09-02", 100, 1],
      ["2026-09-03", "2026-10-14", 150, 42],
      ["2026-10-15", "2026-10-30", 200, 16],
      ["2026-10-31", "2026-10-31", 100, 1],
      ["2026-11-01", "2026-11-23", 150, 23],
    ],
  );
  assert.equal(h.segments.reduce((n, s) => n + s.days, 0), 87);
  assert.deepEqual([h.current, h.max, h.min, h.distinct, h.changes], [150, 200, 100, 3, 5]);
  assert.ok(h.segments[0].first && h.segments[5].current && !h.segments[5].live);
});

test("Amex®: bỏ các dòng đầu không có rebate, chỉ còn một mức", () => {
  const entries: RebateHistoryEntry[] = [
    { at: "2026-09-07" },
    { at: "2026-10-23" },
    { at: "2026-11-06" },
    { at: "2026-11-14", rebate: "$150" },
  ];
  const h = buildRebateHistory(entries, "$150", TODAY)!;
  assert.equal(h.segments.length, 1);
  assert.deepEqual([h.trackedSince, h.segments[0].days, h.distinct, h.unchanged], ["2026-11-14", 10, 1, true]);
});

test("Gold Amex®: trang đã $200, file còn $150 — nối đoạn hôm nay theo trang", () => {
  const entries: RebateHistoryEntry[] = [
    { at: "2026-08-29", rebate: "$150" },
    { at: "2026-09-06", rebate: "$200" },
    { at: "2026-11-01", rebate: "$150" },
    { at: "2026-11-02", rebate: "$150" },
  ];
  const h = buildRebateHistory(entries, "$200", TODAY)!;
  const [prev, cur] = h.segments.slice(-2);
  assert.deepEqual([prev.amount, prev.to, prev.days], [150, "2026-11-22", 22]);
  assert.deepEqual([cur.amount, cur.from, cur.days, cur.live, cur.current], [200, TODAY, 1, true, true]);
  assert.equal(h.max, 200);
});

test("file đã có dòng hôm nay nhưng số khác trang: thay số, không thêm đoạn", () => {
  const h = buildRebateHistory(
    [
      { at: "2026-11-01", rebate: "$120" },
      { at: TODAY, rebate: "$100" },
    ],
    "$150",
    TODAY,
  )!;
  assert.deepEqual(
    h.segments.map((s) => [s.from, s.amount, s.live]),
    [
      ["2026-11-01", 120, false],
      [TODAY, 150, true],
    ],
  );
});

test("thay số dòng hôm nay mà trùng đoạn trước thì gộp lại", () => {
  const h = buildRebateHistory(
    [
      { at: "2026-11-01", rebate: "$120" },
      { at: TODAY, rebate: "$100" },
    ],
    "$120",
    TODAY,
  )!;
  assert.deepEqual(
    h.segments.map((s) => [s.from, s.to, s.amount]),
    [["2026-11-01", TODAY, 120]],
  );
  assert.equal(h.distinct, 1);
});

test("thẻ đang không có rebate: không có gì để hiện", () => {
  const entries: RebateHistoryEntry[] = [
    { at: "2026-08-29", rebate: "$125" },
    { at: "2026-08-31", rebate: "$50" },
    { at: "2026-10-30" },
  ];
  assert.equal(buildRebateHistory(entries, undefined, TODAY), undefined);
  assert.equal(buildRebateHistory(entries, "", TODAY), undefined);
});

test("khoảng trống giữa chừng là một đoạn null, không tính vào cao/thấp", () => {
  const h = buildRebateHistory(
    [
      { at: "2026-08-29", rebate: "$125" },
      { at: "2026-08-31", rebate: "$50" },
      { at: "2026-10-30" },
      { at: "2026-11-10", rebate: "$75" },
    ],
    "$75",
    TODAY,
  )!;
  assert.deepEqual(
    h.segments.map((s) => s.amount),
    [125, 50, null, 75],
  );
  assert.deepEqual([h.max, h.min, h.distinct], [125, 50, 3]);
});

test("thẻ chưa có dòng nào trong file: một đoạn từ hôm nay", () => {
  const h = buildRebateHistory([], "$80", TODAY)!;
  assert.deepEqual(
    h.segments.map((s) => [s.from, s.days, s.live]),
    [[TODAY, 1, true]],
  );
  // Chỉ có đoạn dựng từ trang: chưa ghi nhận gì, không được nói "chưa đổi lần nào".
  assert.equal(h.unchanged, false);
});

test("một mức nhưng từng bị ngắt: không phải 'chưa đổi lần nào'", () => {
  const h = buildRebateHistory(
    [
      { at: "2026-11-14", rebate: "$150" },
      { at: "2026-11-18" },
      { at: "2026-11-21", rebate: "$150" },
    ],
    "$150",
    TODAY,
  )!;
  assert.deepEqual(
    h.segments.map((s) => [s.from, s.amount]),
    [
      ["2026-11-14", 150],
      ["2026-11-18", null],
      ["2026-11-21", 150],
    ],
  );
  assert.deepEqual([h.distinct, h.unchanged], [1, false]);
});

test("dòng có rebate mà không đọc được: im lặng, không đoán", () => {
  const entries: RebateHistoryEntry[] = [
    { at: "2026-09-01", rebate: "$100" },
    { at: "2026-10-01", rebate: "$150 CAD" },
    { at: "2026-10-05", rebate: "$120" },
  ];
  assert.equal(buildRebateHistory(entries, "$120", TODAY), undefined);
  // Chuỗi rỗng là "không có rebate", như chip trên trang.
  const h = buildRebateHistory(
    [
      { at: "2026-09-01", rebate: "$100" },
      { at: "2026-10-01", rebate: "" },
    ],
    "$100",
    TODAY,
  )!;
  assert.deepEqual(
    h.segments.map((s) => s.amount),
    [100, null, 100],
  );
});

test("trang quay về mức cũ trong ngày file vừa ghi mức mới: không nói 'chưa đổi'", () => {
  const h = buildRebateHistory(
    [
      { at: "2026-11-01", rebate: "$100" },
      { at: TODAY, rebate: "$150" },
    ],
    "$100",
    TODAY,
  )!;
  assert.deepEqual([h.segments.length, h.unchanged], [1, false]);
});

test("dòng ghi sau hôm nay bị bỏ qua", () => {
  const h = buildRebateHistory(
    [
      { at: "2026-11-01", rebate: "$100" },
      { at: "2026-11-30", rebate: "$300" },
    ],
    "$100",
    TODAY,
  )!;
  assert.deepEqual([h.segments.length, h.max], [1, 100]);
});

test("dollarsIn đọc dấu phẩy ngăn nghìn và từ chối nhãn không phải tiền", () => {
  assert.equal(dollarsIn("$1,000"), 1000);
  assert.equal(dollarsIn("$1500"), 1500);
  assert.equal(dollarsIn("$2 000"), undefined);
  assert.equal(dollarsIn("$150–$300"), undefined);
  assert.equal(dollarsIn("150 CAD"), undefined);
  assert.equal(dollarsIn("Tới $200"), undefined);
  assert.equal(dollarsIn("$150"), 150);
  assert.equal(dollarsIn("150"), undefined);
  assert.equal(dollarsIn("$0"), undefined);
  assert.equal(dollarsIn(undefined), undefined);
});
