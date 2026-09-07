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
  /**
   * Khoá chính, BẤT BIẾN, viết tay.
   *
   * KHÔNG suy từ `slug`. Bản trước dựng `prd_${seed.slug}` trong factory, và
   * chú thích ngay bên cạnh thì nói id là bất biến — hai thứ mâu thuẫn nhau:
   * sửa `slug` khi nhà phát hành đổi tên thẻ là lặng lẽ đổi luôn khoá chính,
   * đúng thứ khoá thay thế sinh ra để chặn. Viết tay là cách duy nhất lời hứa
   * đó có hiệu lực.
   */
  id: string;
  slug: string;
  name: string;
  issuer: string;
  network: "amex" | "visa" | "mastercard" | "other";
  personalOrBusiness: "personal" | "business" | "student";
  program: string | null;
  /**
   * Lịch sử phí thường niên, cũ nhất trước.
   *
   * DANH SÁCH chứ không phải một số: đổi phí là THÊM một phiên bản, không phải
   * sửa một con số. Bản trước chỉ có một `annualFee` và factory sinh đúng một
   * dòng với ngày cố định — nên sửa nó là ghi đè lịch sử, tức bảng
   * `product_fees` có kiểu đúng mà không ai tạo nổi phiên bản thứ hai. Kiểu dữ
   * liệu hỗ trợ phiên bản nhưng mô hình soạn thảo thì không, và mô hình soạn
   * thảo mới là thứ người ta thực sự dùng.
   */
  fees: FeeVersion[];
  officialUrl: string | null;
};

/** Một mức phí, có hiệu lực từ `from` tới `to` (`to` vắng = còn hiệu lực). */
type FeeVersion = {
  annualFee: number;
  from: string;
  to?: string;
  /** Ngày kiểm lại mức này. Vắng thì lấy `from` — mức mới thì ngày biết nó
   *  chính là ngày nó bắt đầu. */
  verifiedAt?: string;
};

const SEEDS: Seed[] = [
  {
    id: "prd_amex-green",
    slug: "amex-green",
    name: "American Express® Green Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "amex-mr",
    fees: [{ annualFee: 0, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_amex-gold-rewards",
    slug: "amex-gold-rewards",
    name: "American Express® Gold Rewards Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "amex-mr",
    fees: [{ annualFee: 250, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_amex-cobalt",
    slug: "amex-cobalt",
    name: "American Express Cobalt® Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "amex-mr",
    fees: [{ annualFee: 191.88, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_scotiabank-momentum-visa-infinite-plus",
    slug: "scotiabank-momentum-visa-infinite-plus",
    name: "Scotiabank® Momentum® Visa Infinite+",
    issuer: "scotiabank",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    fees: [{ annualFee: 120, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_cibc-aventura-gold-visa",
    slug: "cibc-aventura-gold-visa",
    name: "CIBC® Aventura® Gold Visa* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aventura",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/aventura-gold-visa-card.html",
  },
  {
    id: "prd_scotiabank-gold-amex",
    slug: "scotiabank-gold-amex",
    name: "Scotiabank® Gold American Express® Card",
    issuer: "scotiabank",
    network: "amex",
    personalOrBusiness: "personal",
    program: "scene-plus",
    fees: [{ annualFee: 120, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_scotiabank-scene-plus-visa-students",
    slug: "scotiabank-scene-plus-visa-students",
    name: "Scotiabank® Scene+™ Visa* Card for Students",
    issuer: "scotiabank",
    network: "visa",
    personalOrBusiness: "student",
    program: "scene-plus",
    fees: [{ annualFee: 0, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_westjet-rbc-world-elite-mastercard",
    slug: "westjet-rbc-world-elite-mastercard",
    name: "WestJet RBC® World Elite Mastercard®",
    issuer: "rbc",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "westjet",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_amex-aeroplan-reserve",
    slug: "amex-aeroplan-reserve",
    name: "American Express® Aeroplan®* Reserve Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 599, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_td-aeroplan-visa-infinite-privilege",
    slug: "td-aeroplan-visa-infinite-privilege",
    name: "TD® Aeroplan® Visa Infinite Privilege* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 599, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_td-aeroplan-visa-infinite",
    slug: "td-aeroplan-visa-infinite",
    name: "TD® Aeroplan® Visa Infinite* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_td-first-class-travel-visa-infinite",
    slug: "td-first-class-travel-visa-infinite",
    name: "TD First Class Travel® Visa Infinite* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "td-rewards",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_cibc-aventura-visa-infinite",
    slug: "cibc-aventura-visa-infinite",
    name: "CIBC® Aventura® Visa Infinite* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aventura",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/aventura-visa-infinite-card.html",
  },
  {
    id: "prd_amex-aeroplan-business-reserve",
    slug: "amex-aeroplan-business-reserve",
    name: "American Express® Aeroplan®* Business Reserve Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "business",
    program: "aeroplan",
    fees: [{ annualFee: 599, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_amex-marriott-bonvoy-business",
    slug: "amex-marriott-bonvoy-business",
    name: "American Express® Marriott Bonvoy® Business",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "business",
    program: "bonvoy",
    fees: [{ annualFee: 150, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_national-bank-world-elite-mastercard",
    slug: "national-bank-world-elite-mastercard",
    name: "National Bank® World Elite® Mastercard®",
    issuer: "national-bank",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "a-la-carte",
    fees: [{ annualFee: 150, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_td-cash-back-visa-infinite",
    slug: "td-cash-back-visa-infinite",
    name: "TD® Cash Back Visa Infinite* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_wealthsimple-visa-infinite-privilege",
    slug: "wealthsimple-visa-infinite-privilege",
    name: "Wealthsimple® Visa Infinite Privilege",
    issuer: "wealthsimple",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    fees: [{ annualFee: 240, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_wealthsimple-visa-infinite-plus",
    slug: "wealthsimple-visa-infinite-plus",
    name: "Wealthsimple® Visa Infinite+",
    issuer: "wealthsimple",
    network: "visa",
    personalOrBusiness: "personal",
    program: "cash-back",
    fees: [{ annualFee: 240, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_rbc-avion-visa-infinite-privilege",
    slug: "rbc-avion-visa-infinite-privilege",
    name: "RBC® Avion® Visa Infinite Privilege",
    issuer: "rbc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "avion",
    fees: [{ annualFee: 399, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_td-aeroplan-visa-platinum",
    slug: "td-aeroplan-visa-platinum",
    name: "TD® Aeroplan® Visa Platinum* Card",
    issuer: "td",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 89, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_amex-aeroplan",
    slug: "amex-aeroplan",
    name: "American Express® Aeroplan®* Card",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 120, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_bmo-viporter-world-elite-mastercard",
    slug: "bmo-viporter-world-elite-mastercard",
    name: "BMO® VIPorter® World Elite Mastercard®",
    issuer: "bmo",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "viporter",
    fees: [{ annualFee: 199, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_united-mileageplus-neo-world-elite-mastercard",
    slug: "united-mileageplus-neo-world-elite-mastercard",
    name: "United® MileagePlus® Neo™ World Elite® Mastercard®",
    issuer: "neo",
    network: "mastercard",
    personalOrBusiness: "personal",
    program: "mileageplus",
    fees: [{ annualFee: 89, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_amex-marriott-bonvoy",
    slug: "amex-marriott-bonvoy",
    name: "American Express® Marriott Bonvoy®",
    issuer: "amex",
    network: "amex",
    personalOrBusiness: "personal",
    program: "bonvoy",
    fees: [{ annualFee: 120, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_scotiabank-passport-visa-infinite",
    slug: "scotiabank-passport-visa-infinite",
    name: "Scotiabank® Passport® Visa Infinite+ Card",
    issuer: "scotiabank",
    network: "visa",
    personalOrBusiness: "personal",
    program: "scene-plus",
    fees: [{ annualFee: 150, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_rbc-avion-visa-infinite",
    slug: "rbc-avion-visa-infinite",
    name: "RBC® Avion® Visa Infinite",
    issuer: "rbc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "avion",
    fees: [{ annualFee: 120, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_rbc-avion-visa-platinum",
    slug: "rbc-avion-visa-platinum",
    name: "RBC® Avion® Visa Platinum",
    issuer: "rbc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "avion",
    fees: [{ annualFee: 120, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_cibc-aeroplan-visa",
    slug: "cibc-aeroplan-visa",
    name: "CIBC® Aeroplan® Visa* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 0, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_cibc-aeroplan-visa-infinite",
    slug: "cibc-aeroplan-visa-infinite",
    name: "CIBC® Aeroplan® Visa Infinite* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 139, from: SEEDED_ON }],
    officialUrl: null,
  },
  {
    id: "prd_cibc-aeroplan-visa-infinite-privilege",
    slug: "cibc-aeroplan-visa-infinite-privilege",
    name: "CIBC® Aeroplan® Visa Infinite Privilege* Card",
    issuer: "cibc",
    network: "visa",
    personalOrBusiness: "personal",
    program: "aeroplan",
    fees: [{ annualFee: 599, from: SEEDED_ON }],
    officialUrl: null,
  },
];

export const PRODUCTS: ProductSeed[] = SEEDS.map((seed) => ({
  id: id<ProductId>(seed.id),
  slug: seed.slug,
  name: seed.name,
  issuerId: seed.issuer as IssuerId,
  country: "CA",
  productType: "credit_card",
  network: seed.network,
  personalOrBusiness: seed.personalOrBusiness,
  pointsProgramId: seed.program === null ? null : (seed.program as PointsProgramId),
  availableFrom: SEEDED_ON,
  availableTo: null,
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
export const PRODUCT_FEES: ProductFee[] = SEEDS.flatMap((seed) =>
  seed.fees.map((fee) => ({
    // Ngày hiệu lực nằm TRONG id, nên phiên bản thứ hai không đụng phiên bản
    // thứ nhất và không ai phải sửa factory để thêm nó.
    id: makeId<ProductFeeId>("fee", seed.id, fee.from),
    productId: id<ProductId>(seed.id),
    annualFee: fee.annualFee,
    currency: "CAD",
    effectiveFrom: fee.from,
    effectiveTo: fee.to ?? null,
    sourceUrl: `https://ghe1a.com/credit-cards/${seed.slug}`,
    sourceKind: "ghe1a",
    verifiedAt: fee.verifiedAt ?? fee.from,
    confidence: "verified",
  })),
);
