import { test } from "node:test";
import assert from "node:assert/strict";
import { cardTagsFor } from "./card-tags.ts";
import { PRODUCTS } from "./recommendation/data/products.ts";

const AS_OF = "2026-09-29";
/** Thẻ thêm SAU `AS_OF` thì kiểm ở ngày nó vào kho — trước đó đúng là chưa có tag. */
const asOfFor = (product: { effectiveFrom: string }) =>
  product.effectiveFrom > AS_OF ? product.effectiveFrom : AS_OF;

test("mọi thẻ Canada: tối đa 3 tag, không trùng", () => {
  for (const product of PRODUCTS) {
    const tags = cardTagsFor(product.slug, asOfFor(product));
    assert.ok(tags.length <= 3, `${product.slug}: ${tags.join(", ")}`);
    assert.equal(new Set(tags).size, tags.length, product.slug);
  }
});

test("hầu hết thẻ có ít nhất một tag — dữ liệu engine không bị cắt đứt im lặng", () => {
  const empty = PRODUCTS.filter((product) => cardTagsFor(product.slug, asOfFor(product)).length === 0);
  assert.deepEqual(
    empty.map((product) => product.slug),
    [],
  );
});

test("slug không có trong engine thì không có tag", () => {
  assert.deepEqual(cardTagsFor("khong-co-the-nay", AS_OF), []);
});

test("hạng mục tích điểm cao nhất thành tag", () => {
  assert.ok(cardTagsFor("amex-cobalt", AS_OF).includes("Ăn uống"));
});

test("tỷ lệ chỉ áp ở một chuỗi cửa hàng không thành tag", () => {
  // Scene+™ Visa sinh viên: 2x siêu thị CHỈ ở Sobeys & cùng nhóm, 1x chỗ khác.
  assert.ok(!cardTagsFor("scotiabank-scene-plus-visa-students", AS_OF).includes("Siêu thị"));
});

test("thẻ business mở đầu bằng tag Business", () => {
  assert.equal(cardTagsFor("amex-business-platinum", AS_OF)[0], "Business");
});

test("thẻ hội viên phòng chờ trả phí mỗi lượt không được tag Lounge", () => {
  // Priority Pass của Scotiabank® Gold, Mastercard® Travel Pass của BMO®.
  assert.ok(!cardTagsFor("scotiabank-gold-amex", AS_OF).includes("Lounge"));
  assert.ok(!cardTagsFor("bmo-viporter-world-elite-mastercard", AS_OF).includes("Lounge"));
  // Vào không giới hạn thì có, dù không có con số lượt.
  assert.ok(cardTagsFor("amex-platinum", AS_OF).includes("Lounge"));
});

test("tín chỉ lên hạng hàng không không phải là Elite status", () => {
  assert.ok(!cardTagsFor("amex-aeroplan", AS_OF).includes("Elite status"));
});
