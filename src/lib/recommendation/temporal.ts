import type { RecommendationDataset, Temporal } from "./types.ts";

/**
 * Đọc dữ liệu TẠI MỘT THỜI ĐIỂM.
 *
 * Đây là nửa còn lại của hợp đồng chỉ-thêm. Giữ lịch sử mà không có cách hỏi
 * "hôm đó dữ liệu trông thế nào" thì lịch sử chỉ là rác chiếm chỗ: Phase 4 phải
 * giải thích được vì sao một khuyến nghị ba tháng trước chọn thẻ đó, và câu trả
 * lời gần như luôn là "vì lúc ấy offer/phí/tỷ lệ khác bây giờ".
 *
 * Ngày viết dạng `YYYY-MM-DD` nên so chuỗi là so ngày — cùng quy ước với
 * `hasExpired()` trong `lib/format-date.ts`. Người gọi tự quyết định ngày theo
 * múi giờ nào; ở phía site thì đó là `todayInSiteZone()`.
 */

/**
 * `effectiveTo` là NGÀY CUỐI CÙNG còn hiệu lực, không phải mốc kết thúc — nên
 * phép so có dấu bằng ở cả hai đầu. Cùng quy ước với `expiresAt` của site; đọc
 * nó là mốc-kết-thúc sẽ làm mọi bản ghi biến mất sớm đúng một ngày.
 */
export function isActiveAt(row: Temporal, asOf: string): boolean {
  if (row.effectiveFrom > asOf) return false;
  return row.effectiveTo === null || row.effectiveTo >= asOf;
}

export function activeAt<T extends Temporal>(rows: readonly T[], asOf: string): T[] {
  return rows.filter((row) => isActiveAt(row, asOf));
}

/**
 * Đúng MỘT bản ghi còn hiệu lực, hoặc `undefined`.
 *
 * Dùng cho những quan hệ mà nhiều bản ghi cùng lúc là vô nghĩa: phí thường
 * niên của một thẻ, offer đang chạy của một thẻ. Trả `undefined` khi có NHIỀU
 * hơn một là cố ý — im lặng chọn cái đầu tiên là cách một lỗi dữ liệu biến
 * thành một con số sai về tiền mà không ai thấy. `validate.ts` chặn tình huống
 * đó ở tầng dữ liệu; đây là lưới thứ hai cho lúc dữ liệu tới từ nơi khác.
 */
export function oneActiveAt<T extends Temporal>(
  rows: readonly T[],
  asOf: string,
): T | undefined {
  const live = activeAt(rows, asOf);
  return live.length === 1 ? live[0] : undefined;
}

/**
 * Cả bộ dữ liệu như nó ở thời điểm `asOf`.
 *
 * `issuers`, `pointsPrograms` và `benefits` không có `Temporal` — chúng là từ
 * điển, không phải sự thật đổi theo thời gian, nên đi qua nguyên vẹn. Nếu ngày
 * nào một trong ba cần lịch sử thì thêm `Temporal` cho nó rồi lọc ở đây; đó là
 * một dòng, không phải một cuộc đại tu.
 */
export function datasetAt(data: RecommendationDataset, asOf: string): RecommendationDataset {
  const products = activeAt(data.products, asOf);
  const liveProductIds = new Set(products.map((product) => product.id as string));
  const offers = activeAt(data.offers, asOf).filter((offer) =>
    liveProductIds.has(offer.productId),
  );
  const liveOfferIds = new Set(offers.map((offer) => offer.id as string));

  return {
    issuers: data.issuers,
    pointsPrograms: data.pointsPrograms,
    benefits: data.benefits,
    products,
    productFees: activeAt(data.productFees, asOf).filter((fee) =>
      liveProductIds.has(fee.productId),
    ),
    offers,
    // `offer_components` KHÔNG có `Temporal` riêng: một offer là một gói điều
    // khoản, sửa một thành phần là một offer khác. Chúng thừa kế hiệu lực của
    // offer, nên lọc theo offer chứ không lọc theo ngày.
    offerComponents: data.offerComponents.filter((component) =>
      liveOfferIds.has(component.offerId),
    ),
    earningRates: activeAt(data.earningRates, asOf).filter((rate) =>
      liveProductIds.has(rate.productId),
    ),
    productBenefits: activeAt(data.productBenefits, asOf).filter((benefit) =>
      liveProductIds.has(benefit.productId),
    ),
    eligibilityRules: activeAt(data.eligibilityRules, asOf).filter((rule) =>
      liveProductIds.has(rule.productId),
    ),
    transferPaths: activeAt(data.transferPaths, asOf),
    awardStrategies: activeAt(data.awardStrategies, asOf),
  };
}
