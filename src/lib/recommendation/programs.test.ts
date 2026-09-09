// Chốt hành vi nhận diện chương trình điểm.
//
// `PROGRAM_RULES` của `lib/card-points-programs.ts` nay SUY RA từ
// `PointsProgram.contentPattern`, nên nó không còn là một danh sách viết tay
// chạy song song. Đổi lại, một lỗi gõ trong pattern sẽ làm thẻ im lặng mất chip
// lọc trên `/credit-cards` — không lỗi nào nổ ra, chỉ là bộ lọc bớt đi một mục.
//
// Đã xảy ra ngay lúc chuyển nguồn: ba pattern bị escape thừa (`\\s` thay vì
// `\s`), và HAI trong ba vẫn "chạy" nhờ nhánh thay thế trong cùng regex —
// `amex mr\\b` hỏng nhưng `membership rewards` cứu, `cash\\s?back` hỏng nhưng
// `hoàn tiền` cứu. Chỉ Scene+™ đổ hẳn. Nên phải kiểm TỪNG nhánh.

import assert from "node:assert/strict";
import { test } from "node:test";
import { POINTS_PROGRAMS } from "./data/points-programs.ts";

/** Khớp đúng cách `programIdsInText` khớp: bỏ ®/™ rồi gộp khoảng trắng. */
function match(text: string): string[] {
  const cleaned = text.replace(/[®™*]/g, " ").replace(/\s+/g, " ");
  return POINTS_PROGRAMS.filter((p) => p.contentPattern?.test(cleaned)).map(
    (p) => p.cardFilterProgramId ?? (p.id as string),
  );
}

test("mỗi chương trình có mặt trên trang thẻ đều nhận diện được", () => {
  const cases: [string, string][] = [
    ["70,000 điểm Aeroplan®", "aeroplan"],
    ["110,000 điểm Bonvoy®", "bonvoy"],
    ["60,000 điểm Membership Rewards®", "amex-mr"],
    ["100,000 điểm Avion®", "avion"],
    ["60,000 điểm Aventura®", "aventura"],
    ["50,000 điểm Scene+™", "scene-plus"],
    ["160,000 điểm TD Rewards®", "td-rewards"],
    ["70,000 điểm VIPorter®", "viporter"],
    ["25,000 miles MileagePlus®", "mileageplus"],
    ["70,000 điểm WestJet®", "westjet"],
    ["Tích điểm À la carte™", "a-la-carte"],
    ["Hoàn tiền 15% mọi chi tiêu", "cash-back"],
  ];
  for (const [text, want] of cases) {
    assert.ok(match(text).includes(want), `"${text}" phải nhận ra ${want}`);
  }
});

test("từng NHÁNH của pattern nhiều lựa chọn đều còn sống", () => {
  // Nhánh hỏng bị nhánh còn lại che mất là cách lỗi escape sống sót.
  assert.ok(match("amex mr 60,000").includes("amex-mr"), "nhánh 'amex mr\\\\b'");
  assert.ok(match("Membership Rewards").includes("amex-mr"), "nhánh 'membership rewards'");
  assert.ok(match("Cash back 2%").includes("cash-back"), "nhánh 'cash\\\\s?back'");
  assert.ok(match("Cashback 2%").includes("cash-back"), "nhánh 'cashback' liền");
  assert.ok(match("Hoàn tiền 2%").includes("cash-back"), "nhánh 'hoàn tiền'");
});

test("không pattern nào chứa dấu escape thừa", () => {
  // `\\s` trong nguồn nghĩa là "dấu gạch chéo ngược rồi chữ s", không phải
  // khoảng trắng — đúng lỗi đã xảy ra lúc chuyển nguồn.
  for (const program of POINTS_PROGRAMS) {
    if (program.contentPattern === null) continue;
    assert.ok(
      !program.contentPattern.source.includes("\\\\"),
      `${program.slug}: pattern có escape thừa — ${program.contentPattern.source}`,
    );
  }
});

test("chương trình chỉ là đích chuyển điểm thì không cần pattern", () => {
  // Avios®, Flying Blue®… không xuất hiện trên trang thẻ nào.
  const noPattern = POINTS_PROGRAMS.filter((p) => p.contentPattern === null).map((p) => p.slug);
  assert.deepEqual(noPattern.sort(), ["aadvantage", "asia-miles", "avios", "flying-blue"]);
});
