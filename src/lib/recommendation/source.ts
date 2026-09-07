import { isReferralUrl } from "@/lib/affiliate-links";
import { getCreditCardOffers } from "@/lib/content";
import type { CreditCardOffer } from "@/lib/content";
import {
  AWARD_STRATEGIES,
  BENEFITS,
  EARNING_RATES,
  ELIGIBILITY_RULES,
  ISSUERS,
  OFFERS,
  OFFER_COMPONENTS,
  POINTS_PROGRAMS,
  PRODUCTS,
  PRODUCT_BENEFITS,
  TRANSFER_PATHS,
} from "./data";
import type { Product, RecommendationDataset } from "./types";

/**
 * Cửa DUY NHẤT engine đọc dữ liệu.
 *
 * Tồn tại vì Phase 2 chắc chắn phải có database thật — hồ sơ người dùng, thẻ
 * đang giữ, số dư điểm không thể nằm trong git. Khi đó đổi implementation ở
 * đây, engine không đụng một dòng. Giữ interface hẹp là cách duy nhất lời hứa
 * đó còn giá trị: mỗi hàm thêm vào là một hàm backend mới phải làm được.
 *
 * `getDataset` là async dù bộ seed nằm sẵn trong bộ nhớ — vì `affiliateAvailable`
 * đọc từ Contentful, và vì backend nào sau này cũng sẽ async.
 */
export interface RecommendationDataSource {
  getDataset(): Promise<RecommendationDataset>;
}

/**
 * `affiliateAvailable` được TÍNH, không được khai.
 *
 * `isReferralUrl` chính là hàm quyết định link apply có mang `rel="sponsored"`
 * hay không trên trang thẻ. Dùng lại đúng nó ở đây nghĩa là engine và trang
 * web không thể bất đồng về việc một link có hoa hồng — và Rule 7 ("affiliate
 * không bao giờ ảnh hưởng thứ hạng") trở thành thứ kiểm chứng được thay vì
 * một lời hứa.
 *
 * Thẻ không tìm thấy trên Contentful → `false`. Đoán "có hoa hồng" khi không
 * biết là hướng sai duy nhất không sửa được sau đó: nó bật nút affiliate lên
 * cho một link không có thật.
 */
function resolveProducts(offers: CreditCardOffer[]): Product[] {
  const applyUrlBySlug = new Map(offers.map((offer) => [offer.slug, offer.applyUrl]));
  return PRODUCTS.map((seed) => {
    const applyUrl = applyUrlBySlug.get(seed.slug);
    return {
      ...seed,
      affiliateAvailable: applyUrl ? isReferralUrl(applyUrl) : false,
    };
  });
}

/**
 * Bộ dữ liệu nằm trong repo, nối với Contentful bằng slug.
 *
 * Không cache riêng: `getCreditCardOffers` đã đi qua lớp `unstable_cache`
 * chung của `lib/content` (60 giây, tag `contentful`, webhook publish làm mới
 * ngay). Bọc thêm một lớp nữa ở đây chỉ tạo ra một bản sao hết hạn theo lịch
 * khác — tức là hai câu trả lời khác nhau cho cùng một câu hỏi, tuỳ ai hỏi.
 */
export const repoDataSource: RecommendationDataSource = {
  async getDataset(): Promise<RecommendationDataset> {
    const offers = await getCreditCardOffers();
    return {
      issuers: ISSUERS,
      pointsPrograms: POINTS_PROGRAMS,
      transferPaths: TRANSFER_PATHS,
      products: resolveProducts(offers),
      offers: OFFERS,
      offerComponents: OFFER_COMPONENTS,
      earningRates: EARNING_RATES,
      benefits: BENEFITS,
      productBenefits: PRODUCT_BENEFITS,
      eligibilityRules: ELIGIBILITY_RULES,
      awardStrategies: AWARD_STRATEGIES,
    };
  },
};

/**
 * Bộ dữ liệu KHÔNG có phần Contentful, cho test và cho `audit:reco-data`.
 *
 * `affiliateAvailable` để `false` hết. An toàn ở chỗ: mọi test về Rule 7 phải
 * tự bật cờ lên cho thẻ nó muốn thử, nên không test nào vô tình chạy trên một
 * bộ dữ liệu mà cờ đã sẵn đúng.
 */
export function offlineDataset(): RecommendationDataset {
  return {
    issuers: ISSUERS,
    pointsPrograms: POINTS_PROGRAMS,
    transferPaths: TRANSFER_PATHS,
    products: PRODUCTS.map((seed) => ({ ...seed, affiliateAvailable: false })),
    offers: OFFERS,
    offerComponents: OFFER_COMPONENTS,
    earningRates: EARNING_RATES,
    benefits: BENEFITS,
    productBenefits: PRODUCT_BENEFITS,
    eligibilityRules: ELIGIBILITY_RULES,
    awardStrategies: AWARD_STRATEGIES,
  };
}
