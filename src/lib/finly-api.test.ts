import assert from "node:assert/strict";
import test from "node:test";

import {
  FinlyOfferIndex,
  affiliateDestinationPath,
  fetchFinlyOffers,
  formatRebate,
  keptUnlisted,
  type FinlyOffer,
} from "./finly-api.ts";

// Con số đọc ra từ đây được GHI THẲNG lên site, như với `finlywealth.test.ts`.
// Ba ca `paused`/`missing` dưới đây là hai sản phẩm thật ngày 29/10/2026: BMO®
// Premium Chequing (offer còn, `rebate: null`, trang rebate vẫn in $75) và
// Scotiabank® Scene+™ Visa for Students (API không liệt kê).

const SITE = "https://www.finlywealth.com";

function offer(over: Partial<FinlyOffer> & Pick<FinlyOffer, "id">): FinlyOffer {
  const [category, slug] = over.id.split(":");
  return {
    slug,
    category,
    name: slug,
    rebate: null,
    links: {
      affiliateUrl: `${SITE}/r/pYQhcEuX?url=x`,
      landingPageUrl: `${SITE}/banking/chequing-accounts/${slug}`,
      productPageUrl: `${SITE}/banking/chequing-accounts/${slug}`,
      rebatePageUrl: null,
    },
    ...over,
  };
}

const withRebate = (id: string, amount: number, section: string, productPath: string) =>
  offer({
    id,
    rebate: { amount },
    links: {
      affiliateUrl: `${SITE}/r/pYQhcEuX?url=x`,
      landingPageUrl: `${SITE}/rebates/${section}/${id.split(":")[1]}`,
      productPageUrl: `${SITE}${productPath}`,
      rebatePageUrl: `${SITE}/rebates/${section}/${id.split(":")[1]}`,
    },
  });

const index = new FinlyOfferIndex([
  withRebate("credit_card:bmo-viporter-world-elite-mastercard", 200, "credit-cards", "/credit-cards/reviews/bmo-viporter"),
  withRebate("bank_account:rbc-advantage", 50, "bank-accounts", "/banking/chequing-accounts/rbc-advantage"),
  withRebate("bank_account:big-rebate", 1500, "bank-accounts", "/banking/chequing-accounts/big-rebate"),
  offer({ id: "bank_account:bmo-premium-chequing-account" }),
  withRebate("credit_card:scotia-scene-plus-visa", 50, "credit-cards", "/credit-cards/reviews/scotia-scene-plus-visa"),
]);

test("trang rebate của offer có rebate đọc ra đúng số, đúng định dạng site", () => {
  const found = index.lookup("/rebates/credit-cards/bmo-viporter-world-elite-mastercard");
  assert.equal(found.kind, "amount");
  assert.equal(found.kind === "amount" && found.rebate, "$200");
  const big = index.lookup("/rebates/bank-accounts/big-rebate");
  assert.equal(big.kind === "amount" && big.rebate, "$1,500");
});

test("offer còn nhưng rebate tắt: trang /rebates/ cũ là paused, không phải missing", () => {
  assert.equal(index.lookup("/rebates/bank-accounts/bmo-premium-chequing-account").kind, "paused");
});

test("bản đặc biệt API không liệt kê là missing, kể cả khi offer thường cùng họ có rebate", () => {
  assert.equal(index.lookup("/rebates/credit-cards/scotia-scene-plus-visa-students").kind, "missing");
});

test("link /banking/ trả về trang sản phẩm kèm rebate của trang rebate cùng offer", () => {
  const found = index.lookup("/banking/chequing-accounts/rbc-advantage");
  assert.equal(found.kind, "product");
  assert.equal(found.kind === "product" && found.twinRebate, "$50");
  const noTwin = index.lookup("/banking/chequing-accounts/bmo-premium-chequing-account");
  assert.equal(noTwin.kind === "product" && noTwin.twinRebate, null);
});

test("trang không offer nào nhận là missing", () => {
  assert.equal(index.lookup("/banking/savings-accounts/koho-essential-plan").kind, "missing");
});

test("link giữ nguyên chỉ được miễn khi đúng cả slug lẫn trang đích", () => {
  assert.ok(keptUnlisted("koho-essential", "/banking/savings-accounts/koho-essential-plan"));
  // Đổi sang một trang khác cũng không có trong API là lựa chọn mới, phải đỏ lại.
  assert.ok(!keptUnlisted("koho-essential", "/banking/savings-accounts/koho-other-plan"));
  assert.ok(!keptUnlisted("rbc-advantage", "/banking/savings-accounts/koho-essential-plan"));
});

test("formatRebate từ chối số lẻ xu, số 0 và số âm thay vì làm tròn", () => {
  assert.equal(formatRebate(75), "$75");
  assert.throws(() => formatRebate(12.5));
  assert.throws(() => formatRebate(0));
  assert.throws(() => formatRebate(-50));
});

test("affiliateDestinationPath chỉ nhận link của FinlyWealth", () => {
  const link = `${SITE}/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Frbc-advantage%2F&utm_source=ghe-1a`;
  assert.equal(affiliateDestinationPath(link), "/rebates/bank-accounts/rbc-advantage");
  assert.equal(affiliateDestinationPath("https://notfinlywealth.com/r/x?url=%2Frebates%2Fa%2Fb"), null);
  assert.equal(affiliateDestinationPath(`${SITE}/r/x?url=https%3A%2F%2Fevil.com%2Frebates%2Fa%2Fb`), null);
  assert.equal(affiliateDestinationPath(undefined), null);
});

// fetchFinlyOffers với fetch giả.

function mockFetch(responses: Array<() => Response>): () => void {
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => responses[Math.min(call++, responses.length - 1)]()) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const page = (data: unknown[], extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({ data, pagination: { hasMore: false }, meta: { currency: "CAD" }, ...extra }),
    { status: 200 },
  );

const rawOffer = (rebate: unknown) => ({
  id: "bank_account:x",
  slug: "x",
  category: "bank_account",
  name: "X",
  rebate,
  links: { affiliateUrl: "a", landingPageUrl: "b", productPageUrl: null, rebatePageUrl: null },
});

test("thiếu hẳn trường rebate là dữ liệu hỏng, không phải 'không có rebate'", async () => {
  const noRebate: Record<string, unknown> = rawOffer(null);
  delete noRebate.rebate;
  const restore = mockFetch([() => page([noRebate])]);
  try {
    await assert.rejects(fetchFinlyOffers("k"), /sai dạng \(rebate\)/);
  } finally {
    restore();
  }
});

test("tiền không phải CAD thì ném", async () => {
  const restore = mockFetch([() => page([rawOffer(null)], { meta: { currency: "USD" } })]);
  try {
    await assert.rejects(fetchFinlyOffers("k"), /không phải CAD/);
  } finally {
    restore();
  }
});

test("401 ném ngay với mã HTTP đứng đầu câu lỗi", async () => {
  let calls = 0;
  const restore = mockFetch([
    () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: "invalid_api_key", message: "nope" } }), { status: 401 });
    },
  ]);
  try {
    await assert.rejects(fetchFinlyOffers("k"), /^Error: 401 Finly API invalid_api_key/);
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test("429 thì chờ rồi thử lại", async () => {
  const restore = mockFetch([
    () => new Response("{}", { status: 429, headers: { "retry-after": "0" } }),
    () => page([rawOffer({ amount: 50 })]),
  ]);
  try {
    const offers = await fetchFinlyOffers("k");
    assert.equal(offers[0].rebate?.amount, 50);
  } finally {
    restore();
  }
});
