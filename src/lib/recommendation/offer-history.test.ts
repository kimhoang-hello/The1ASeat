// Kiểm cầu nối lịch sử offer — primitive cho §11–12 (offer quality, percentile
// lịch sử).
//
//   npm run test:reco

import assert from "node:assert/strict";
import { test } from "node:test";
import { dedupeHistory, type OfferHistoryState } from "./offer-history.ts";

function level(
  at: string,
  amount: number | undefined,
  unit: NonNullable<OfferHistoryState["bonus"]>["unit"],
  label = "",
): OfferHistoryState {
  return { at, bonus: { label, amount, unit } };
}

/** Một lần ghi mà thẻ KHÔNG có welcome bonus nào. Mang ngày, vì đó chính là
 *  thứ `until` của đợt liền trước cần tới. */
function noBonus(at: string): OfferHistoryState {
  return { at, bonus: null };
}

test("bỏ những lần ghi mà mức bonus không đổi", () => {
  // Ca thật: Scotiabank® Gold ghi 50,000 điểm hai lần vì REBATE đi từ $150 lên
  // $200 — welcome bonus không nhúc nhích. Giữ cả hai thì percentile đánh
  // trọng số theo nhịp đổi rebate.
  const kept = dedupeHistory([
    level("2026-08-29", 50000, "points"),
    level("2026-09-06", 50000, "points"),
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].at, "2026-08-29");
});

test("so bằng SỐ và ĐƠN VỊ, không bằng nhãn", () => {
  // Ca thật: Momentum đổi chữ "Hoàn tiền 15%" → "Cashback 15%" mà ưu đãi y
  // nguyên. So nhãn thì một lần biên tập câu chữ thành một mức mới.
  const kept = dedupeHistory([
    level("2026-08-29", 15, "percent", "Hoàn tiền 15% (tối đa $300)"),
    level("2026-08-31", 15, "percent", "Cashback 15% (tối đa $300)"),
    level("2026-09-02", 15, "percent", "Cashback 15% (tối đa $300)"),
  ]);
  assert.equal(kept.length, 1);
});

test("cùng số nhưng KHÁC đơn vị là hai mức khác nhau", () => {
  // "Hoàn tiền 15%" rồi "$15 tiền mặt" không phải một. Gộp chúng lại là xoá
  // mất một lần offer thật sự đổi bản chất.
  const kept = dedupeHistory([
    level("2026-08-29", 15, "percent"),
    level("2026-09-02", 15, "dollar"),
  ]);
  assert.equal(kept.length, 2);
});

test("giữ nguyên mọi lần bonus thật sự đổi", () => {
  const kept = dedupeHistory([
    level("2026-08-29", 110000, "points"),
    level("2026-09-02", 85000, "points"),
  ]);
  assert.deepEqual(kept.map((p) => p.amount), [110000, 85000]);
});

test("quay lại mức cũ SAU khi đã đổi vẫn là một quan sát riêng", () => {
  // Chỉ bỏ những lần LIÊN TIẾP giống nhau. Một thẻ hạ rồi nâng lại đúng mức cũ
  // là hai lần thị trường đổi, và §12 cần thấy cả hai để nói "mức này từng
  // xuất hiện bao nhiêu lâu".
  const kept = dedupeHistory([
    level("2026-08-29", 70000, "points"),
    level("2026-09-02", 50000, "points"),
    level("2026-09-06", 70000, "points"),
  ]);
  assert.equal(kept.length, 3);
});

test("nhãn không đọc ra số thì amount undefined, và hai cái liên tiếp gộp lại", () => {
  const kept = dedupeHistory([
    level("2026-08-29", undefined, "points", "Ưu đãi đặc biệt"),
    level("2026-09-02", undefined, "points", "Ưu đãi giới hạn"),
  ]);
  assert.equal(kept.length, 1);
});

test("lịch sử rỗng trả về rỗng", () => {
  assert.deepEqual(dedupeHistory([]), []);
});

test("mất rồi có lại welcome bonus là HAI đợt, không phải một", () => {
  // `null` là lần ghi mà thẻ không có welcome bonus nào — vạch ngăn giữa hai
  // đợt. Lọc nó ra trước khi gộp thì hai mức 70,000 nằm cạnh nhau và bị nhập
  // làm một, biến hai đợt riêng biệt thành một đợt kéo dài.
  const kept = dedupeHistory([
    level("2026-08-29", 70000, "points"),
    noBonus("2026-09-01"),
    level("2026-09-06", 70000, "points"),
  ]);
  assert.deepEqual(
    kept.map((p) => p.at),
    ["2026-08-29", "2026-09-06"],
  );
});

test("nhiều lần liên tiếp KHÔNG có bonus chỉ tính là một trạng thái", () => {
  const kept = dedupeHistory([
    level("2026-08-29", 70000, "points"),
    noBonus("2026-09-01"),
    noBonus("2026-09-02"),
    noBonus("2026-09-03"),
    level("2026-09-06", 70000, "points"),
  ]);
  assert.equal(kept.length, 2);
});

test("dòng thời gian mở đầu bằng không-có-bonus vẫn giữ mức đầu tiên", () => {
  const kept = dedupeHistory([noBonus("2026-09-01"), level("2026-09-06", 70000, "points")]);
  assert.deepEqual(kept.map((p) => p.amount), [70000]);
});
