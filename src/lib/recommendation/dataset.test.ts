// Kiểm những bất biến của chính bộ dữ liệu — thứ `audit:reco-data` cũng kiểm,
// nhưng ở đây chạy được mà không cần token Contentful, nên nó là lưới an toàn
// duy nhất còn hoạt động trong CI và trên máy người khác.
//
//   npm run test:reco

import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineDataset } from "./data/index.ts";
import { validateDataset } from "./validate.ts";
import type { Product, RecommendationDataset } from "./types.ts";

const data = offlineDataset();

test("bộ dữ liệu đang không có lỗi nào", () => {
  const errors = validateDataset(data).filter((issue) => issue.level === "error");
  assert.deepEqual(errors, []);
});

test("mọi bản ghi nhạy cảm thời gian đều có nguồn và ngày kiểm", () => {
  const sourced = [
    ...data.offers,
    ...data.earningRates,
    ...data.productBenefits,
    ...data.eligibilityRules,
    ...data.transferPaths,
    ...data.awardStrategies,
  ];
  for (const row of sourced) {
    assert.match(row.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${row.id} thiếu verifiedAt hợp lệ`);
    assert.ok(row.confidence, `${row.id} thiếu confidence`);
  }
});

test("affiliate KHÔNG viết tay được — bộ offline luôn tắt hết", () => {
  // Rule 7 của spec §16. Bộ offline để `false` toàn bộ, nên mọi test về xếp
  // hạng ở Phase 3 buộc phải tự bật cờ cho thẻ nó muốn thử — không test nào
  // vô tình chạy trên một bộ dữ liệu mà cờ đã sẵn đúng.
  assert.ok(data.products.every((p) => p.affiliateAvailable === false));
});

test("chỉ chương trình transferable mới có chặng chuyển đi", () => {
  // Nền của luật cấm đếm trùng ở §7: một điểm Aeroplan® không hoá thành điểm
  // Avios® được, nên nó không được sinh ra "số dư tiếp cận được".
  const byId = new Map(data.pointsPrograms.map((p) => [p.id as string, p]));
  for (const path of data.transferPaths) {
    assert.equal(
      byId.get(path.sourceProgramId as string)?.transferable,
      true,
      `${path.id} chuyển đi từ một chương trình không transferable`,
    );
  }
});

test("không có kiểu điều kiện nào là điểm tín dụng", () => {
  // spec §3.10 và guardrail §36.7. Kiểm ở tầng DỮ LIỆU chứ không chỉ ở tầng
  // kiểu, để một lần nới kiểu trong tương lai cũng làm test này đỏ.
  for (const rule of data.eligibilityRules) {
    assert.doesNotMatch(rule.ruleType, /credit[_ ]?score/i);
  }
});

const CLOSED_ON = "2026-12-31";

/**
 * Đóng một sản phẩm ĐÚNG CÁCH: đóng cả bản ghi con.
 *
 * Đóng mỗi dòng sản phẩm thì offer/phí/tỷ lệ/quyền lợi của nó vẫn "đang chạy",
 * và engine sẽ khuyên một thẻ không còn tồn tại — xem test ngay dưới.
 */
function withClosedProduct(base: RecommendationDataset): RecommendationDataset {
  const original = base.products[0];
  const closed: Product = {
    ...original,
    isActive: false,
    effectiveTo: CLOSED_ON,
    contentfulLinked: false,
  };
  const shut = <T extends { productId: string; effectiveTo: string | null }>(rows: T[]) =>
    rows.map((row) => (row.productId === original.id ? { ...row, effectiveTo: CLOSED_ON } : row));
  return {
    ...base,
    products: [closed, ...base.products.slice(1)],
    offers: shut(base.offers),
    productFees: shut(base.productFees),
    earningRates: shut(base.earningRates),
    productBenefits: shut(base.productBenefits),
    eligibilityRules: shut(base.eligibilityRules),
  };
}

test("sản phẩm ngừng bán vẫn hợp lệ khi đóng đủ cả bản ghi con", () => {
  const errors = validateDataset(withClosedProduct(data), "2027-03-01").filter(
    (i) => i.level === "error",
  );
  assert.deepEqual(errors, []);
});

test("đóng mỗi dòng sản phẩm mà để offer treo là LỖI", () => {
  // Thẻ ngừng bán nhưng offer vẫn mở = engine khuyên một thẻ không còn tồn tại.
  const original = data.products[0];
  const halfClosed = {
    ...data,
    products: [
      { ...original, isActive: false, effectiveTo: CLOSED_ON },
      ...data.products.slice(1),
    ],
  };
  const errors = validateDataset(halfClosed, "2027-03-01").filter((i) => i.level === "error");
  assert.ok(errors.some((e) => e.message.includes("chưa có effectiveTo")));
});

test("sản phẩm ngừng bán mà thiếu effectiveTo là LỖI", () => {
  const broken = withClosedProduct(data);
  broken.products[0] = { ...broken.products[0], effectiveTo: null };
  const errors = validateDataset(broken, "2027-03-01").filter((i) => i.level === "error");
  assert.ok(
    errors.some((e) => e.message.includes("ngừng từ bao giờ")),
    "phải báo lỗi khi đóng sản phẩm mà không nói ngừng từ bao giờ",
  );
});

test("xoá sản phẩm để lại tham chiếu mồ côi là LỖI", () => {
  // Đây là lý do thẻ ngừng bán phải ĐÓNG chứ không XOÁ: offer, tỷ lệ tích
  // điểm và quyền lợi đều trỏ vào `productId`.
  const gone = data.products[0];
  const broken = { ...data, products: data.products.slice(1) };
  const errors = validateDataset(broken).filter((i) => i.level === "error");
  assert.ok(
    errors.some((e) => e.message.includes(gone.id)),
    `phải báo tham chiếu mồ côi tới ${gone.id}`,
  );
});

test("offer nối tiếp nhau theo thời gian là hợp lệ; chồng nhau là LỖI", () => {
  // Hợp đồng chỉ-thêm: offer đổi thì đóng bản cũ rồi thêm bản mới. Id lấy từ
  // `startDate` nên hai bản không trùng id.
  const current = data.offers[0];
  const succeeded = { ...current, effectiveTo: "2026-12-31" };
  const next = {
    ...current,
    id: `${current.productId}-2027-01-01` as typeof current.id,
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    startDate: "2027-01-01",
  };

  const ok = { ...data, offers: [succeeded, next, ...data.offers.slice(1)] };
  assert.deepEqual(
    validateDataset(ok).filter((i) => i.level === "error"),
    [],
    "hai offer nối tiếp nhau phải hợp lệ",
  );

  const overlapping = {
    ...data,
    offers: [succeeded, { ...next, effectiveFrom: "2026-12-01" }, ...data.offers.slice(1)],
  };
  assert.ok(
    validateDataset(overlapping)
      .filter((i) => i.level === "error")
      .some((e) => e.message.includes("chồng thời gian")),
    "hai offer chồng thời gian phải là lỗi",
  );
});
