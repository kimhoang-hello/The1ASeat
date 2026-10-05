import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cardFactsFor,
  cardFactsFrom,
  hasRateEvidence,
  hasUnchecked,
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
import { VERIFIED_NONE } from "./card-facts-none.ts";

const AS_OF = "2026-10-04";
/** Ngày trước đợt kiểm tại trang ngân hàng — các ô "Chưa kiểm" còn nguyên. */
const BEFORE_CHECK = "2026-10-03";

/** Thẻ thêm SAU `AS_OF` thì kiểm ở ngày nó vào kho — trước đó đúng là chưa có bảng. */
const asOfFor = (product: { effectiveFrom: string }) =>
  product.effectiveFrom > AS_OF ? product.effectiveFrom : AS_OF;

const lines = (slug: string, key: CardFactKey, asOf = AS_OF) =>
  cardFactsFor(slug, asOf)!.facts.find((fact) => fact.key === key)!.lines.map((line) => line.text);

test("mọi thẻ có trang trên site: đủ bốn dòng, đúng thứ tự", () => {
  for (const product of PRODUCTS.filter((row) => row.contentfulLinked)) {
    const facts = cardFactsFor(product.slug, asOfFor(product));
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

test("TD® Cash Back từ 05/10/2026: trần $15,000 chi tiêu riêng từng nhóm", () => {
  assert.deepEqual(lines("td-cash-back-visa-infinite", "earn", "2026-10-05"), [
    "3% siêu thị, phương tiện công cộng — tối đa $15,000 chi tiêu/năm cho mỗi hạng mục, sau đó 1%",
    "3% xăng, sạc xe điện — tối đa $15,000 chi tiêu/năm, sau đó 1%",
    "3% hoá đơn định kỳ, streaming — tối đa $15,000 chi tiêu/năm, sau đó 1%",
    "1% mọi chi tiêu khác",
  ]);
});

test("tỷ lệ chỉ áp ở một nhóm merchant in kèm nhóm đó; thiếu tỷ lệ nền thì nói chưa kiểm", () => {
  const before = lines("scotiabank-gold-amex", "earn", BEFORE_CHECK);
  assert.ok(before[0].startsWith("6x siêu thị — Sobeys"), before[0]);
  assert.equal(before.at(-1), "Mọi chi tiêu khác: chưa kiểm");
  // Từ ngày kiểm tại trang Scotiabank®: đủ các nhóm, có tỷ lệ nền.
  const after = lines("scotiabank-gold-amex", "earn");
  assert.ok(after.includes("3x xăng, phương tiện công cộng, rideshare, streaming"), after.join(" | "));
  assert.equal(after.at(-1), "1x mọi chi tiêu khác");
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
  assert.deepEqual(lines("scotiabank-gold-amex", "lounge", BEFORE_CHECK), ["Priority Pass™ (số lượt miễn phí chưa kiểm)"]);
});

test("đã kiểm là không có lượt miễn phí: nói trả phí, không nói chưa kiểm", () => {
  assert.deepEqual(lines("scotiabank-gold-amex", "lounge"), ["Giảm giá thẻ hội viên Priority Pass™ (mỗi lượt vào trả phí)"]);
  assert.ok(lines("amex-aeroplan-reserve", "lounge").includes("Priority Pass™ (mỗi lượt vào trả phí)"));
});

test("thiếu dữ liệu thì dòng rỗng (trang ghi Chưa kiểm), không suy đoán", () => {
  assert.deepEqual(lines("td-first-class-travel-visa-infinite", "earn", BEFORE_CHECK), []);
  assert.deepEqual(lines("amex-cobalt", "lounge", BEFORE_CHECK), []);
});

test("đã kiểm là không có: ghi Không có, và chỉ từ ngày kiểm", () => {
  assert.deepEqual(lines("amex-cobalt", "lounge"), ["Không có"]);
  assert.deepEqual(lines("amex-green", "insurance"), ["Không có bảo hiểm du lịch hay thiết bị"]);
  assert.deepEqual(lines("amex-green", "insurance", BEFORE_CHECK), []);
});

test("hạng mục mỗi cái một trần y hệt nhau gộp thành một ý 'cho mỗi hạng mục'", () => {
  const earn = lines("td-first-class-travel-visa-infinite", "earn");
  assert.ok(
    earn.includes("6x siêu thị, ăn uống, phương tiện công cộng — tối đa $25,000 chi tiêu/năm cho mỗi hạng mục, sau đó 2x"),
    earn.join(" | "),
  );
  // Nhóm nhiều hạng mục CHUNG một trần vẫn tách riêng (TD® Cash Back).
  assert.equal(lines("td-cash-back-visa-infinite", "earn").filter((line) => line.startsWith("3%")).length, 2);
});

test("số của bảo hiểm thuê xe là giá trị xe, không phải hạn mức bồi thường", () => {
  assert.ok(lines("amex-business-platinum", "insurance").includes("Thuê xe (xe tới $85,000)"));
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
  none: VERIFIED_NONE,
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

test("hasUnchecked: dòng rỗng và ý chưa kiểm một phần đều tính; 04/10/2026 không thẻ nào còn", () => {
  const linked = PRODUCTS.filter((row) => row.contentfulLinked);
  // Trước đợt kiểm: có thẻ còn ô rỗng hoặc "(số lượt miễn phí chưa kiểm)".
  assert.ok(linked.some((product) => hasUnchecked(cardFactsFor(product.slug, BEFORE_CHECK)!)));
  assert.ok(lines("scotiabank-gold-amex", "lounge", BEFORE_CHECK)[0].includes("chưa kiểm"));
  assert.equal(hasUnchecked(cardFactsFor("scotiabank-gold-amex", BEFORE_CHECK)!), true);
  for (const product of linked) {
    assert.equal(hasUnchecked(cardFactsFor(product.slug, asOfFor(product))!), false, product.slug);
  }
  // Ý chưa kiểm một phần, không có dòng rỗng nào: vẫn phải tính.
  assert.equal(
    hasUnchecked({
      cashBack: false,
      facts: [{ key: "earn", lines: [{ text: "Mọi chi tiêu khác: chưa kiểm", sources: [], unchecked: true }] }],
    }),
    true,
  );
});
