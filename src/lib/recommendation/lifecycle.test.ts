// Mười kịch bản vòng đời mà một kho dữ liệu sản phẩm tài chính PHẢI chịu được.
//
//   npm run test:reco
//
// Mỗi test dựng thay đổi ĐÚNG NHƯ người biên tập sẽ làm — thêm dòng, đóng dòng
// cũ — rồi đòi hai điều: bộ dữ liệu vẫn hợp lệ, VÀ một truy vấn tại thời điểm
// cũ vẫn trả về sự thật cũ. Vế thứ hai mới là vế khó, và là vế Phase 4 sống
// bằng: giải thích được vì sao khuyến nghị tháng trước khác tháng này.

import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineDataset } from "./data/index.ts";
import { indexDataset } from "./indexes.ts";
import { datasetAt, oneActiveAt } from "./temporal.ts";
import { validateDataset } from "./validate.ts";
import type {
  EarningRate,
  Offer,
  ProductBenefit,
  ProductFee,
  RecommendationDataset,
  TransferPath,
} from "./types.ts";

const BASE = offlineDataset();
/** Ngày dùng cho phép kiểm độ tươi. Cố định để test không mục theo thời gian
 *  thật — bộ seed kiểm ngày 07/09/2026. */
const TODAY = "2026-09-20";
const LATER = "2027-03-01";

function errorsIn(data: RecommendationDataset, asOf = TODAY): string[] {
  return validateDataset(data, asOf)
    .filter((issue) => issue.level === "error")
    .map((issue) => `[${issue.entity}] ${issue.message}`);
}

/** Đóng một bản ghi lại vào ngày `on`, đúng cách người biên tập phải làm. */
function close<T extends { effectiveTo: string | null }>(row: T, on: string): T {
  return { ...row, effectiveTo: on };
}

test("bộ dữ liệu nền không lỗi", () => {
  assert.deepEqual(errorsIn(BASE), []);
});

/* --------------------------------------------------------------- *
 * 1. Thẻ đang có nhận welcome offer MỚI
 * --------------------------------------------------------------- */
test("1. offer mới nối tiếp offer cũ, và offer cũ vẫn tra được", () => {
  const old = BASE.offers.find((o) => o.headlineBonus !== null)!;
  const fresh: Offer = {
    ...old,
    id: `${old.id}_v2` as Offer["id"],
    headlineBonus: (old.headlineBonus ?? 0) + 20000,
    effectiveFrom: "2026-11-01",
    effectiveTo: null,
    startDate: "2026-11-01",
  };
  const next = {
    ...BASE,
    offers: [close(old, "2026-10-31"), fresh, ...BASE.offers.filter((o) => o.id !== old.id)],
  };
  assert.deepEqual(errorsIn(next, "2026-11-15"), []);

  // Truy vấn tại NGÀY CŨ vẫn thấy mức cũ. Đây là điều Phase 4 cần để giải
  // thích một khuyến nghị đã đưa ra trước ngày 01/11.
  const then = datasetAt(next, "2026-10-01");
  assert.equal(
    then.offers.find((o) => o.productId === old.productId)?.headlineBonus,
    old.headlineBonus,
  );
  const now = datasetAt(next, "2026-11-15");
  assert.equal(
    now.offers.find((o) => o.productId === old.productId)?.headlineBonus,
    fresh.headlineBonus,
  );
});

/* --------------------------------------------------------------- *
 * 2. Phí thường niên đổi
 * --------------------------------------------------------------- */
test("2. đổi phí không đụng tới id sản phẩm, nên không khoá ngoại nào gãy", () => {
  const old = BASE.productFees[0];
  const raised: ProductFee = {
    ...old,
    id: `${old.id}_v2` as ProductFee["id"],
    annualFee: old.annualFee + 50,
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    verifiedAt: "2027-01-01",
  };
  const next = {
    ...BASE,
    productFees: [close(old, "2026-12-31"), raised, ...BASE.productFees.slice(1)],
  };
  assert.deepEqual(errorsIn(next, LATER), []);

  // Sản phẩm giữ NGUYÊN id, nên offer/tỷ lệ/quyền lợi/điều kiện của nó vẫn
  // trỏ đúng chỗ. Đây chính là thứ không làm được khi phí còn nằm trên Product.
  const product = next.products.find((p) => p.id === old.productId)!;
  assert.equal(product.id, old.productId);
  assert.equal(oneActiveAt(next.productFees.filter((f) => f.productId === product.id), "2026-10-01")?.annualFee, old.annualFee);
  assert.equal(oneActiveAt(next.productFees.filter((f) => f.productId === product.id), LATER)?.annualFee, raised.annualFee);
});

/* --------------------------------------------------------------- *
 * 3. Quyền lợi đổi
 * --------------------------------------------------------------- */
test("3. quyền lợi đổi giá trị: hai bản không đụng id, tra theo ngày ra hai kết quả", () => {
  const old = BASE.productBenefits.find((b) => b.numericValue !== null)!;
  const changed: ProductBenefit = {
    ...old,
    id: `${old.id}_v2` as ProductBenefit["id"],
    numericValue: (old.numericValue ?? 0) + 2,
    effectiveFrom: "2027-02-01",
    effectiveTo: null,
    verifiedAt: "2027-02-01",
  };
  const next = {
    ...BASE,
    productBenefits: [
      close(old, "2027-01-31"),
      changed,
      ...BASE.productBenefits.filter((b) => b.id !== old.id),
    ],
  };
  assert.deepEqual(errorsIn(next, LATER), []);
  assert.notEqual(old.id, changed.id, "id phải khác nhau, nếu không bản mới đè bản cũ");
});

/* --------------------------------------------------------------- *
 * 4. Tỷ lệ tích điểm đổi
 * --------------------------------------------------------------- */
test("4. tỷ lệ tích điểm đổi, và tỷ lệ cũ vẫn tra được tại ngày cũ", () => {
  const old = BASE.earningRates.find((r) => r.category === "everything_else")!;
  const cut: EarningRate = {
    ...old,
    id: `${old.id}_v2` as EarningRate["id"],
    multiplier: old.multiplier / 2,
    effectiveFrom: "2027-02-01",
    effectiveTo: null,
    verifiedAt: "2027-02-01",
  };
  const next = {
    ...BASE,
    earningRates: [close(old, "2027-01-31"), cut, ...BASE.earningRates.filter((r) => r.id !== old.id)],
  };
  assert.deepEqual(errorsIn(next, LATER), []);
  const before = datasetAt(next, "2026-12-01").earningRates.find((r) => r.id === old.id);
  assert.equal(before?.multiplier, old.multiplier);
});

/* --------------------------------------------------------------- *
 * 5. Tỷ lệ chuyển điểm đổi
 * --------------------------------------------------------------- */
test("5. tỷ lệ chuyển đổi: bản cũ đóng lại, không bị ghi đè", () => {
  const old = BASE.transferPaths[0];
  const devalued: TransferPath = {
    ...old,
    id: `${old.id}_v2` as TransferPath["id"],
    ratioTo: Math.round(old.ratioTo * 0.8),
    effectiveFrom: "2027-01-15",
    effectiveTo: null,
    verifiedAt: "2027-01-15",
  };
  const next = {
    ...BASE,
    transferPaths: [close(old, "2027-01-14"), devalued, ...BASE.transferPaths.slice(1)],
  };
  assert.deepEqual(errorsIn(next, LATER), []);
  assert.equal(datasetAt(next, "2026-10-01").transferPaths.find((t) => t.id === old.id)?.ratioTo, old.ratioTo);

  // Hai bản chồng thời gian phải là LỖI — nếu không, "chuyển được bao nhiêu"
  // có hai câu trả lời cùng lúc.
  const overlapping = { ...next, transferPaths: [old, devalued, ...BASE.transferPaths.slice(1)] };
  assert.ok(errorsIn(overlapping, LATER).some((e) => e.includes("chồng thời gian")));
});

/* --------------------------------------------------------------- *
 * 6. Thẻ mới ra mắt
 * --------------------------------------------------------------- */
test("6. thẻ mới cần dòng phí, nếu không engine chỉ thấy lợi ích mà không thấy chi phí", () => {
  const model = BASE.products[0];
  const launched = {
    ...model,
    id: "prd_new-card" as typeof model.id,
    slug: "new-card",
    name: "Thẻ mới",
    effectiveFrom: "2027-01-01",
    availableFrom: "2027-01-01",
    familyId: null,
    tierRank: null,
  };
  const withoutFee = { ...BASE, products: [...BASE.products, launched] };
  assert.ok(
    errorsIn(withoutFee, LATER).some((e) => e.includes("không có dòng phí nào còn hiệu lực")),
    "thẻ còn hoạt động mà không có phí phải là lỗi",
  );
});

/* --------------------------------------------------------------- *
 * 7. Thẻ ngừng bán
 * --------------------------------------------------------------- */
test("7. thẻ ngừng phát hành: offer phải đóng, nhưng tỷ lệ và quyền lợi thì KHÔNG", () => {
  const victim = BASE.products[0];
  const unavailable = { ...victim, availableTo: "2026-12-31" };
  const offersStillOpen = { ...BASE, products: [unavailable, ...BASE.products.slice(1)] };
  // Offer còn mở → engine sẽ khuyên người đọc mở một thẻ không còn nhận đơn.
  assert.ok(errorsIn(offersStillOpen, LATER).some((e) => e.includes("offer vẫn chưa đóng")));

  const properly = {
    ...offersStillOpen,
    offers: BASE.offers.map((o) => (o.productId === victim.id ? close(o, "2026-12-31") : o)),
  };
  assert.deepEqual(errorsIn(properly, LATER), []);

  // ĐIỂM MẤU CHỐT: thẻ vẫn còn trong dữ liệu SAU khi ngừng phát hành, và tỷ lệ
  // tích điểm của nó vẫn chạy — người dùng còn cầm nó trong ví. Gộp "ngừng
  // phát hành" với "hết tồn tại" sẽ làm Portfolio Analyzer quên mất thẻ đó.
  const after = datasetAt(properly, LATER);
  assert.ok(after.products.some((p) => p.id === victim.id), "thẻ vẫn phải có mặt");
  assert.ok(
    after.earningRates.some((r) => r.productId === victim.id),
    "tỷ lệ tích điểm vẫn phải chạy cho người đang giữ thẻ",
  );
  assert.ok(
    !after.offers.some((o) => o.productId === victim.id),
    "nhưng không còn offer nào để khuyên mở",
  );
  // Và sự thật cũ vẫn tra được.
  const before = datasetAt(properly, "2026-10-01");
  assert.ok(before.offers.some((o) => o.productId === victim.id));
});

/* --------------------------------------------------------------- *
 * 8. Thẻ đổi tên / có bản kế nhiệm
 * --------------------------------------------------------------- */
test("8a. đổi tên KHÔNG đổi id, nên không tham chiếu nào gãy", () => {
  const original = BASE.products[0];
  const renamed = { ...original, slug: "ten-moi-hoan-toan", name: "Tên mới hoàn toàn" };
  const next = { ...BASE, products: [renamed, ...BASE.products.slice(1)] };

  assert.deepEqual(errorsIn(next), []);
  assert.equal(renamed.id, original.id, "đổi tên không được đụng tới khoá chính");
  // Mọi bản ghi con vẫn tìm thấy chủ của nó.
  const index = indexDataset(next);
  assert.ok((index.offersByProduct.get(original.id) ?? []).length > 0);
  assert.ok((index.ratesByProduct.get(original.id) ?? []).length > 0);
  assert.equal(index.productBySlug.get("ten-moi-hoan-toan")?.id, original.id);
});

test("8b. thẻ có bản kế nhiệm: chuỗi lần được, vòng lặp bị chặn", () => {
  const old = BASE.products[0];
  const successor = {
    ...old,
    id: "prd_successor" as typeof old.id,
    slug: "the-ke-nhiem",
    name: "Thẻ kế nhiệm",
    effectiveFrom: "2027-01-01",
    availableFrom: "2027-01-01",
    // Thẻ kế nhiệm là một sản phẩm RIÊNG, không phải một hạng của họ cũ —
    // sao chép nguyên `familyId`/`tierRank` sẽ đụng hạng với thẻ nó thay thế.
    familyId: null,
    tierRank: null,
  };
  const closedOld = { ...old, availableTo: "2026-12-31", supersededByProductId: successor.id };
  const next = {
    ...BASE,
    products: [closedOld, successor, ...BASE.products.slice(1)],
    // Phí của thẻ cũ KHÔNG đóng: người đang giữ thẻ vẫn phải trả nó hằng năm.
    // Ngừng nhận đơn mới không làm phí biến mất.
    productFees: [
      ...BASE.productFees,
      { ...BASE.productFees[0], id: "fee_successor" as ProductFee["id"], productId: successor.id },
    ],
    offers: BASE.offers.map((o) => (o.productId === old.id ? close(o, "2026-12-31") : o)),
  };
  assert.deepEqual(errorsIn(next, LATER), []);

  const cycle = {
    ...next,
    products: [
      closedOld,
      { ...successor, availableTo: "2027-06-30", supersededByProductId: old.id },
      ...BASE.products.slice(1),
    ],
  };
  assert.ok(errorsIn(cycle, "2027-08-01").some((e) => e.includes("vòng lặp")));
});

/* --------------------------------------------------------------- *
 * 9. Offer nhiều chặng: một thành phần đổi
 * --------------------------------------------------------------- */
test("9. sửa một thành phần = một offer MỚI, thành phần cũ đi theo offer cũ", () => {
  const old = BASE.offers.find(
    (o) => BASE.offerComponents.filter((c) => c.offerId === o.id).length >= 3,
  )!;
  const oldComponents = BASE.offerComponents.filter((c) => c.offerId === old.id);

  const fresh: Offer = {
    ...old,
    id: `${old.id}_v2` as Offer["id"],
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    startDate: "2027-01-01",
  };
  // Thành phần KHÔNG có Temporal riêng — chúng thừa kế hiệu lực của offer. Nên
  // sửa một mốc chi là clone cả gói, không phải vá một dòng. Đó là đúng: một
  // offer là một gói điều khoản, và "mốc thứ hai đổi còn mốc nhất giữ nguyên"
  // vẫn là một offer khác với offer cũ.
  const freshComponents = oldComponents.map((c, i) => ({
    ...c,
    id: `${c.id}_v2` as typeof c.id,
    offerId: fresh.id,
    spendRequirement: i === 1 ? (c.spendRequirement ?? 0) + 1000 : c.spendRequirement,
  }));

  const next = {
    ...BASE,
    offers: [close(old, "2026-12-31"), fresh, ...BASE.offers.filter((o) => o.id !== old.id)],
    offerComponents: [...BASE.offerComponents, ...freshComponents],
  };
  assert.deepEqual(errorsIn(next, LATER), []);

  // Tra tại ngày cũ: đúng gói cũ, đủ số thành phần, và mốc chi CHƯA đổi.
  const then = datasetAt(next, "2026-10-01");
  const thenComponents = then.offerComponents.filter((c) => c.offerId === old.id);
  assert.equal(thenComponents.length, oldComponents.length);
  assert.deepEqual(
    thenComponents.map((c) => c.spendRequirement),
    oldComponents.map((c) => c.spendRequirement),
  );
  // Và tra tại ngày mới thì KHÔNG còn thấy thành phần của offer cũ.
  const now = datasetAt(next, LATER);
  assert.equal(now.offerComponents.filter((c) => c.offerId === old.id).length, 0);
});

/* --------------------------------------------------------------- *
 * 10. Khuyến nghị cũ vẫn giải thích được
 * --------------------------------------------------------------- */
test("10. dựng lại toàn bộ thế giới như nó ở một ngày trong quá khứ", () => {
  // Kịch bản gộp: cùng lúc đổi phí, đổi offer, và ngừng một thẻ khác.
  const feeRow = BASE.productFees[0];
  const offerRow = BASE.offers.find((o) => o.productId !== feeRow.productId && o.headlineBonus !== null)!;
  const victim = BASE.products.find(
    (p) => p.id !== feeRow.productId && p.id !== offerRow.productId,
  )!;

  const next: RecommendationDataset = {
    ...BASE,
    products: BASE.products.map((p) =>
      p.id === victim.id ? { ...p, availableTo: "2026-12-31" } : p,
    ),
    productFees: [
      ...BASE.productFees.map((f) => (f.id === feeRow.id ? close(f, "2026-12-31") : f)),
      {
        ...feeRow,
        id: `${feeRow.id}_v2` as ProductFee["id"],
        annualFee: feeRow.annualFee + 60,
        effectiveFrom: "2027-01-01",
        verifiedAt: "2027-01-01",
      },
    ],
    offers: [
      ...BASE.offers.map((o) =>
        o.id === offerRow.id
          ? close(o, "2026-12-31")
          : o.productId === victim.id
            ? close(o, "2026-12-31")
            : o,
      ),
      {
        ...offerRow,
        id: `${offerRow.id}_v2` as Offer["id"],
        headlineBonus: 5000,
        effectiveFrom: "2027-01-01",
        effectiveTo: null,
      },
    ],
  };
  assert.deepEqual(errorsIn(next, LATER), []);

  // Thế giới ngày 01/10/2026 — ngày một khuyến nghị giả định đã được đưa ra.
  const then = datasetAt(next, "2026-10-01");
  assert.equal(
    oneActiveAt(then.productFees.filter((f) => f.productId === feeRow.productId), "2026-10-01")?.annualFee,
    feeRow.annualFee,
    "phí phải là phí CŨ",
  );
  assert.equal(
    then.offers.find((o) => o.productId === offerRow.productId)?.headlineBonus,
    offerRow.headlineBonus,
    "welcome bonus phải là mức CŨ",
  );
  assert.ok(
    then.products.some((p) => p.id === victim.id),
    "thẻ nay đã ngừng vẫn phải có mặt trong thế giới cũ",
  );

  // Và thế giới hôm nay khác hẳn — nếu không, `datasetAt` chẳng làm gì cả.
  const now = datasetAt(next, LATER);
  assert.equal(
    oneActiveAt(now.productFees.filter((f) => f.productId === feeRow.productId), LATER)?.annualFee,
    feeRow.annualFee + 60,
  );
  // Thẻ ngừng phát hành VẪN có mặt — danh tính là vĩnh viễn. Cái mất đi là
  // offer của nó.
  assert.ok(now.products.some((p) => p.id === victim.id));
  assert.ok(!now.offers.some((o) => o.productId === victim.id));
});

/* --------------------------------------------------------------- *
 * Ràng buộc kiểu database mà một validator dễ bỏ sót
 * --------------------------------------------------------------- */

test("trần tích điểm DÙNG CHUNG chỉ đếm một lần", () => {
  // TD® Cash Back có trần $450/năm dùng chung cho bốn hạng mục và một trần
  // $450 KHÁC cho hai hạng mục nữa. Chép trần vào từng dòng thì sáu dòng trông
  // như sáu cái trần độc lập, và engine cấp $2,700 thay vì $900.
  const td = BASE.products.find((p) => p.slug === "td-cash-back-visa-infinite")!;
  const rates = BASE.earningRates.filter((r) => r.productId === td.id && r.capId !== null);
  const distinctCaps = new Set(rates.map((r) => r.capId));
  assert.equal(rates.length, 6, "sáu hạng mục có trần");
  assert.equal(distinctCaps.size, 2, "nhưng chỉ HAI cái trần");

  const caps = BASE.earningCaps.filter((c) => c.productId === td.id);
  assert.equal(caps.reduce((sum, c) => sum + c.amount, 0), 90000, "tổng trần là $900, không phải $2,700");
});

test("quyền lợi cùng tên nhưng khác hãng KHÔNG trùng nhau", () => {
  // spec §16 Rule 6. Cờ `duplicatesAcrossCards` một mình là cờ toàn cục, nên
  // nó sẽ triệt tiêu giá trị thẻ United® chỉ vì người dùng đã có thẻ Aeroplan®.
  const bags = BASE.productBenefits.filter((b) => (b.benefitId as string) === "free-checked-bag");
  const providers = new Set(bags.map((b) => b.provider));
  assert.ok(providers.size > 1, "phải phân biệt được hãng cấp quyền lợi");
  assert.ok(providers.has("Air Canada®") && providers.has("United®"));
});

test("thành phần offer không được vừa trả điểm vừa trả tiền", () => {
  const component = BASE.offerComponents.find((c) => c.pointsAmount !== null)!;
  const broken = {
    ...BASE,
    offerComponents: [
      { ...component, cashAmount: 100 },
      ...BASE.offerComponents.filter((c) => c.id !== component.id),
    ],
  };
  assert.ok(errorsIn(broken).some((e) => e.includes("vừa trả điểm vừa trả tiền")));
});

test("trùng sequence trong một offer là LỖI", () => {
  const first = BASE.offerComponents.find((c) => c.sequence === 1)!;
  const broken = {
    ...BASE,
    offerComponents: [{ ...first, id: `${first.id}_dup` as typeof first.id }, ...BASE.offerComponents],
  };
  assert.ok(errorsIn(broken).some((e) => e.includes("trùng sequence")));
});

test("ngày không có thật bị chặn, không chỉ ngày sai định dạng", () => {
  // "2026-02-31" đúng hình dạng và sắp đúng thứ tự với mọi ngày khác, nên phép
  // so chuỗi không bao giờ thấy nó.
  const fee = BASE.productFees[0];
  const broken = {
    ...BASE,
    productFees: [{ ...fee, effectiveFrom: "2026-02-31" }, ...BASE.productFees.slice(1)],
  };
  assert.ok(errorsIn(broken).some((e) => e.includes("không phải một ngày có thật")));
});

test("offer targeted và offer công khai được phép chạy cùng lúc", () => {
  // Schema có `isTargeted`/`isPublic`; cấm mọi offer song song là cấm đúng thứ
  // hai trường đó sinh ra để mô tả.
  const publicOffer = BASE.offers.find((o) => o.isPublic && !o.isTargeted)!;
  const targeted = {
    ...publicOffer,
    id: `${publicOffer.id}_targeted` as typeof publicOffer.id,
    isTargeted: true,
    isPublic: false,
  };
  assert.deepEqual(errorsIn({ ...BASE, offers: [...BASE.offers, targeted] }), []);

  // Nhưng HAI offer công khai cùng lúc thì vẫn là lỗi.
  const secondPublic = {
    ...publicOffer,
    id: `${publicOffer.id}_second` as typeof publicOffer.id,
  };
  assert.ok(
    errorsIn({ ...BASE, offers: [...BASE.offers, secondPublic] }).some((e) =>
      e.includes("chồng thời gian"),
    ),
  );
});

test("thêm bản điều kiện mới mà quên đóng bản cũ là LỖI", () => {
  const rule = BASE.eligibilityRules.find((r) => r.ruleType === "minimum_personal_income")!;
  const second = {
    ...rule,
    id: `${rule.id}_v2` as typeof rule.id,
    value: 999999,
    effectiveFrom: "2027-01-01",
  };
  assert.ok(
    errorsIn({ ...BASE, eligibilityRules: [...BASE.eligibilityRules, second] }, LATER).some((e) =>
      e.includes("chồng thời gian"),
    ),
  );
});

test("dữ liệu quá hạn kiểm sinh cảnh báo, và đánh dấu stale thì thôi", () => {
  const stale = validateDataset(BASE, "2028-01-01").filter(
    (i) => i.level === "warning" && i.message.includes("kiểm lần cuối"),
  );
  assert.ok(stale.length > 0, "sang 2028 thì bộ seed 2026 phải bị nhắc kiểm lại");

  const marked = {
    ...BASE,
    offers: BASE.offers.map((o) => ({ ...o, confidence: "stale" as const })),
  };
  const remaining = validateDataset(marked, "2028-01-01").filter(
    (i) => i.entity === "offers" && i.message.includes("kiểm lần cuối"),
  );
  assert.equal(remaining.length, 0);
});

test("đính chính lùi ngày KHÔNG lọt vào bản dựng lại của quá khứ", () => {
  // Sửa một dữ kiện hôm nay, khai hiệu lực từ tháng trước. Lượt chạy tháng
  // trước không hề biết dòng này, nên dựng lại tháng đó không được thấy nó.
  const fee = BASE.productFees[0];
  const backdated = {
    ...BASE,
    productFees: [
      { ...fee, effectiveTo: "2026-09-30" },
      {
        ...fee,
        id: `${fee.id}_correction` as ProductFee["id"],
        annualFee: fee.annualFee + 25,
        effectiveFrom: "2026-10-01",
        recordedAt: "2026-12-01", // nhập MUỘN
      },
      ...BASE.productFees.slice(1),
    ],
  };

  // Không cắt theo `knownAt`: thấy cả đính chính.
  const naive = datasetAt(backdated, "2026-10-15").productFees.filter(
    (f) => f.productId === fee.productId,
  );
  assert.equal(naive.length, 1);
  assert.equal(naive[0].annualFee, fee.annualFee + 25);

  // Cắt theo những gì đã biết TÍNH ĐẾN 15/10: đính chính chưa tồn tại.
  const asKnownThen = datasetAt(backdated, "2026-10-15", { knownAt: "2026-10-15" }).productFees.filter(
    (f) => f.productId === fee.productId,
  );
  assert.equal(asKnownThen.length, 0, "dòng cũ đã đóng 30/09, dòng mới chưa nhập — đúng là không có gì");
});

test("cảnh báo hạng chuyển điểm bắt được chuỗi tiếng Việt", () => {
  // `\b` của JavaScript dựa trên ASCII nên "Chỉ Avion® Elite" không khớp — phép
  // kiểm im lặng trượt đúng chuỗi nó sinh ra để bắt.
  const path = BASE.transferPaths.find((p) => p.conditionText !== null)!;
  const broken = {
    ...BASE,
    transferPaths: [
      { ...path, conditionText: "Chỉ Avion® Elite", requiresTier: null },
      ...BASE.transferPaths.filter((p) => p.id !== path.id),
    ],
  };
  const warnings = validateDataset(broken, TODAY).filter((i) => i.level === "warning");
  assert.ok(warnings.some((w) => w.message.includes("requiresTier để trống")));
});

test("phiên bản phí mang ngày vào kho RIÊNG, không dùng hằng chung của file", () => {
  // Một đính chính nhập tháng 12 với hiệu lực từ tháng 10: truy vấn `knownAt`
  // tháng 10 KHÔNG được thấy nó. Hằng chung cho cả file sẽ cho nó lọt.
  const fee = BASE.productFees[0];
  const late = {
    ...BASE,
    productFees: [
      { ...fee, effectiveTo: "2026-09-30" },
      {
        ...fee,
        id: `${fee.id}_late` as ProductFee["id"],
        annualFee: fee.annualFee + 10,
        effectiveFrom: "2026-10-01",
        recordedAt: "2026-12-01",
      },
      ...BASE.productFees.slice(1),
    ],
  };
  const known = datasetAt(late, "2026-10-15", { knownAt: "2026-10-15" }).productFees;
  assert.ok(!known.some((f) => (f.id as string).endsWith("_late")));
  const later = datasetAt(late, "2026-12-15", { knownAt: "2026-12-15" }).productFees;
  assert.ok(later.some((f) => (f.id as string).endsWith("_late")));
});

test("nhận diện hạng chịu được dấu câu và không bắt nhầm từ chứa 'chỉ'", () => {
  const path = BASE.transferPaths[0];
  const check = (text: string) =>
    validateDataset(
      {
        ...BASE,
        transferPaths: [
          { ...path, conditionText: text, requiresTier: null },
          ...BASE.transferPaths.slice(1),
        ],
      },
      TODAY,
    ).some((i) => i.message.includes("requiresTier để trống"));

  assert.ok(check("Chỉ Avion® Elite"));
  assert.ok(check("(Chỉ Avion® Elite)"), "dấu ngoặc dính liền vẫn phải bắt được");
  assert.ok(check("Only: Avion Elite"), "dấu hai chấm dính liền vẫn phải bắt được");
  assert.ok(!check("Mọi hạng Avion®"), "câu nói KHÔNG hạn chế thì đừng cảnh báo");
  assert.ok(!check("Cần chỉnh sửa sau"), "'chỉ' nằm trong một từ khác thì không tính");
});

/* --------------------------------------------------------------- *
 * Nguyên liệu cho Phase 3 — kiểm rằng KHÔNG phải hard-code hay đọc chữ
 * --------------------------------------------------------------- */

test("các hạng của một họ thẻ nhận ra được mà không cần đoán theo slug", () => {
  // Phase 3 phải biết ba thẻ CIBC® Aeroplan® là BA HẠNG của một thẻ, không
  // phải ba lựa chọn độc lập — nếu không nó sẽ khuyên cả ba cùng lúc. Trước
  // khi có `familyId` thì cách duy nhất là `slug.startsWith("cibc-aeroplan")`,
  // tức hard-code tên sản phẩm vào logic.
  const ix = indexDataset(BASE);
  const tiers = ix.productsByFamily.get("fam_cibc-aeroplan") ?? [];
  assert.deepEqual(
    tiers.map((p) => [p.slug, p.tierRank]),
    [
      ["cibc-aeroplan-visa", 1],
      ["cibc-aeroplan-visa-infinite", 2],
      ["cibc-aeroplan-visa-infinite-privilege", 3],
    ],
    "phải sắp sẵn từ hạng thấp tới cao",
  );
  // Và họ khác KHÔNG lẫn vào, dù slug cùng chứa "aeroplan".
  assert.ok(!tiers.some((p) => p.slug.startsWith("td-") || p.slug.startsWith("amex-")));
});

test("định giá điểm đổi được mà không ghi đè lịch sử", () => {
  // Devalue là chuyện xảy ra thật, và đây là con số MỌI hàm chấm điểm nhân vào.
  const current = BASE.programValuations.find((v) => (v.programId as string) === "aeroplan")!;
  const devalued = {
    ...current,
    id: `${current.id}_v2` as typeof current.id,
    centsPerPoint: 1.4,
    effectiveFrom: "2027-01-01",
    recordedAt: "2027-01-01",
  };
  const next = {
    ...BASE,
    programValuations: [
      { ...current, effectiveTo: "2026-12-31" },
      devalued,
      ...BASE.programValuations.filter((v) => v.id !== current.id),
    ],
  };
  assert.deepEqual(errorsIn(next, LATER), []);
  assert.equal(
    oneActiveAt(datasetAt(next, "2026-10-01").programValuations.filter((v) => (v.programId as string) === "aeroplan"), "2026-10-01")?.centsPerPoint,
    current.centsPerPoint,
    "khuyến nghị cũ phải được giải thích bằng định giá CỦA LÚC ĐÓ",
  );
  assert.equal(
    oneActiveAt(datasetAt(next, LATER).programValuations.filter((v) => (v.programId as string) === "aeroplan"), LATER)?.centsPerPoint,
    1.4,
  );
});

test("chương trình nào cũng phải có định giá còn hiệu lực", () => {
  // Thiếu nó thì engine hoặc coi đồng điểm đó đáng 0 — im lặng loại mọi thẻ
  // kiếm nó — hoặc phải tự bịa một giá trị trong code.
  const broken = { ...BASE, programValuations: BASE.programValuations.slice(1) };
  assert.ok(errorsIn(broken).some((e) => e.includes("không có định giá nào còn hiệu lực")));
});

test("miễn phí theo điều kiện là QUYỀN LỢI, không phải điều kiện mở thẻ", () => {
  // Gói ngân hàng của Scotiabank® làm miễn phí thường niên; nó KHÔNG chặn ai
  // mở thẻ. Để nó trong bảng điều kiện dưới dạng một câu tiếng Việt vừa sai
  // chỗ vừa buộc engine đọc chữ.
  const gold = BASE.products.find((p) => p.slug === "scotiabank-gold-amex")!;
  const rules = BASE.eligibilityRules.filter((r) => r.productId === gold.id);
  assert.ok(!rules.some((r) => r.ruleType === "banking_relationship_required"));
  assert.ok(
    BASE.productBenefits.some(
      (b) => b.productId === gold.id && (b.benefitId as string) === "annual-fee-waiver-conditional",
    ),
    "sự thật đó phải nằm ở chỗ đúng của nó",
  );
});

test("quyền lợi có hạn thì hết hạn thật, không chỉ hết trong lời văn", () => {
  const vip = BASE.products.find((p) => p.slug === "cibc-aeroplan-visa-infinite-privilege")!;
  const lounge = BASE.productBenefits.find(
    (b) => b.productId === vip.id && (b.benefitId as string) === "maple-leaf-lounge",
  )!;
  assert.equal(lounge.effectiveTo, "2026-12-31");
  assert.ok(
    !datasetAt(BASE, "2027-06-01").productBenefits.some((b) => b.id === lounge.id),
    "sang 2027 thì engine không được cộng quyền lợi này vào giá trị thẻ nữa",
  );
});

test("chỗ trống dữ liệu là DỮ LIỆU, không phải chuỗi cảnh báo phải đọc", () => {
  // Phase 3 hạ độ tin cậy khi chạm vào chỗ trống (spec §29). Nếu chỗ trống chỉ
  // tồn tại dưới dạng cảnh báo tiếng Việt của audit thì engine phải parse chữ.
  const kinds = new Set(BASE.gaps.map((g) => g.kind));
  assert.ok(kinds.has("no_award_chart"));
  assert.ok(kinds.has("award_route_uncovered"), "4 vùng của spec §33 chưa có bảng giá");
  assert.ok(kinds.has("base_earn_rate_unknown"));
  assert.ok(kinds.has("eligibility_unknown"));

  // "Chỉ có luật cư trú" KHÔNG được đọc là "đã biết điều kiện".
  const passport = BASE.products.find((p) => p.slug === "scotiabank-passport-visa-infinite")!;
  assert.ok(
    BASE.gaps.some((g) => g.kind === "eligibility_unknown" && g.subjectId === passport.id),
  );
});

test("chỗ trống được tính LẠI cho từng thời điểm", () => {
  // Thẻ hồi đó chưa có tỷ lệ nền mà nay đã có: bản dựng lại phải nói đúng cái
  // engine thiếu LÚC ẤY, không phải cái nó thiếu hôm nay.
  const missing = BASE.gaps.find((g) => g.kind === "base_earn_rate_unknown")!;
  const fixed = {
    ...BASE,
    earningRates: [
      ...BASE.earningRates,
      {
        ...BASE.earningRates[0],
        id: "er_backfill" as (typeof BASE.earningRates)[number]["id"],
        productId: missing.subjectId as (typeof BASE.earningRates)[number]["productId"],
        category: "everything_else" as const,
        restrictedTo: null,
        effectiveFrom: "2027-01-01",
        recordedAt: "2027-01-01",
      },
    ],
  };
  const before = datasetAt(fixed, "2026-10-01");
  const after = datasetAt(fixed, LATER);
  assert.ok(before.gaps.some((g) => g.subjectId === missing.subjectId && g.kind === "base_earn_rate_unknown"));
  assert.ok(!after.gaps.some((g) => g.subjectId === missing.subjectId && g.kind === "base_earn_rate_unknown"));
});

test("Amex® Green/Cobalt/Gold KHÔNG phải các hạng của một họ", () => {
  // Ba thẻ cùng kiếm Membership Rewards® nhưng cấu trúc tích điểm khác hẳn —
  // Cobalt 5x ăn uống, Gold 2x du lịch/siêu thị, Green 1x. Gom thành họ có thứ
  // hạng sẽ khiến engine im lặng giấu đi hai trong ba.
  for (const slug of ["amex-green", "amex-cobalt", "amex-gold-rewards"]) {
    const p = BASE.products.find((x) => x.slug === slug)!;
    assert.equal(p.familyId, null, `${slug} không được thuộc họ nào`);
  }
});

test("provider chỉ gắn với quyền lợi thật sự thuộc về một hãng", () => {
  // Bảo hiểm mang provider "Air Canada®" là vô nghĩa, và làm hai thẻ khác hãng
  // trông như có hai quyền lợi khác nhau → cộng gấp đôi giá trị gia tăng.
  const insurance = BASE.productBenefits.filter((b) =>
    String(b.benefitId).includes("insurance"),
  );
  assert.ok(insurance.length > 0);
  assert.ok(insurance.every((b) => b.provider === null));

  const bags = BASE.productBenefits.filter((b) => String(b.benefitId) === "free-checked-bag");
  assert.ok(bags.every((b) => b.provider !== null), "hành lý thì PHẢI có hãng");
});

test("họ thẻ không được trải trên hai nhà phát hành", () => {
  const family = BASE.productFamilies[0];
  const alien = BASE.products.find((p) => p.issuerId !== family.issuerId)!;
  const broken = {
    ...BASE,
    products: BASE.products.map((p) =>
      p.id === alien.id ? { ...p, familyId: family.id, tierRank: 9 } : p,
    ),
  };
  assert.ok(errorsIn(broken).some((e) => e.includes("thuộc nhà phát hành khác")));
});

test("tierRank phải là số nguyên dương", () => {
  const member = BASE.products.find((p) => p.familyId !== null)!;
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    const broken = {
      ...BASE,
      products: BASE.products.map((p) => (p.id === member.id ? { ...p, tierRank: bad } : p)),
    };
    assert.ok(errorsIn(broken).some((e) => e.includes("tierRank")), `phải chặn ${bad}`);
  }
});

test("luật phạm vi welcome_offer KHÔNG tính là biết điều kiện mở thẻ", () => {
  // Amex® Green chỉ có luật "từng giữ thẻ này rồi" — nó nói về welcome bonus,
  // không nói người này có được duyệt thẻ hay không. Đếm nó là kết luận "đã
  // biết điều kiện" cho một thẻ mà mình chưa biết ngưỡng thu nhập.
  const green = BASE.products.find((p) => p.slug === "amex-green")!;
  const rules = BASE.eligibilityRules.filter((r) => r.productId === green.id);
  assert.ok(rules.some((r) => r.scope === "welcome_offer"));
  assert.ok(!rules.some((r) => r.scope === "application" && r.ruleType !== "residency"));
  assert.ok(
    BASE.gaps.some((g) => g.kind === "eligibility_unknown" && g.subjectId === green.id),
    "vẫn phải khai là chưa biết điều kiện mở thẻ",
  );
});

test("khai chỗ trống của offer không rò rỉ vào bản dựng lại quá khứ", () => {
  // `INCOMPLETE_OFFERS` là danh sách toàn cục của HIỆN TẠI. Rải nó vào một bản
  // dựng lại trước khi những offer đó tồn tại là rò rỉ kiến thức tương lai.
  const past = datasetAt(BASE, "2026-01-01");
  assert.equal(past.offers.length, 0);
  assert.equal(past.gaps.filter((g) => g.kind === "offer_terms_unknown").length, 0);
  assert.ok(BASE.gaps.some((g) => g.kind === "offer_terms_unknown"), "hôm nay thì vẫn phải có");
});

test("một slug không được thuộc về hai sản phẩm", () => {
  // Lịch sử offer tra theo slug, nên slug bị hai thẻ cùng nhận sẽ lặng lẽ nhập
  // lịch sử của thẻ kia — rồi engine tính 'mức này cao hay thường' trên số
  // liệu của một thẻ khác.
  const [a, b] = BASE.products;
  const broken = {
    ...BASE,
    products: BASE.products.map((p) => (p.id === b.id ? { ...p, previousSlugs: [a.slug] } : p)),
  };
  assert.ok(errorsIn(broken).some((e) => e.includes("thuộc về cả")));
});
