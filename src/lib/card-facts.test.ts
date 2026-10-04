import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cardFactsFor,
  cardFactsFrom,
  hasRateEvidence,
  numbersIn,
  rateClaimsIn,
  withoutRateClaims,
  type CardFactKey,
  type CardFactsData,
} from "./card-facts.ts";
import { PRODUCTS } from "./recommendation/data/products.ts";
import { EARNING_CAPS, EARNING_RATES } from "./recommendation/data/earning-rates.ts";
import { PRODUCT_BENEFITS } from "./recommendation/data/product-benefits.ts";
import { ELIGIBILITY_RULES } from "./recommendation/data/eligibility-rules.ts";
import { POINTS_PROGRAMS } from "./recommendation/data/points-programs.ts";

const AS_OF = "2026-10-04";

const lines = (slug: string, key: CardFactKey) =>
  cardFactsFor(slug, AS_OF)!.facts.find((fact) => fact.key === key)!.lines.map((line) => line.text);

test("mọi thẻ có trang trên site: đủ bốn dòng, đúng thứ tự", () => {
  for (const product of PRODUCTS.filter((row) => row.contentfulLinked)) {
    const facts = cardFactsFor(product.slug, AS_OF);
    assert.ok(facts, product.slug);
    assert.deepEqual(
      facts.facts.map((fact) => fact.key),
      ["earn", "eligibility", "lounge", "insurance"],
      product.slug,
    );
  }
});

test("slug engine không biết, hoặc ngày trước khi thẻ có trong kho: không có bảng", () => {
  assert.equal(cardFactsFor("khong-co-the-nay", AS_OF), null);
  assert.equal(cardFactsFor("amex-cobalt", "2000-01-01"), null);
});

test("tỷ lệ kèm trần, tỷ lệ nền đứng cuối", () => {
  const earn = lines("amex-cobalt", "earn");
  assert.equal(earn[0], "5x ăn uống, giao đồ ăn, siêu thị — tối đa 12,500 điểm/tháng, sau đó 1x");
  assert.equal(earn.at(-1), "1x mọi chi tiêu khác");
});

test("thẻ cashback: % và trần tính bằng đô hoàn lại, hai trần riêng là hai ý", () => {
  assert.equal(cardFactsFor("td-cash-back-visa-infinite", AS_OF)!.cashBack, true);
  const earn = lines("td-cash-back-visa-infinite", "earn");
  assert.equal(earn.filter((line) => line.startsWith("3%") && line.includes("$450 hoàn tiền/năm")).length, 2);
});

test("tỷ lệ chỉ áp ở một nhóm merchant in kèm nhóm đó; thiếu tỷ lệ nền thì nói chưa kiểm", () => {
  const earn = lines("scotiabank-gold-amex", "earn");
  assert.ok(earn[0].startsWith("6x siêu thị — Sobeys"), earn[0]);
  assert.equal(earn.at(-1), "Mọi chi tiêu khác: chưa kiểm");
});

test("hệ số lẻ vô hạn viết thành điểm trên số đô", () => {
  assert.ok(lines("td-aeroplan-visa-platinum", "earn").includes("1 điểm/$1.50 mọi chi tiêu khác"));
});

test("tỷ lệ nền đứng một mình là mọi chi tiêu, không phải mọi chi tiêu khác", () => {
  assert.deepEqual(lines("wealthsimple-visa-infinite-plus", "earn"), ["2% mọi chi tiêu"]);
});

test("điều kiện thu nhập nối bằng HOẶC; thẻ doanh nghiệp nói cần doanh nghiệp", () => {
  assert.deepEqual(lines("td-aeroplan-visa-infinite", "eligibility"), [
    "Thu nhập từ $60,000 cá nhân hoặc $100,000 hộ gia đình",
  ]);
  assert.ok(lines("amex-business-gold", "eligibility").includes("Cần có doanh nghiệp"));
  assert.deepEqual(lines("amex-cobalt", "eligibility"), ["Không yêu cầu thu nhập tối thiểu"]);
});

test("phòng chờ không rõ số lượt: không đoán miễn phí, không in ghi chú nội bộ", () => {
  const lounge = lines("scotiabank-gold-amex", "lounge");
  assert.deepEqual(lounge, ["Priority Pass (số lượt miễn phí chưa kiểm)"]);
});

test("thiếu dữ liệu thì dòng rỗng (trang ghi Chưa kiểm), không suy đoán", () => {
  assert.deepEqual(lines("td-first-class-travel-visa-infinite", "earn"), []);
  assert.deepEqual(lines("amex-cobalt", "lounge"), []);
});

test("numbersIn đọc số theo cùng một luật cho bảng và nội dung", () => {
  assert.deepEqual(numbersIn("tối đa 12,500 điểm/tháng"), [12500]);
  assert.deepEqual(numbersIn("14 ngày đến $2M (dưới 65 tuổi)"), [14, 2_000_000, 65]);
  assert.deepEqual(numbersIn("15 ngày tới $5 triệu"), [15, 5_000_000]);
  assert.deepEqual(numbersIn("1.25x · 1 điểm/$1.50"), [1.25, 1, 1.5]);
  assert.deepEqual(numbersIn("2 Mastercard®"), [2]);
});

const SITE: CardFactsData = {
  products: PRODUCTS,
  programs: POINTS_PROGRAMS,
  rates: EARNING_RATES,
  caps: EARNING_CAPS,
  benefits: PRODUCT_BENEFITS,
  rules: ELIGIBILITY_RULES,
};
const earnFrom = (data: CardFactsData, slug: string) =>
  cardFactsFrom(data, slug, AS_OF)!.facts.find((fact) => fact.key === "earn")!.lines.map((line) => line.text);

test("hạn mức huỷ chuyến không bị gán cho cả gián đoạn chuyến", () => {
  const insurance = lines("td-aeroplan-visa-infinite-privilege", "insurance");
  assert.ok(insurance.includes("Huỷ chuyến tới $2,500"), insurance.join(" | "));
  assert.ok(!insurance.some((line) => line.includes("gián đoạn chuyến tới")));
  // Không có số thì vẫn là tên chung của quyền lợi.
  assert.ok(lines("westjet-rbc-world-elite-mastercard", "insurance").includes("Huỷ/gián đoạn chuyến"));
});

test("trần hết hiệu lực hoặc chưa kiểm: tỷ lệ không được trông như không giới hạn", () => {
  const staleCaps = EARNING_CAPS.map((cap) =>
    cap.productId === ("prd_amex-cobalt" as typeof cap.productId) ? { ...cap, confidence: "stale" as const } : cap,
  );
  assert.equal(earnFrom({ ...SITE, caps: staleCaps }, "amex-cobalt")[0], "5x ăn uống, giao đồ ăn, siêu thị — trần: chưa kiểm");
  const closedCaps = EARNING_CAPS.map((cap) =>
    cap.productId === ("prd_amex-cobalt" as typeof cap.productId) ? { ...cap, effectiveTo: "2026-01-01" } : cap,
  );
  assert.equal(earnFrom({ ...SITE, caps: closedCaps }, "amex-cobalt")[0], "5x ăn uống, giao đồ ăn, siêu thị — trần: chưa kiểm");
});

test("(ước tính) gắn theo MỌI nguồn của dòng — kể cả trần và nhánh không có số", () => {
  const estimatedCaps = EARNING_CAPS.map((cap) =>
    cap.productId === ("prd_amex-cobalt" as typeof cap.productId) ? { ...cap, confidence: "estimated" as const } : cap,
  );
  assert.ok(earnFrom({ ...SITE, caps: estimatedCaps }, "amex-cobalt")[0].endsWith("(ước tính)"));
  const estimatedRules = ELIGIBILITY_RULES.map((rule) =>
    rule.ruleType === "business_required" ? { ...rule, confidence: "estimated" as const } : rule,
  );
  const eligibility = cardFactsFrom({ ...SITE, rules: estimatedRules }, "amex-business-gold", AS_OF)!
    .facts.find((fact) => fact.key === "eligibility")!.lines.map((line) => line.text);
  assert.ok(eligibility.includes("Cần có doanh nghiệp (ước tính)"), eligibility.join(" | "));
});

test("tỷ lệ phải có mặt CÙNG dạng — số trùng ở chỗ khác không tính", () => {
  const content =
    "Hoàn 10% trong 3 tháng đầu. Hoàn 2% cho siêu thị (sau đó về 1%). X6 điểm tại Sobeys. " +
    "Tích 1.25 điểm Avion®/$1. 5x điểm cho ăn uống. Tích 1 điểm Aeroplan®/$1 cho xăng; 1 điểm/$1.50 cho mọi chi tiêu khác.";
  const x = (value: number) => ({ kind: "multiplier" as const, value, unit: "x" as const });
  const pct = (value: number) => ({ kind: "multiplier" as const, value, unit: "%" as const });
  assert.equal(hasRateEvidence(content, pct(3)), false, "chữ '3 tháng' không phải bằng chứng cho 3%");
  assert.equal(hasRateEvidence(content, pct(2)), true);
  assert.equal(hasRateEvidence(content, x(6)), true);
  assert.equal(hasRateEvidence(content, x(1.25)), true);
  assert.equal(hasRateEvidence(content, x(5)), true);
  assert.equal(hasRateEvidence(content, x(1)), true, "1 điểm/$1 là 1x");
  assert.equal(hasRateEvidence(content, x(0.25)), false, "1.25 không chứng cho 0.25");
  assert.equal(hasRateEvidence(content, { kind: "perDollar", points: 1, dollars: 1.5 }), true);
  assert.equal(hasRateEvidence(content, { kind: "perDollar", points: 1, dollars: 2 }), false);
});

test("mẫu số phải khớp: '2 điểm cho mỗi $3' không chứng cho 2x", () => {
  const claim = { kind: "multiplier" as const, value: 2, unit: "x" as const };
  assert.equal(hasRateEvidence("Tích 2 điểm cho mỗi $3 chi tiêu", claim), false);
  assert.equal(hasRateEvidence("Tích 2 điểm/$1 cho siêu thị", claim), true);
  assert.equal(hasRateEvidence("Tích 2 điểm cho siêu thị", claim), true, "không nêu mẫu số = mỗi $1");
  assert.equal(hasRateEvidence("Tích 2 điểm WestJet® cho mỗi $1 chi tiêu", claim), true);
  // Mẫu số của vế SAU không được gán cho vế trước — cả hai chiều.
  assert.equal(
    hasRateEvidence("Tích 2 điểm cho siêu thị, 1 điểm/$1.50 cho chi tiêu khác", claim),
    true,
    "vế đầu không có mẫu số",
  );
  assert.equal(
    hasRateEvidence("Tích 1 điểm cho xăng, 2 điểm/$1.50 cho chi tiêu khác", { kind: "perDollar", points: 1, dollars: 1.5 }),
    false,
    "1 điểm của vế đầu + $1.50 của vế sau không phải '1 điểm/$1.50'",
  );
  assert.equal(hasRateEvidence("1 điểm Scene+™/$2", { kind: "perDollar", points: 1, dollars: 2 }), true);
});

test("số 0 thừa ở đuôi vẫn là cùng một tỷ lệ", () => {
  assert.equal(hasRateEvidence("Cashback 2.00% cho mọi chi tiêu", { kind: "multiplier", value: 2, unit: "%" }), true);
  assert.equal(hasRateEvidence("2.0 điểm/$1", { kind: "multiplier", value: 2, unit: "x" }), true);
  assert.equal(hasRateEvidence("2.5x điểm", { kind: "multiplier", value: 2, unit: "x" }), false);
});

test("đọc tỷ lệ trong dòng và phần số còn lại", () => {
  assert.deepEqual(rateClaimsIn("3% siêu thị — tối đa $450 hoàn tiền/năm, sau đó 1%"), [
    { kind: "multiplier", value: 3, unit: "%" },
    { kind: "multiplier", value: 1, unit: "%" },
  ]);
  assert.deepEqual(rateClaimsIn("1 điểm/$1.50 mọi chi tiêu khác"), [{ kind: "perDollar", points: 1, dollars: 1.5 }]);
  assert.deepEqual(numbersIn(withoutRateClaims("5x ăn uống — tối đa 12,500 điểm/tháng, sau đó 1x")), [12500]);
  assert.deepEqual(numbersIn(withoutRateClaims("1 điểm/$1.50 mọi chi tiêu khác")), []);
});

test("trần ở tỷ lệ nhóm merchant cũng được xét — không có trần dùng được thì nói chưa kiểm", () => {
  const capId = EARNING_CAPS[0].id;
  const rates = EARNING_RATES.map((rate) =>
    rate.productId === ("prd_scotiabank-gold-amex" as typeof rate.productId) && rate.restrictedTo !== null
      ? { ...rate, capId }
      : rate,
  );
  assert.ok(earnFrom({ ...SITE, rates }, "scotiabank-gold-amex")[0].endsWith("— trần: chưa kiểm"));
});

test("hạn mức nằm trong chữ mô tả vẫn mang nhãn huỷ chuyến, không phải huỷ/gián đoạn", () => {
  const benefits = PRODUCT_BENEFITS.map((row) =>
    row.productId === ("prd_td-aeroplan-visa-infinite-privilege" as typeof row.productId) &&
    row.benefitId === ("trip-cancellation-insurance" as typeof row.benefitId)
      ? { ...row, textValue: "tối đa $2,500 mỗi người" }
      : row,
  );
  const insurance = cardFactsFrom({ ...SITE, benefits }, "td-aeroplan-visa-infinite-privilege", AS_OF)!
    .facts.find((fact) => fact.key === "insurance")!.lines.map((line) => line.text);
  assert.ok(insurance.includes("Huỷ chuyến (tối đa $2,500 mỗi người)"), insurance.join(" | "));
});
