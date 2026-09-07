import type {
  AwardStrategy,
  Benefit,
  EarningCap,
  EarningRate,
  EligibilityRule,
  Issuer,
  Offer,
  OfferComponent,
  PointsProgram,
  Product,
  ProductBenefit,
  ProductFamily,
  ProgramValuation,
  ProductFee,
  RecommendationDataset,
  TransferPath,
} from "./types.ts";

/**
 * Đường truy cập cho engine.
 *
 * VÌ SAO PHẢI CÓ NGAY Ở PHASE 1, khi 31 sản phẩm thì quét mảng cũng chưa tốn
 * gì: hình dạng dữ liệu quyết định hình dạng code đọc nó. Không có lớp này,
 * Phase 3 sẽ viết `data.earningRates.filter(r => r.productId === p.id)` bên
 * trong vòng lặp ứng viên — và đó là O(sản phẩm × tỷ lệ) cho MỖI lần chấm
 * điểm, lặp lại cho mỗi hàm chấm điểm theo ý định. Đến lúc thấy chậm thì mẫu
 * đó đã nằm rải khắp bốn hàm scoring, và sửa nó là viết lại chúng.
 *
 * Ở database thì đây là các index trên khoá ngoại. Chỗ này không có database,
 * nên chúng là `Map` — nhưng chúng phải TỒN TẠI, để code Phase 3 sinh ra đã
 * quen tra bằng khoá thay vì quét.
 *
 * Dựng một lần cho mỗi lượt chạy khuyến nghị. KHÔNG cache toàn cục: dữ liệu
 * đọc tại một thời điểm (`datasetAt`) khác nhau giữa các lượt, và một index
 * cache lại là một index nói về một ngày khác.
 */
export interface DatasetIndex {
  productById: ReadonlyMap<string, Product>;
  /** Slug là khoá TỰ NHIÊN và có thể đổi — tra bằng nó chỉ để nối sang
   *  Contentful, không bao giờ để lưu tham chiếu. */
  productBySlug: ReadonlyMap<string, Product>;
  issuerById: ReadonlyMap<string, Issuer>;
  programById: ReadonlyMap<string, PointsProgram>;
  benefitById: ReadonlyMap<string, Benefit>;
  familyById: ReadonlyMap<string, ProductFamily>;
  /** Các hạng của một họ, đã sắp từ thấp tới cao. Engine dùng nó để không
   *  khuyên hai hạng cùng lúc, và để tụt xuống hạng thấp hơn khi người dùng
   *  không đủ điều kiện hạng cao. */
  productsByFamily: ReadonlyMap<string, Product[]>;
  valuationsByProgram: ReadonlyMap<string, ProgramValuation[]>;

  feesByProduct: ReadonlyMap<string, ProductFee[]>;
  offersByProduct: ReadonlyMap<string, Offer[]>;
  componentsByOffer: ReadonlyMap<string, OfferComponent[]>;
  ratesByProduct: ReadonlyMap<string, EarningRate[]>;
  benefitsByProduct: ReadonlyMap<string, ProductBenefit[]>;
  rulesByProduct: ReadonlyMap<string, EligibilityRule[]>;
  /** `EarningRate.capId` trỏ vào đây. Không có map này thì Phase 3 phải quét
   *  toàn bộ trần cho MỖI tỷ lệ — và tỷ lệ là thứ nó duyệt nhiều nhất. */
  capById: ReadonlyMap<string, EarningCap>;
  capsByProduct: ReadonlyMap<string, EarningCap[]>;
  /** Hai đường lọc ứng viên mà mọi hàm chấm điểm sẽ bắt đầu bằng: "thẻ nào
   *  kiếm đồng tiền này" và "thẻ nào của ngân hàng này". */
  productsByProgram: ReadonlyMap<string, Product[]>;
  productsByIssuer: ReadonlyMap<string, Product[]>;

  /** Chặng chuyển ĐI từ một chương trình. Đây là đường Portfolio Analyzer đi
   *  để tính "số dư tiếp cận được" mà không đếm trùng (spec §7). */
  pathsBySource: ReadonlyMap<string, TransferPath[]>;
  /** Award strategy theo `origin|destination|cabin` — đúng hình dạng câu hỏi
   *  của một trip goal. */
  strategiesByRoute: ReadonlyMap<string, AwardStrategy[]>;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list === undefined) map.set(k, [row]);
    else list.push(row);
  }
  return map;
}

/** Khoá tra award strategy. Một hàm chứ không phải nối chuỗi tại chỗ, để chỗ
 *  dựng và chỗ tra không bao giờ lệch nhau về thứ tự hay dấu ngăn. */
export function routeKey(origin: string, destination: string, cabin: string): string {
  return `${origin}|${destination}|${cabin}`;
}

export function indexDataset(data: RecommendationDataset): DatasetIndex {
  return {
    productById: new Map(data.products.map((row) => [row.id as string, row])),
    productBySlug: new Map(data.products.map((row) => [row.slug, row])),
    issuerById: new Map(data.issuers.map((row) => [row.id as string, row])),
    programById: new Map(data.pointsPrograms.map((row) => [row.id as string, row])),
    benefitById: new Map(data.benefits.map((row) => [row.id as string, row])),
    familyById: new Map(data.productFamilies.map((row) => [row.id as string, row])),
    productsByFamily: new Map(
      [...groupBy(
        data.products.filter((row) => row.familyId !== null),
        (row) => row.familyId as string,
      )].map(([key, rows]) => [key, [...rows].sort((a, b) => (a.tierRank ?? 0) - (b.tierRank ?? 0))]),
    ),
    valuationsByProgram: groupBy(data.programValuations, (row) => row.programId),

    feesByProduct: groupBy(data.productFees, (row) => row.productId),
    offersByProduct: groupBy(data.offers, (row) => row.productId),
    componentsByOffer: groupBy(data.offerComponents, (row) => row.offerId),
    ratesByProduct: groupBy(data.earningRates, (row) => row.productId),
    benefitsByProduct: groupBy(data.productBenefits, (row) => row.productId),
    rulesByProduct: groupBy(data.eligibilityRules, (row) => row.productId),
    capById: new Map(data.earningCaps.map((row) => [row.id as string, row])),
    capsByProduct: groupBy(data.earningCaps, (row) => row.productId),
    productsByProgram: groupBy(
      data.products.filter((row) => row.pointsProgramId !== null),
      (row) => row.pointsProgramId as string,
    ),
    productsByIssuer: groupBy(data.products, (row) => row.issuerId),

    pathsBySource: groupBy(data.transferPaths, (row) => row.sourceProgramId),
    strategiesByRoute: groupBy(data.awardStrategies, (row) =>
      routeKey(row.originRegion, row.destinationRegion, row.cabin),
    ),
  };
}
