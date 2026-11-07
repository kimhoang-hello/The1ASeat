import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDailyDropBonuses, parseUsDate } from "./daily-drop-bonuses.ts";

// Cắt từ HTML thật của dailydrop.com/transfer-partners-cheat-sheet (06/11/2026):
// bảng partner phía trên cũng dùng class `transfer-bonus-item` (84 hàng) — parser
// phải chỉ đọc trong `#current-offers`.
const item = (from: string, to: string, bonus: string, expires: string) =>
  `<div role="listitem" class="transfer-bonus-item w-dyn-item"><div class="transfer-bonus-inner"><div>${from}</div><div>${to}</div><div>${bonus}</div><div>${expires}</div><a id="w-node-x" href="#" class="w-condition-invisible">Read more</a></div></div>`;

const page = (items: string[]) => `
<section class="section"><div class="transfer-bonus-item w-dyn-item"><div>Chase</div><div>Hyatt</div></div></section>
<section id="current-offers" class="section _0-margin-top"><div class="container"><h2>Current Transfer Bonuses</h2>
<div class="transfer-bonus-wrapper"><div class="transfer-bonus-header"><div>TRANSFER FROM</div><div id="w-node-a">TRANSFER TO</div><div>BONUS</div><div>EXPIRES</div><div>FURTHER INFO</div></div>
<div class="full-width w-dyn-list"><div role="list" class="w-dyn-items">${items.join("")}</div></div></div></div></section>
<section class="footer"><div class="transfer-bonus-item"><div>x</div></div></section>`;

test("đọc đúng bốn ô của mỗi hàng, chỉ trong #current-offers", () => {
  const bonuses = parseDailyDropBonuses(
    page([
      item("American Express Membership Rewards", "Marriott Bonvoy", "35%", "December 10, 2026"),
      item("Citi ThankYou points", "Turkish Miles &amp; Smiles ", "40%", "November 30, 2026"),
    ]),
  );
  assert.deepEqual(bonuses, [
    { from: "American Express Membership Rewards", to: "Marriott Bonvoy", bonusPercent: 35, expiresOn: "2026-12-10" },
    { from: "Citi ThankYou points", to: "Turkish Miles & Smiles", bonusPercent: 40, expiresOn: "2026-11-30" },
  ]);
});

test("trang đổi cấu trúc thì ném lỗi chứ không trả danh sách rỗng", () => {
  assert.throws(() => parseDailyDropBonuses("<html><body>nothing</body></html>"), /current-offers/);
  assert.throws(() => parseDailyDropBonuses(page([])), /không đọc được bonus nào/);
  assert.throws(
    () => parseDailyDropBonuses(page([item("Chase Ultimate Rewards", "IHG One Rewards", "up to 80%", "December 3, 2026")])),
    /bonus không đọc được/,
  );
  assert.throws(
    () => parseDailyDropBonuses(page([item("Chase Ultimate Rewards", "IHG One Rewards", "80%", "TBD")])),
    /ngày hết hạn/,
  );
});

test("ngày: tên tháng đầy đủ, viết tắt, và chặn ngày không có thật", () => {
  assert.equal(parseUsDate("December 3, 2026"), "2026-12-03");
  assert.equal(parseUsDate("Sept 30, 2026"), "2026-09-30");
  assert.equal(parseUsDate("Jan. 5 2027"), "2027-01-05");
  assert.throws(() => parseUsDate("February 31, 2027"), /không có thật/);
});
