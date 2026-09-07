export { ISSUERS } from "./issuers.ts";
export { POINTS_PROGRAMS, PROGRAM_VALUATIONS } from "./points-programs.ts";
export { TRANSFER_PATHS } from "./transfer-paths.ts";
export { PRODUCTS, PRODUCT_FEES, PRODUCT_FAMILIES } from "./products.ts";
export { OFFERS, OFFER_COMPONENTS, INCOMPLETE_OFFERS } from "./offers.ts";
export { EARNING_RATES, EARNING_CAPS } from "./earning-rates.ts";
export { BENEFITS } from "./benefits.ts";
export { PRODUCT_BENEFITS } from "./product-benefits.ts";
export { ELIGIBILITY_RULES } from "./eligibility-rules.ts";
export {
  AWARD_STRATEGIES,
  AWARD_STRATEGY_UPSTREAM,
  UNQUOTABLE_AWARD_PROGRAMS,
} from "./award-strategies.ts";

import { ISSUERS } from "./issuers.ts";
import { POINTS_PROGRAMS, PROGRAM_VALUATIONS } from "./points-programs.ts";
import { TRANSFER_PATHS } from "./transfer-paths.ts";
import { PRODUCTS, PRODUCT_FEES, PRODUCT_FAMILIES } from "./products.ts";
import { OFFERS, OFFER_COMPONENTS } from "./offers.ts";
import { EARNING_RATES, EARNING_CAPS } from "./earning-rates.ts";
import { BENEFITS } from "./benefits.ts";
import { PRODUCT_BENEFITS } from "./product-benefits.ts";
import { ELIGIBILITY_RULES } from "./eligibility-rules.ts";
import { AWARD_STRATEGIES } from "./award-strategies.ts";
import type { RecommendationDataset } from "../types.ts";

/**
 * Bộ dữ liệu KHÔNG có phần Contentful, cho test và cho `audit:reco-data`.
 *
 * `affiliateAvailable` để `false` hết. An toàn ở chỗ: mọi test về Rule 7 phải
 * tự bật cờ lên cho thẻ nó muốn thử, nên không test nào vô tình chạy trên một
 * bộ dữ liệu mà cờ đã sẵn đúng.
 *
 * Nằm ở `data/` chứ không ở `source.ts` là có lý do chạy được: `source.ts`
 * import Contentful qua alias `@/…`, mà Node chạy test thì không giải được
 * alias của bundler. Bộ offline phải nạp được bằng đường dẫn tương đối thuần,
 * nếu không thì lưới an toàn duy nhất còn hoạt động khi không có token
 * Contentful lại là thứ không chạy nổi.
 */
export function offlineDataset(): RecommendationDataset {
  return {
    issuers: ISSUERS,
    productFees: PRODUCT_FEES,
    productFamilies: PRODUCT_FAMILIES,
    programValuations: PROGRAM_VALUATIONS,
    pointsPrograms: POINTS_PROGRAMS,
    transferPaths: TRANSFER_PATHS,
    products: PRODUCTS.map((seed) => ({ ...seed, affiliateAvailable: false })),
    offers: OFFERS,
    offerComponents: OFFER_COMPONENTS,
    earningRates: EARNING_RATES,
    earningCaps: EARNING_CAPS,
    benefits: BENEFITS,
    productBenefits: PRODUCT_BENEFITS,
    eligibilityRules: ELIGIBILITY_RULES,
    awardStrategies: AWARD_STRATEGIES,
  };
}
