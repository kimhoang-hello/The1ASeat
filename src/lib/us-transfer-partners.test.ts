import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  US_TRANSFER_AIRLINES,
  US_TRANSFER_HOTELS,
  US_TRANSFER_ISSUERS,
  US_TRANSFER_PARTNERS,
  legOn,
  partnerCount,
  usTransferIssuerForCurrency,
} from "./us-transfer-partners.ts";
import { ALL_US_CARDS } from "./us-credit-cards.ts";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

// Luật tác giả đặt khi dựng bảng (06/10/2026): chương trình nào không ngân hàng
// nào chuyển sang được thì không có mặt — Daily Drop liệt kê cả những hàng đó.
test("mọi chương trình đều có ít nhất một hệ điểm chuyển được", () => {
  for (const row of US_TRANSFER_PARTNERS) {
    assert.ok(Object.keys(row.legs).length > 0, `${row.program} không có ô nào`);
  }
});

// Số đối tác của từng hệ điểm, đếm trên trang chính chủ ngày 06/10/2026 (Bilt và
// Wells Fargo® qua nguồn thứ cấp — xem đầu `us-transfer-partners.ts`). Ngân hàng
// thêm/bớt đối tác thì sửa dữ liệu VÀ con số ở đây, sau khi đối chiếu lại.
test("số đối tác của mỗi hệ điểm khớp lần đối chiếu gần nhất", () => {
  const expected = { amex: 20, chase: 14, "capital-one": 22, citi: 20, bilt: 24, "wells-fargo": 10 };
  for (const issuer of US_TRANSFER_ISSUERS) {
    assert.equal(partnerCount(issuer.id), expected[issuer.id], issuer.name);
  }
});

test("tỷ lệ viết đúng dạng \"1,000 : X\" với dấu phẩy ngăn nghìn", () => {
  const RATIO = /^\d{1,3}(,\d{3})? : \d{1,3}(,\d{3})?$/;
  for (const row of US_TRANSFER_PARTNERS) {
    for (const [issuer, leg] of Object.entries(row.legs)) {
      assert.match(leg.ratio, RATIO, `${row.program} / ${issuer}`);
      if (leg.change) {
        assert.match(leg.change.ratio, RATIO, `${row.program} / ${issuer} (change)`);
        assert.match(leg.change.from, /^\d{4}-\d{2}-\d{2}$/, `${row.program} / ${issuer} (change.from)`);
      }
    }
  }
});

test("mỗi nhóm xếp theo tên, không trùng tên", () => {
  const key = (name: string) => name.replace(/[®™℠]/g, "").toLocaleLowerCase("en");
  for (const group of [US_TRANSFER_AIRLINES, US_TRANSFER_HOTELS]) {
    const names = group.map((row) => key(row.program));
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")));
  }
  const all = US_TRANSFER_PARTNERS.map((row) => row.program);
  assert.equal(new Set(all).size, all.length);
});

test("mọi logo có file thật trong public/", () => {
  for (const path of [...US_TRANSFER_PARTNERS.map((row) => row.logo), ...US_TRANSFER_ISSUERS.map((i) => i.logo)]) {
    assert.ok(existsSync(PUBLIC + path), path);
  }
});

// Cột có `currency` mà không thẻ Mỹ nào mang đúng chuỗi đó thì khối "Thẻ Mỹ tích…"
// biến mất trong im lặng — gõ "Ultimate Rewards" thiếu ® là đủ.
test("currency của mỗi cột khớp ít nhất một thẻ Mỹ", () => {
  for (const issuer of US_TRANSFER_ISSUERS) {
    if (issuer.currency === null) continue;
    assert.ok(
      ALL_US_CARDS.some((card) => card.us.rewardsCurrency === issuer.currency),
      `${issuer.name}: không thẻ nào tích "${issuer.currency}"`,
    );
    assert.equal(usTransferIssuerForCurrency(issuer.currency)?.id, issuer.id);
  }
});

test("tỷ lệ đã công bố sẽ đổi tự lật đúng ngày", () => {
  const hyatt = US_TRANSFER_HOTELS.find((row) => row.program === "World of Hyatt®")!;
  const before = legOn(hyatt, "bilt", "2026-12-31")!;
  assert.equal(before.ratio, "1,000 : 1,000");
  assert.deepEqual(before.upcoming, { from: "2027-01-01", ratio: "1,000 : 750" });
  const after = legOn(hyatt, "bilt", "2027-01-01")!;
  assert.equal(after.ratio, "1,000 : 750");
  assert.equal(after.upcoming, undefined);
  assert.equal(legOn(hyatt, "amex", "2026-12-31"), null);
});
