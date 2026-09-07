import {
  id,
  makeId,
  type IssuerId,
  type PointsProgramId,
  type ProductFee,
  type ProductFeeId,
  type ProductId,
  type ProductSeed,
} from "../types.ts";

/** Ngày bộ seed này được dựng từ nội dung Contentful đang publish. Mọi bản ghi
 *  sản phẩm mở hiệu lực từ đây; điều đó KHÔNG có nghĩa thẻ ra đời hôm ấy, mà
 *  là engine chưa biết gì về thẻ trước ngày đó — nói đúng cái mình biết. */
const SEEDED_ON = "2026-09-07";

/**
 * 31 thẻ tín dụng site đang có trang.
 *
 * KHOÁ CHÍNH LÀ `id`, KHÔNG PHẢI `slug`. `id` là `prd_<slug lúc seed>` và từ
 * đó trở đi nó BẤT BIẾN: nhà phát hành đổi tên thẻ thì `slug` và `name` đổi,
 * `id` thì không. Đó là toàn bộ lý do hai trường này tồn tại riêng — xem
 * "LUẬT VỀ ID" trong `types.ts`. Việc id ban đầu trông giống slug là tiện cho
 * người đọc, KHÔNG phải một bất biến: đừng bao giờ suy id từ slug trong code.
 *
 * `slug` bằng đúng slug entry `creditCardOffer` trên Contentful, và đó là chỗ
 * nối giữa hai kho: Contentful giữ tên, ảnh, copy tiếng Việt, apply URL và
 * badge rebate; chỗ này giữ dữ kiện có cấu trúc. `audit:reco-data` bắt lệch cả
 * hai chiều.
 *
 * PHÍ THƯỜNG NIÊN KHÔNG Ở ĐÂY — xem `PRODUCT_FEES` bên dưới và chú thích
 * `ProductFee` trong `types.ts`.
 *
 * `affiliateAvailable` cố tình vắng (xem `ProductSeed`): nó do `source.ts` tính
 * từ `applyUrl` bằng chính `isReferralUrl` mà bộ render link dùng.
 */
type Seed = {
  slug: string;
  name: string;
  issuer: string;
  network: "amex" | "visa" | "mastercard" | "other";
  personalOrBusiness: "personal" | "business" | "student";
  program: string | null;
  /** Phí năm thường lúc seed. Đi vào `PRODUCT_FEES`, không vào `PRODUCTS`. */
  annualFee: number;
  officialUrl: string | null;
};

const SEEDS: Seed[] = [
  {
    slug: "amex-green",
    name: "American Express® Green Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "amex-mr",
    annualFee: 0,
    officialUrl: null,
  },
  {
    slug: "amex-gold-rewards",
    name: "American Express® Gold Rewards Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "amex-mr",
    annualFee: 250,
    officialUrl: null,
  },
  {
    slug: "amex-cobalt",
    name: "American Express Cobalt® Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "amex-mr",
    annualFee: 191.88,
    officialUrl: null,
  },
  {
    slug: "scotiabank-momentum-visa-infinite-plus",
    name: "Scotiabank® Momentum® Visa Infinite+",
    issuer: "scotiabank",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    annualFee: 120,
    officialUrl: null,
  },
  {
    slug: "cibc-aventura-gold-visa",
    name: "CIBC® Aventura® Gold Visa* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aventura",
    annualFee: 139,
    officialUrl: "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/aventura-gold-visa-card.html",
  },
  {
    slug: "scotiabank-gold-amex",
    name: "Scotiabank® Gold American Express® Card",
    issuer: "scotiabank",
    network: "amex",
    personalOrBusiness: "personal",
    program: "scene-plus",
    annualFee: 120,
    officialUrl: null,
  },
  {
    slug: "scotiabank-scene-plus-visa-students",
    name: "Scotiabank® Scene+™ Visa* Card for Students",
    issuer: "scotiabank",
    network: "visa",
    personalOrBusiness: "student",
    program: "scene-plus",
    annualFee: 0,
    officialUrl: null,
  },
  {
    slug: "westjet-rbc-world-elite-mastercard",
    name: "WestJet RBC® World Elite Mastercard®",
    issuer: "rbc",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "westjet",
    annualFee: 139,
    officialUrl: null,
  },
  {
    slug: "amex-aeroplan-reserve",
    name: "American Express® Aeroplan®* Reserve Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 599,
    officialUrl: null,
  },
  {
    slug: "td-aeroplan-visa-infinite-privilege",
    name: "TD® Aeroplan® Visa Infinite Privilege* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 599,
    officialUrl: null,
  },
  {
    slug: "td-aeroplan-visa-infinite",
    name: "TD® Aeroplan® Visa Infinite* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 139,
    officialUrl: null,
  },
  {
    slug: "td-first-class-travel-visa-infinite",
    name: "TD First Class Travel® Visa Infinite* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "td-rewards",
    annualFee: 139,
    officialUrl: null,
  },
  {
    slug: "cibc-aventura-visa-infinite",
    name: "CIBC® Aventura® Visa Infinite* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aventura",
    annualFee: 139,
    officialUrl: "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/aventura-visa-infinite-card.html",
  },
  {
    slug: "amex-aeroplan-business-reserve",
    name: "American Express® Aeroplan®* Business Reserve Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "business",
    program: "aeroplan",
    annualFee: 599,
    officialUrl: null,
  },
  {
    slug: "amex-marriott-bonvoy-business",
    name: "American Express® Marriott Bonvoy® Business",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "business",
    program: "bonvoy",
    annualFee: 150,
    officialUrl: null,
  },
  {
    slug: "national-bank-world-elite-mastercard",
    name: "National Bank® World Elite® Mastercard®",
    issuer: "national-bank",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "a-la-carte",
    annualFee: 150,
    officialUrl: null,
  },
  {
    slug: "td-cash-back-visa-infinite",
    name: "TD® Cash Back Visa Infinite* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    annualFee: 139,
    officialUrl: null,
  },
  {
    slug: "wealthsimple-visa-infinite-privilege",
    name: "Wealthsimple® Visa Infinite Privilege",
    issuer: "wealthsimple",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    annualFee: 240,
    officialUrl: null,
  },
  {
    slug: "wealthsimple-visa-infinite-plus",
    name: "Wealthsimple® Visa Infinite+",
    issuer: "wealthsimple",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    annualFee: 240,
    officialUrl: null,
  },
  {
    slug: "rbc-avion-visa-infinite-privilege",
    name: "RBC® Avion® Visa Infinite Privilege",
    issuer: "rbc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "avion",
    annualFee: 399,
    officialUrl: null,
  },
  {
    slug: "td-aeroplan-visa-platinum",
    name: "TD® Aeroplan® Visa Platinum* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 89,
    officialUrl: null,
  },
  {
    slug: "amex-aeroplan",
    name: "American Express® Aeroplan®* Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 120,
    officialUrl: null,
  },
  {
    slug: "bmo-viporter-world-elite-mastercard",
    name: "BMO® VIPorter® World Elite Mastercard®",
    issuer: "bmo",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "viporter",
    annualFee: 199,
    officialUrl: null,
  },
  {
    slug: "united-mileageplus-neo-world-elite-mastercard",
    name: "United® MileagePlus® Neo™ World Elite® Mastercard®",
    issuer: "neo",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "mileageplus",
    annualFee: 89,
    officialUrl: null,
  },
  {
    slug: "amex-marriott-bonvoy",
    name: "American Express® Marriott Bonvoy®",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "bonvoy",
    annualFee: 120,
    officialUrl: null,
  },
  {
    slug: "scotiabank-passport-visa-infinite",
    name: "Scotiabank® Passport® Visa Infinite+ Card",
    issuer: "scotiabank",
    network: "visa",
    personalOrBusiness: "personal",
    program: "scene-plus",
    annualFee: 150,
    officialUrl: null,
  },
  {
    slug: "rbc-avion-visa-infinite",
    name: "RBC® Avion® Visa Infinite",
    issuer: "rbc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "avion",
    annualFee: 120,
    officialUrl: null,
  },
  {
    slug: "rbc-avion-visa-platinum",
    name: "RBC® Avion® Visa Platinum",
    issuer: "rbc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "avion",
    annualFee: 120,
    officialUrl: null,
  },
  {
    slug: "cibc-aeroplan-visa",
    name: "CIBC® Aeroplan® Visa* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 0,
    officialUrl: null,
  },
  {
    slug: "cibc-aeroplan-visa-infinite",
    name: "CIBC® Aeroplan® Visa Infinite* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 139,
    officialUrl: null,
  },
  {
    slug: "cibc-aeroplan-visa-infinite-privilege",
    name: "CIBC® Aeroplan® Visa Infinite Privilege* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    annualFee: 599,
    officialUrl: null,
  },
];

export const PRODUCTS: ProductSeed[] = SEEDS.map((seed) => ({
  id: id<ProductId>(`prd_${seed.slug}`),
  slug: seed.slug,
  name: seed.name,
  issuerId: seed.issuer as IssuerId,
  country: "CA",
  productType: "credit_card",
  network: seed.network,
  personalOrBusiness: seed.personalOrBusiness,
  pointsProgramId: seed.program === null ? null : (seed.program as PointsProgramId),
  isActive: true,
  officialUrl: seed.officialUrl,
  contentfulLinked: true,
  supersededByProductId: null,
  effectiveFrom: SEEDED_ON,
  effectiveTo: null,
}));

/**
 * Phí thường niên, tách khỏi sản phẩm vì nó ĐỔI.
 *
 * Đổi phí = đóng dòng hiện tại bằng `effectiveTo` rồi thêm dòng mới với
 * `effectiveFrom`. Id mang ngày hiệu lực nên hai dòng không đụng nhau, và
 * `Product.id` không nhúc nhích — nghĩa là không một khoá ngoại nào gãy, và
 * mọi khuyến nghị cũ vẫn tra ra đúng mức phí lúc nó được đưa ra.
 */
export const PRODUCT_FEES: ProductFee[] = SEEDS.map((seed) => ({
  id: makeId<ProductFeeId>("fee", `prd_${seed.slug}`, SEEDED_ON),
  productId: id<ProductId>(`prd_${seed.slug}`),
  annualFee: seed.annualFee,
  currency: "CAD",
  effectiveFrom: SEEDED_ON,
  effectiveTo: null,
  sourceUrl: `https://ghe1a.com/credit-cards/${seed.slug}`,
  verifiedAt: SEEDED_ON,
  confidence: "verified",
}));
