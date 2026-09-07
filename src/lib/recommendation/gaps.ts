import { UNQUOTABLE_AWARD_PROGRAMS } from "./data/award-strategies.ts";
import { INCOMPLETE_OFFERS } from "./data/offers.ts";
import { TRIP_REGIONS, type DataGap, type RecommendationDataset } from "./types.ts";

/**
 * Suy ra danh sách chỗ trống TỪ CHÍNH DỮ LIỆU, thay vì bắt ai đó duy trì một
 * danh sách song song.
 *
 * Danh sách viết tay sẽ lệch: thêm tỷ lệ nền cho một thẻ mà quên xoá dòng khai
 * thiếu thì engine vĩnh viễn hạ độ tin cậy cho một thẻ đã đủ dữ liệu. Suy ra
 * thì không có gì để quên.
 *
 * Hai nguồn KHÔNG suy được và phải khai tay, vì chúng là kết luận của con
 * người chứ không phải hệ quả của dữ liệu: `UNQUOTABLE_AWARD_PROGRAMS` ("đã
 * tra và kết luận không quote được" khác hẳn "chưa ai làm") và
 * `INCOMPLETE_OFFERS` (lý do vì sao offer thiếu mốc chi).
 */
export function deriveGaps(data: RecommendationDataset): DataGap[] {
  const gaps: DataGap[] = [];

  for (const program of UNQUOTABLE_AWARD_PROGRAMS) {
    gaps.push({ kind: "no_award_chart", subjectId: program.programId, reason: program.reason });
  }

  // Cặp vùng chưa có strategy nào. Chỉ soi chiều ĐI TỪ Canada — V1 chỉ phục vụ
  // người ở Canada (spec §33), nên "Nhật → châu Âu" trống là đúng, không thiếu.
  const covered = new Set(
    data.awardStrategies.map((s) => `${s.originRegion}|${s.destinationRegion}`),
  );
  for (const destination of TRIP_REGIONS) {
    if (destination === "CANADA_US") continue;
    const key = `CANADA_US|${destination}`;
    if (covered.has(key)) continue;
    gaps.push({
      kind: "award_route_uncovered",
      subjectId: key,
      reason: "Chưa dựng bảng giá cho cặp vùng này; đừng đoán, hãy nói là chưa có.",
    });
  }

  // Chỉ khai chỗ trống của những offer CÓ TRONG bộ dữ liệu đang xét.
  // `INCOMPLETE_OFFERS` là danh sách toàn cục của hiện tại; rải nó vào một bản
  // dựng lại của quá khứ sẽ nói về những offer chưa tồn tại lúc đó — rò rỉ
  // kiến thức tương lai vào đúng chỗ `knownAt` sinh ra để chặn.
  const offerIds = new Set(data.offers.map((offer) => offer.id as string));
  for (const offer of INCOMPLETE_OFFERS) {
    if (!offerIds.has(offer.offerId)) continue;
    gaps.push({ kind: "offer_terms_unknown", subjectId: offer.offerId, reason: offer.reason });
  }

  const withBaseRate = new Set(
    data.earningRates
      .filter((rate) => rate.category === "everything_else" && rate.restrictedTo === null)
      .map((rate) => rate.productId as string),
  );
  for (const product of data.products) {
    if (withBaseRate.has(product.id)) continue;
    gaps.push({
      kind: "base_earn_rate_unknown",
      subjectId: product.id,
      reason:
        "Nội dung site chưa nêu tỷ lệ cho chi tiêu thông thường, nên không tính " +
        "được giá trị dài hạn — chỉ so được phần welcome bonus.",
    });
  }

  // Điều kiện: chỉ đếm luật (a) đặc thù của thẻ này và (b) nói về việc ĐƯỢC
  // DUYỆT ĐƠN.
  //
  // Luật cư trú áp cho mọi thẻ nên nó không nói gì riêng. Còn luật
  // `scope: "welcome_offer"` — như "từng giữ thẻ Amex® này rồi" — nói về
  // welcome bonus, KHÔNG nói người này có được duyệt thẻ hay không. Đếm nó là
  // kết luận "đã biết điều kiện mở thẻ" cho một thẻ mà mình chưa biết gì về
  // ngưỡng thu nhập, rồi engine im lặng bỏ qua một điều chưa chắc chắn.
  const specificRules = new Map<string, number>();
  for (const rule of data.eligibilityRules) {
    if (rule.ruleType === "residency" || rule.scope !== "application") continue;
    specificRules.set(rule.productId, (specificRules.get(rule.productId) ?? 0) + 1);
  }
  for (const product of data.products) {
    if ((specificRules.get(product.id) ?? 0) > 0) continue;
    gaps.push({
      kind: "eligibility_unknown",
      subjectId: product.id,
      reason:
        "Chỉ có luật cư trú áp cho mọi thẻ; chưa biết điều kiện riêng. KHÔNG " +
        "được đọc là 'không yêu cầu gì'.",
    });
  }

  const sourcesWithPaths = new Set(data.transferPaths.map((path) => path.sourceProgramId as string));
  for (const program of data.pointsPrograms) {
    if (!program.transferable || sourcesWithPaths.has(program.id)) continue;
    gaps.push({
      kind: "transfer_paths_unmodelled",
      subjectId: program.id,
      reason:
        "Chương trình chuyển đi được nhưng chưa dựng chặng nào, nên số dư của " +
        "nó chưa với tới chương trình nào trong tính toán.",
    });
  }

  return gaps;
}
