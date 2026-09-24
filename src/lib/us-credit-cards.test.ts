import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_US_CARDS,
  US_CARDS_BEGINNER_SLUG,
  US_CARDS_GUIDE_SLUGS,
  US_CARD_FILTERS,
  US_ISSUERS,
  getUsCreditCards,
  matchesUsCardFilter,
  spendRequirement,
  usCardsListPath,
} from "./us-credit-cards.ts";

/** Mọi chuỗi người đọc thấy trên một thẻ, kể cả chuỗi dựng từ số. */
function visibleStrings(card: (typeof ALL_US_CARDS)[number]): string[] {
  const { canada } = card.us;
  return [
    card.name,
    card.issuer,
    card.annualFee,
    card.welcomeBonus ?? "",
    card.headline,
    card.editorsTake,
    ...card.keyBenefits,
    ...card.us.tags,
    spendRequirement(card) ?? "",
    ...[canada.itin, canada.usCreditHistory, canada.usAddress, canada.foreignTransactionFee, canada.pointsFromCanada]
      .flatMap((answer) => [answer.short, answer.note ?? ""]),
    canada.watchOut,
  ];
}

// `$` trần trên site là đô Canada. Một "$95" lọt vào thẻ Mỹ là nói với người
// đọc Canada một con số sai tỷ giá ~35%.
test("mọi số tiền trên thẻ Mỹ đều ghi USD", () => {
  for (const card of ALL_US_CARDS) {
    for (const text of visibleStrings(card)) {
      // `(?![\d,.])` chặn backtrack: thiếu nó thì "$95 USD" khớp thành "$9".
      const bare = text.match(/\$[\d,.]*\d(?![\d,.])(?! USD)/g);
      assert.equal(bare, null, `${card.slug}: "${text}"`);
    }
  }
});

// `splitAnnualFee` (OfferStats) chỉ nhận đúng "$X USD/năm", có thể kèm một
// cặp ngoặc. Lệch dạng này thì cả câu phí rơi vào ô số lớn.
test("phí thường niên thẻ Mỹ đúng dạng OfferStats đọc được", () => {
  for (const card of ALL_US_CARDS) {
    assert.match(card.annualFee, /^\$[\d,]+ USD\/năm(?: \([^()]+\))?$/, card.slug);
  }
});

test("slug không trùng, mọi thẻ đều là thẻ Mỹ", () => {
  const slugs = ALL_US_CARDS.map((card) => card.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const card of ALL_US_CARDS) {
    assert.equal(card.country, "US");
    assert.equal(card.us.currency, "USD");
  }
});

test("công bố thì số liệu mẫu không bao giờ hiện", () => {
  const published = getUsCreditCards(true);
  assert.ok(published.every((card) => !card.us.needsVerification));
  assert.equal(getUsCreditCards(false).length, ALL_US_CARDS.length);
});

test("mỗi thẻ thuộc đúng một bộ lọc loại, ngoài 'Tất cả'", () => {
  for (const card of ALL_US_CARDS) {
    const hits = US_CARD_FILTERS.filter((f) => f !== "all" && matchesUsCardFilter(card, f));
    assert.equal(hits.length, 1, card.slug);
  }
});

test("dữ liệu mẫu phủ đủ sáu ngân hàng và bốn bộ lọc", () => {
  for (const issuer of US_ISSUERS) {
    assert.ok(ALL_US_CARDS.some((card) => card.us.issuerId === issuer.id), issuer.id);
  }
  for (const filter of US_CARD_FILTERS) {
    assert.ok(ALL_US_CARDS.some((card) => matchesUsCardFilter(card, filter)), filter);
  }
});

test("link lọc luôn nhảy về danh sách", () => {
  assert.equal(usCardsListPath({}), "/us-credit-cards#tat-ca-the-my");
  assert.equal(
    usCardsListPath({ filter: "hotel", issuer: "chase" }),
    "/us-credit-cards?type=hotel&issuer=chase#tat-ca-the-my",
  );
  assert.equal(usCardsListPath({ filter: "all" }), "/us-credit-cards#tat-ca-the-my");
});

// Elevated chỉ được bật khi ngân hàng công bố hạn offer. Thiếu `expiresAt` thì
// thẻ nằm trong mục "Elevated Offers" mãi mãi, kể cả khi offer đã về mức thường.
test("thẻ elevated phải có ngày hết hạn", () => {
  for (const card of ALL_US_CARDS) {
    if (card.elevatedBonus) assert.ok(card.expiresAt, card.slug);
  }
});

// Nút "Xem hướng dẫn" phải trỏ bài apply, không phải bài đầu danh sách: chữ
// quanh nút nói về ITIN và thẻ US đầu tiên (xem `usCardsGuideHref`).
test("bài cho người mới nằm trong danh sách hướng dẫn", () => {
  assert.ok(US_CARDS_GUIDE_SLUGS.includes(US_CARDS_BEGINNER_SLUG));
  assert.equal(new Set(US_CARDS_GUIDE_SLUGS).size, US_CARDS_GUIDE_SLUGS.length);
});
