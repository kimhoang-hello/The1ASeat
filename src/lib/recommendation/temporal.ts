import { deriveGaps } from "./gaps.ts";
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
 *
 * SẢN PHẨM NGỪNG PHÁT HÀNH VẪN Ở LẠI. `Temporal` của `Product` nói bản ghi có
 * mô tả hiện thực hay không, KHÔNG nói thẻ còn mở được hay không — cái sau là
 * `availableFrom/availableTo`. Loại thẻ ngừng phát hành khỏi kết quả sẽ làm
 * Portfolio Analyzer ở Phase 3 quên mất một thẻ người dùng đang cầm trong ví:
 * không cộng điểm nó kiếm được, và đếm quyền lợi của thẻ mới như thể chưa ai
 * có. Lọc theo khả dụng là việc của tầng khuyến nghị, không phải của tầng đọc
 * dữ liệu.
 */
export function datasetAt(
  data: RecommendationDataset,
  asOf: string,
  options?: { knownAt?: string },
): RecommendationDataset {
  // `knownAt` cắt theo TRỤC THỜI GIAN THỨ HAI: chỉ giữ những bản ghi đã có mặt
  // trong kho tính đến ngày đó. Không có nó thì một đính chính LÙI NGÀY nhập
  // hôm nay — `effectiveFrom` tháng trước, `recordedAt` hôm nay — vẫn lọt vào
  // bản dựng lại của tháng trước, và Phase 4 "giải thích" một khuyến nghị cũ
  // bằng dữ kiện mà engine lúc ấy chưa hề biết. Đó đúng là thứ `recordedAt`
  // sinh ra để chặn, nên phép cắt phải nằm ở ĐÂY chứ không trông vào người gọi
  // nhớ lọc thêm một lần nữa.
  //
  // GIỚI HẠN, nói thẳng: một `recordedAt` duy nhất KHÔNG dựng lại được mọi
  // chuyện. Đóng một dòng cũ là SỬA dòng đó (đặt `effectiveTo`), và bản ghi
  // không giữ lại việc nó từng mở — nên dựng lại một ngày trước lần đóng sẽ
  // thấy dòng đã đóng. Muốn đúng tuyệt đối thì mọi dòng phải bất biến và mỗi
  // lần đóng là một phiên bản mới. Phase 1 KHÔNG làm vậy có chủ ý: spec §20 đã
  // yêu cầu `recommendation_runs` lưu `input_snapshot` và `derived_state` của
  // chính lượt chạy đó, và một bản chụp đã lưu luôn đúng hơn mọi phép dựng
  // lại. Chỗ này là lưới thứ hai cho những lượt chạy không có bản chụp.
  const known = <T extends { recordedAt: string }>(rows: readonly T[]): T[] =>
    options?.knownAt === undefined
      ? [...rows]
      : rows.filter((row) => row.recordedAt <= options.knownAt!);

  const products = activeAt(data.products, asOf);
  const liveProductIds = new Set(products.map((product) => product.id as string));
  const offers = activeAt(known(data.offers), asOf).filter((offer) =>
    liveProductIds.has(offer.productId),
  );
  const liveOfferIds = new Set(offers.map((offer) => offer.id as string));

  const snapshot: RecommendationDataset = {
    issuers: data.issuers,
    pointsPrograms: data.pointsPrograms,
    benefits: data.benefits,
    // Họ sản phẩm là từ điển, không có `Temporal` — nó chỉ nhóm các hạng lại.
    productFamilies: data.productFamilies,
    // Định giá thì CÓ, và phải lọc: devalue là một sự kiện có ngày, và một
    // khuyến nghị cũ phải được giải thích bằng định giá của lúc đó.
    programValuations: activeAt(known(data.programValuations), asOf),
    products,
    productFees: activeAt(known(data.productFees), asOf).filter((fee) =>
      liveProductIds.has(fee.productId),
    ),
    offers,
    // `offer_components` KHÔNG có `Temporal` riêng: một offer là một gói điều
    // khoản, sửa một thành phần là một offer khác. Chúng thừa kế hiệu lực của
    // offer, nên lọc theo offer chứ không lọc theo ngày.
    offerComponents: data.offerComponents.filter((component) =>
      liveOfferIds.has(component.offerId),
    ),
    earningRates: activeAt(known(data.earningRates), asOf).filter((rate) =>
      liveProductIds.has(rate.productId),
    ),
    earningCaps: activeAt(known(data.earningCaps), asOf).filter((cap) =>
      liveProductIds.has(cap.productId),
    ),
    productBenefits: activeAt(known(data.productBenefits), asOf).filter((benefit) =>
      liveProductIds.has(benefit.productId),
    ),
    eligibilityRules: activeAt(known(data.eligibilityRules), asOf).filter((rule) =>
      liveProductIds.has(rule.productId),
    ),
    transferPaths: activeAt(known(data.transferPaths), asOf),
    awardStrategies: activeAt(known(data.awardStrategies), asOf),
    // Tính LẠI, không chép từ bộ đầy đủ: chỗ trống của hôm nay khác chỗ trống
    // của sáu tháng trước. Một thẻ hồi đó chưa có tỷ lệ nền mà nay đã có thì
    // bản dựng lại phải nói đúng cái engine thiếu LÚC ẤY.
    gaps: [],
  };
  return { ...snapshot, gaps: deriveGaps(snapshot) };
}
