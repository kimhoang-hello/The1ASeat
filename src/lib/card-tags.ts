import { PRODUCTS, PRODUCT_FEES } from "./recommendation/data/products.ts";
import { PRODUCT_BENEFITS } from "./recommendation/data/product-benefits.ts";
import { EARNING_RATES } from "./recommendation/data/earning-rates.ts";
import { POINTS_PROGRAMS } from "./recommendation/data/points-programs.ts";
import { activeAt, isActiveAt, oneActiveAt } from "./recommendation/temporal.ts";
import type { ProductBenefit, SpendCategory } from "./recommendation/types.ts";

/**
 * Vài tag ngắn trên thẻ Canada trong danh sách `/credit-cards` — cùng kiểu tag
 * của thẻ Mỹ (`us.tags`), để người đọc lướt thấy ngay thẻ nổi ở mặt nào.
 *
 * Thẻ Mỹ viết tag TAY trong repo. Thẻ Canada thì SUY từ dữ liệu có cấu trúc
 * của engine gợi ý (quyền lợi, tỷ lệ tích điểm, phí, loại chương trình), không
 * thêm field Contentful: field mới là thêm một ô user phải nhớ điền cho từng
 * thẻ, trong khi các dữ kiện này đã được seed từ chính `keyBenefitsVi` và đã
 * có `audit:reco-data` canh lệch với Contentful. Thẻ chưa có trong engine thì
 * không có tag — trang vẫn đúng, chỉ thiếu một dòng trang trí.
 *
 * Tag KHÔNG phải bộ lọc: hàng chip lọc theo chương trình điểm đã có ở trên
 * danh sách. Vì vậy cũng không lặp lại tên chương trình ở đây.
 */

/** Bằng số tag của thẻ Mỹ — nhiều hơn thì dòng tag thành một đoạn văn. */
const MAX_TAGS = 3;

/**
 * Quyền lợi → tag, theo thứ tự ưu tiên. Thứ tự này là thứ tự người đọc Ghế 1A
 * lọc thẻ du lịch trong đầu: phòng chờ và phí ngoại tệ trước, rồi tới những
 * quyền lợi chỉ thẻ đồng thương hiệu có.
 *
 * "Lounge" không nằm ở đây mà xét riêng — xem `hasFreeLounge`.
 */
const BENEFIT_TAGS: [benefitId: string, tag: string][] = [
  ["no-fx-fee", "Không phí ngoại tệ"],
  ["companion-pass", "Companion fare"],
  ["free-checked-bag", "Hành lý miễn phí"],
  ["free-night-award", "Đêm miễn phí"],
];

/** Xếp SAU tag hạng mục tích điểm: có ích nhưng ít khi là lý do mở thẻ. */
const MINOR_BENEFIT_TAGS: [benefitId: string, tag: string][] = [
  ["hotel-status", "Elite status"],
  ["nexus-credit", "Credit NEXUS™"],
];
// KHÔNG có `airline-status-credits`: tín chỉ lên hạng kiếm bằng chi tiêu
// (1,000 SQC mỗi $5,000) không phải là được TẶNG hạng — gắn "Elite status"
// cho thẻ Aeroplan® là nói quá.

/**
 * Có lượt phòng chờ MIỄN PHÍ không — chứ không chỉ thẻ hội viên.
 *
 * `numericValue: null` ở `airport-lounge-passes` mang hai nghĩa trái ngược:
 * Priority Pass / Mastercard® Travel Pass chỉ là thẻ hội viên, vào mỗi lượt
 * vẫn trả phí (Scotiabank® Gold, WestJet RBC®, BMO® VIPorter®); còn Global
 * Lounge Collection™ và phòng chờ National Bank® thì vào không giới hạn. Dữ
 * liệu không có trường nào tách hai nghĩa này, nên phần `null` chỉ nhận khi
 * chữ mô tả nói rõ là không giới hạn.
 */
const UNLIMITED_LOUNGE = /không giới hạn|Global Lounge Collection/i;

function hasFreeLounge(rows: ProductBenefit[]): boolean {
  return rows.some(
    (row) =>
      row.benefitId === "maple-leaf-lounge" ||
      (row.benefitId === "airport-lounge-passes" &&
        ((row.numericValue ?? 0) > 0 || UNLIMITED_LOUNGE.test(row.textValue ?? ""))),
  );
}

/**
 * Hạng mục tích điểm → tag. Hạng mục vắng ở đây không bao giờ thành tag:
 * `airline_direct`/`hotel` là tỷ lệ của thẻ đồng thương hiệu (chip chương
 * trình điểm đã nói), `foreign_currency` đã có tag phí ngoại tệ, còn
 * `everything_else` cao nhất nghĩa là thẻ tích đều — không có hạng mục nào nổi.
 */
const CATEGORY_TAGS: Partial<Record<SpendCategory, string>> = {
  grocery: "Siêu thị",
  dining: "Ăn uống",
  food_delivery: "Ăn uống",
  gas: "Xăng",
  travel: "Travel",
  transit: "Đi lại",
  drugstore: "Nhà thuốc",
  recurring: "Hoá đơn định kỳ",
  streaming: "Streaming",
  entertainment: "Giải trí",
};

const PROGRAM_TYPE_TAGS: Record<string, string | undefined> = {
  flexible_bank: "Chuyển điểm",
  hotel: "Hotel",
  cash_back: "Cash back",
};

const SEGMENT_TAGS: Record<string, string | undefined> = {
  business: "Business",
  student: "Sinh viên",
};

function benefitTags(ids: Set<string>, table: [string, string][]): string[] {
  return table.filter(([benefitId]) => ids.has(benefitId)).map(([, tag]) => tag);
}

/**
 * Hạng mục có tỷ lệ CAO NHẤT của thẻ, khi nó cao hơn hẳn mức tích chung.
 * Thẻ Cobalt® 5x ở cả siêu thị lẫn ăn uống thì ra cả hai.
 *
 * Bỏ tỷ lệ có `restrictedTo`: 6x "siêu thị" chỉ ở một chuỗi cửa hàng mà gắn
 * tag "Siêu thị" là nói quá.
 */
function topCategoryTags(productId: string, asOf: string): string[] {
  const rates = activeAt(
    EARNING_RATES.filter((rate) => rate.productId === productId && rate.restrictedTo === null),
    asOf,
  );
  const base = Math.max(
    0,
    ...rates.filter((rate) => rate.category === "everything_else").map((rate) => rate.multiplier),
  );
  const top = Math.max(0, ...rates.map((rate) => rate.multiplier));
  if (top <= base) return [];
  return rates
    .filter((rate) => rate.multiplier === top)
    .map((rate) => CATEGORY_TAGS[rate.category])
    .filter((tag): tag is string => tag !== undefined);
}

/**
 * Tag của một thẻ Canada, tối đa `MAX_TAGS`, theo slug entry Contentful.
 * `asOf` là `YYYY-MM-DD` — ở phía site là `todayInSiteZone()`.
 */
export function cardTagsFor(slug: string, asOf: string): string[] {
  const product = PRODUCTS.find(
    (row) => (row.slug === slug || row.previousSlugs.includes(slug)) && isActiveAt(row, asOf),
  );
  if (!product) return [];

  const benefits = activeAt(
    PRODUCT_BENEFITS.filter((row) => row.productId === product.id),
    asOf,
  );
  const benefitIds = new Set(benefits.map((row) => row.benefitId as string));
  // Hạng chỉ có khi chi đủ một mức (Gold Elite sau $30,000) là chưa được TẶNG
  // hạng. Companion voucher cũng cấp lại theo mức chi nhưng vẫn giữ tag: nó là
  // quyền lợi đặc trưng của thẻ, còn "Elite status" có điều kiện thì nói quá.
  const minorIds = new Set(
    benefits
      .filter((row) => row.conditions?.minimumAnnualSpend === undefined)
      .map((row) => row.benefitId as string),
  );
  const program = POINTS_PROGRAMS.find((row) => row.id === product.pointsProgramId);
  const fee = oneActiveAt(
    PRODUCT_FEES.filter((row) => row.productId === product.id),
    asOf,
  );

  const tags = [
    SEGMENT_TAGS[product.personalOrBusiness],
    program && PROGRAM_TYPE_TAGS[program.programType],
    hasFreeLounge(benefits) ? "Lounge" : undefined,
    ...benefitTags(benefitIds, BENEFIT_TAGS),
    fee?.annualFee === 0 ? "Không annual fee" : undefined,
    ...topCategoryTags(product.id, asOf),
    ...benefitTags(minorIds, MINOR_BENEFIT_TAGS),
  ].filter((tag): tag is string => tag !== undefined);

  return [...new Set(tags)].slice(0, MAX_TAGS);
}
