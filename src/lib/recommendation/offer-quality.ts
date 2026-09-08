/**
 * §11 Offer Quality + §12 Historical Offer Percentile.
 *
 * Câu §11 nói thẳng: **đừng chấm offer chỉ bằng con số quảng cáo.** "100K" mà
 * 60K lấy được trong 3 tháng đầu còn 40K phải chi $40,000 cả năm thì với phần
 * lớn người đọc, mức dùng được là 60K. Con số đó — không phải con số trên
 * banner — mới là thứ đi vào điểm.
 *
 * HAI TẦNG, và tách chúng ra là chuyện quan trọng:
 *
 *   `offerFacts`   — dữ kiện của MỘT thẻ: mức dùng được, giá trị, percentile.
 *                    Không so với thẻ nào khác.
 *   `offerQuality` — điểm 0..1, tính TƯƠNG ĐỐI trên cả tập ứng viên.
 *
 * Vì sao tầng hai phải tương đối: mọi cách khác đều là hằng số ma thuật. "Trên
 * $1,500 mốc chi là khó" đúng với ai? Chuẩn hoá theo chính tập ứng viên hôm
 * nay thì thang đo tự đi theo thị trường, và thay đổi duy nhất khi thị trường
 * đổi — thứ ta muốn đo. Nó vẫn TẤT ĐỊNH: cùng tập ứng viên cho cùng thang đo.
 */

import { compareToThreshold } from "./user.ts";
import { centsPerPoint } from "./portfolio.ts";
import { activeAt } from "./temporal.ts";
import { requiredSpendOf, spendPerNinetyDays, spendWindowsOf } from "./spend.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { OfferComponent, Product } from "./types.ts";
import type { EstimatedAmount } from "./user-types.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { ActiveOffer } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/** Bao nhiêu ngày giữa hai ngày `YYYY-MM-DD`. Âm nếu `to` nằm trước `from`. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Offer đang chạy của một sản phẩm ở `asOf`, kèm các mốc của nó. */
export function activeOfferFor(
  ix: DatasetIndex,
  productId: string,
  asOf: string,
): ActiveOffer | null {
  const offers = activeAt(ix.offersByProduct.get(productId) ?? [], asOf).filter(
    (offer) => offer.isActive && offer.isPublic,
  );
  if (offers.length === 0) return null;
  // Validator của Phase 1 chặn hai offer chồng thời gian trên cùng một thẻ,
  // nên ở đây tối đa một dòng. Vẫn sắp để phòng dữ liệu tương lai: id mang
  // ngày bắt đầu, nên id lớn hơn là offer mới hơn.
  const offer = [...offers].sort((a, b) => (a.id < b.id ? 1 : -1))[0];
  const components = [...(ix.componentsByOffer.get(offer.id) ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  return { offer, components };
}

/** Giá trị (cent) của một thành phần: điểm × định giá, cộng tiền mặt. */
function componentValueCents(
  component: OfferComponent,
  cpp: number | null,
  repeats: number,
): number {
  const points = (component.pointsAmount ?? 0) * repeats;
  const cash = (component.cashAmount ?? 0) * repeats;
  return (cpp === null ? 0 : points * cpp) + cash * 100;
}

/**
 * `monthly_spend` trả thưởng MỖI chu kỳ, nên cả điểm lẫn chi tiêu đều nhân
 * `repeatCount`. `requiredSpendOf` đã nhân vế chi tiêu; vế điểm phải nhân ở
 * đây, và bỏ sót nó là báo Cobalt® thưởng 1,250 điểm thay vì 15,000.
 */
function repeatsOf(component: OfferComponent): number {
  return component.componentType === "monthly_spend" ? (component.repeatCount ?? 1) : 1;
}

export interface OfferFacts {
  productId: string;
  active: ActiveOffer | null;
  headlineBonus: number | null;
  /** Tổng điểm/tiền của MỌI thành phần — mức tối đa lấy được, dù mất bao lâu. */
  fullValueCents: number | null;
  /** Giá trị của tập thành phần người này thật sự với tới, theo sức dồn đã khai. */
  usableValueCents: number | null;
  /** `usable / full`. `null` khi chưa biết sức dồn — KHÔNG phải 1. */
  usableRatio: number | null;
  /** Mốc chi quy về 90 ngày của tập thành phần với tới được. */
  requiredPerNinetyDays: number | null;
  /** Mốc chi quy về 90 ngày của TOÀN BỘ offer — con số §13 đem so. */
  fullRequiredPerNinetyDays: number | null;
  historicalPercentile: number | null;
  historyPoints: number;
  /** Số ngày còn lại tới `endDate`, `null` khi offer không có ngày kết thúc. */
  endsInDays: number | null;
  firstYearFeeCents: number;
  ongoingFeeCents: number;
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
}

/**
 * Tập thành phần có giá trị lớn nhất mà người này với tới được.
 *
 * Duyệt HẾT các tập con thay vì tham lam. Các mốc dùng chung tiền — $5,000
 * trong 120 ngày đã bao trọn $3,000 trong 120 ngày — nên "chi phí của tập" KHÔNG
 * bằng tổng chi phí từng phần, và một phép tham lam theo chi phí đơn lẻ sẽ
 * dừng lại quá sớm ở đúng những offer nhiều tầng. `totalSpend` trong
 * `spend.ts` đã giải bài đó cho một tập; ở đây chỉ còn chọn tập.
 *
 * Số thành phần tối đa trong bộ dữ liệu là 4, nên 2^n là 16 phép thử. Có chặn
 * ở 12 để một offer bệnh hoạn nào đó không làm treo lượt chạy.
 */
function bestReachableSubset(
  components: OfferComponent[],
  cpp: number | null,
  capacity: EstimatedAmount | null,
): { valueCents: number; requiredPerNinetyDays: number | null; tight: boolean } | null {
  const spending = components.filter((component) => requiredSpendOf(component) !== null);
  const free = components.filter((component) => requiredSpendOf(component) === null);
  const freeValue = free.reduce(
    (sum, component) => sum + componentValueCents(component, cpp, repeatsOf(component)),
    0,
  );

  if (spending.length > 12) return null;
  if (capacity === null) return null;

  let best: { valueCents: number; requiredPerNinetyDays: number | null; tight: boolean } | null =
    null;

  for (let mask = 0; mask < 1 << spending.length; mask += 1) {
    const chosen = spending.filter((_, index) => (mask & (1 << index)) !== 0);
    const required = spendPerNinetyDays(
      spendWindowsOf(
        chosen.map((component) => ({
          componentType: component.componentType,
          spendRequirement: component.spendRequirement,
          spendWindowDays: component.spendWindowDays,
          windowStartsAfterDays: component.windowStartsAfterDays,
          repeatCount: component.repeatCount,
        })),
      ),
    );
    let tight = false;
    if (required !== null) {
      const verdict = compareToThreshold(capacity, required);
      // `straddles` = khoảng sức dồn BẮC QUA mốc chi. Vẫn tính là với tới
      // được, nhưng đánh dấu chặt — loại ở đây là loại oan đúng những người mà
      // khoảng đó bao trùm (§14, và `compareToThreshold` sinh ra vì thế).
      if (verdict === "below") continue;
      tight = verdict === "straddles";
    }
    const valueCents =
      freeValue +
      chosen.reduce(
        (sum, component) => sum + componentValueCents(component, cpp, repeatsOf(component)),
        0,
      );
    const better =
      best === null ||
      valueCents > best.valueCents ||
      // Hoà giá trị thì lấy tập RẺ hơn: cùng phần thưởng mà ít mốc chi hơn là
      // lựa chọn tốt hơn, và nó cũng là phép phá hoà tất định.
      (valueCents === best.valueCents &&
        (required ?? 0) < (best.requiredPerNinetyDays ?? 0));
    if (better) best = { valueCents, requiredPerNinetyDays: required, tight };
  }
  return best;
}

/**
 * §12 — mức hiện tại đứng ở đâu so với chính lịch sử của thẻ này.
 *
 * BA cái bẫy của `offer-history.ts`, cả ba đều được xử ở đây:
 *
 *  1. Chỉ so hai điểm CÙNG ĐƠN VỊ. Thẻ cashback đổi từ "15%" sang "$250" là
 *     đổi đơn vị; so 15 với 250 là một câu về tiền, và nói sai thì người đọc
 *     mở nhầm thẻ.
 *  2. `amount: undefined` là nhãn không đọc được số, KHÔNG phải 0.
 *  3. Ít điểm dữ liệu quá thì trả `null`, đừng trả 100. Một thẻ mới theo dõi
 *     được một tháng luôn ở "mức cao nhất từng thấy", và đó là câu vô nghĩa
 *     nhất mà engine có thể nói.
 */
export function historicalPercentile(
  history: readonly OfferHistoryPoint[],
  current: number | null,
): { percentile: number | null; points: number } {
  if (current === null) return { percentile: null, points: 0 };
  const currentPoint = history.find((point) => point.amount === current);
  const unit = currentPoint?.unit;
  const sameUnit = history.filter(
    (point) => point.amount !== undefined && (unit === undefined || point.unit === unit),
  );
  // Dưới 3 đợt thì percentile là tiếng ồn. Ngưỡng là lựa chọn của engine, nói
  // ra ở đây chứ không giấu trong một phép so.
  if (sameUnit.length < 3) return { percentile: null, points: sameUnit.length };
  const notBetter = sameUnit.filter((point) => (point.amount as number) <= current).length;
  return {
    percentile: Math.round((notBetter / sameUnit.length) * 100),
    points: sameUnit.length,
  };
}

/** Phí thường niên đang hiệu lực (cent). 0 khi chưa có dòng phí nào. */
function annualFeeCents(ix: DatasetIndex, productId: string, asOf: string): number {
  const rows = activeAt(ix.feesByProduct.get(productId) ?? [], asOf);
  if (rows.length === 0) return 0;
  return Math.round(rows[0].annualFee * 100);
}

export function offerFacts(
  product: Product,
  ix: DatasetIndex,
  asOf: string,
  capacity: EstimatedAmount | null,
  history: readonly OfferHistoryPoint[],
): OfferFacts {
  const reasonCodes: ReasonCode[] = [];
  const warnings: WarningCode[] = [];
  const ongoingFeeCents = annualFeeCents(ix, product.id, asOf);
  const active = activeOfferFor(ix, product.id, asOf);

  if (active === null) {
    return {
      productId: product.id,
      active: null,
      headlineBonus: null,
      fullValueCents: null,
      usableValueCents: null,
      usableRatio: null,
      requiredPerNinetyDays: null,
      fullRequiredPerNinetyDays: null,
      historicalPercentile: null,
      historyPoints: 0,
      endsInDays: null,
      firstYearFeeCents: ongoingFeeCents,
      ongoingFeeCents,
      reasonCodes,
      warnings,
    };
  }

  const { offer, components } = active;
  const cpp =
    offer.bonusCurrencyId === null ? null : centsPerPoint(ix, offer.bonusCurrencyId, asOf);

  const fullValueCents = components.reduce(
    (sum, component) => sum + componentValueCents(component, cpp, repeatsOf(component)),
    0,
  );

  if (components.length === 0 && offer.headlineBonus !== null) {
    // DataGap `offer_terms_unknown`: có con số quảng cáo mà không có mốc nào.
    // Coi headline là mức dùng được ở đây là đúng cái §11 cấm.
    reasonCodes.push("OFFER_TERMS_UNKNOWN");
    warnings.push("OFFER_TERMS_INCOMPLETE");
  }

  const reachable = bestReachableSubset(components, cpp, capacity);
  const usableValueCents = reachable?.valueCents ?? null;
  const usableRatio =
    reachable === null || fullValueCents === 0 ? null : reachable.valueCents / fullValueCents;

  const { percentile, points } = historicalPercentile(history, offer.headlineBonus);
  if (percentile !== null && percentile >= 70) reasonCodes.push("CURRENT_OFFER_STRONG");
  if (percentile !== null && percentile <= 30) reasonCodes.push("CURRENT_OFFER_WEAK");

  const endsInDays = offer.endDate === null ? null : daysBetween(asOf, offer.endDate);
  if (endsInDays !== null && endsInDays >= 0 && endsInDays <= 30) {
    reasonCodes.push("OFFER_ENDING_SOON");
  }

  return {
    productId: product.id,
    active,
    headlineBonus: offer.headlineBonus,
    fullValueCents,
    usableValueCents,
    usableRatio,
    requiredPerNinetyDays: reachable?.requiredPerNinetyDays ?? null,
    fullRequiredPerNinetyDays: offer.spendPerNinetyDays,
    historicalPercentile: percentile,
    historyPoints: points,
    endsInDays,
    // Miễn phí năm đầu là ưu đãi của OFFER, không phải của sản phẩm — ba khái
    // niệm khác nhau ở ba chỗ khác nhau (xem README Phase 1).
    firstYearFeeCents:
      offer.annualFeeFirstYear === null
        ? ongoingFeeCents
        : Math.round(offer.annualFeeFirstYear * 100),
    ongoingFeeCents,
    reasonCodes,
    warnings,
  };
}

/**
 * Thang đo chung của MỘT lượt chạy: giá trị offer lớn nhất trong tập ứng viên.
 *
 * Có tên và có kiểu riêng để không ai lỡ tay tính nó bên trong vòng lặp ứng
 * viên — làm vậy thì mỗi thẻ được chuẩn hoá theo một thang khác nhau, và điểm
 * số thôi so sánh được với nhau trong khi vẫn trông bình thường.
 */
export interface OfferClimate {
  maxUsableValueCents: number;
  maxFullValueCents: number;
  /** Giá trị trên mỗi đô mốc chi, cao nhất trong tập. */
  maxValuePerSpendDollar: number;
  /** Percentile trung vị của các offer đang chạy — dùng cho WAIT_FOR_BETTER_OFFER. */
  medianPercentile: number | null;
}

export function offerClimate(facts: readonly OfferFacts[]): OfferClimate {
  let maxUsable = 0;
  let maxFull = 0;
  let maxPerDollar = 0;
  const percentiles: number[] = [];
  for (const fact of facts) {
    maxUsable = Math.max(maxUsable, fact.usableValueCents ?? 0);
    maxFull = Math.max(maxFull, fact.fullValueCents ?? 0);
    const required = fact.requiredPerNinetyDays ?? fact.fullRequiredPerNinetyDays;
    const value = fact.usableValueCents ?? fact.fullValueCents;
    if (required !== null && required > 0 && value !== null) {
      maxPerDollar = Math.max(maxPerDollar, value / required);
    }
    if (fact.historicalPercentile !== null) percentiles.push(fact.historicalPercentile);
  }
  percentiles.sort((a, b) => a - b);
  const median =
    percentiles.length === 0
      ? null
      : percentiles.length % 2 === 1
        ? percentiles[(percentiles.length - 1) / 2]
        : (percentiles[percentiles.length / 2 - 1] + percentiles[percentiles.length / 2]) / 2;

  return {
    maxUsableValueCents: maxUsable,
    maxFullValueCents: maxFull,
    maxValuePerSpendDollar: maxPerDollar,
    medianPercentile: median,
  };
}

/**
 * §11 gộp lại thành một số 0..1.
 *
 * Năm vế của §11, và trọng số bên trong là lựa chọn của engine — spec chỉ
 * liệt kê thành phần chứ không cho tỷ lệ, nên chúng được viết ra ở đây thay vì
 * chôn trong một biểu thức:
 *
 *   0.30  giá trị dùng được, so với offer giàu nhất tập
 *   0.25  percentile lịch sử (§12); chưa đủ dữ liệu thì 0.5 — trung tính,
 *         không thưởng cũng không phạt vì thiếu dữ liệu
 *   0.15  tỷ lệ dùng được trên tổng quảng cáo (§11: 60K trong "100K")
 *   0.20  giá trị trên mỗi đô mốc chi
 *   0.10  phí năm đầu ăn mất bao nhiêu phần bonus
 *
 * Thẻ KHÔNG có offer nào được 0, không phải `null`: "không có welcome bonus"
 * là một sự thật về thẻ, và nó phải cạnh tranh được với các thẻ khác ở những
 * thành phần còn lại của §10 thay vì bị loại khỏi bảng.
 */
export function offerQualityScore(fact: OfferFacts, climate: OfferClimate): number {
  if (fact.active === null) return 0;

  const value = fact.usableValueCents ?? fact.fullValueCents ?? 0;
  const valueScore = climate.maxUsableValueCents > 0 ? value / climate.maxUsableValueCents : 0;

  const percentileScore =
    fact.historicalPercentile === null ? 0.5 : fact.historicalPercentile / 100;

  const usableScore = fact.usableRatio ?? 0.5;

  const required = fact.requiredPerNinetyDays ?? fact.fullRequiredPerNinetyDays;
  const perDollar = required !== null && required > 0 ? value / required : null;
  const efficiencyScore =
    perDollar === null || climate.maxValuePerSpendDollar <= 0
      ? // Không có mốc chi nào = lấy được bonus không cần chi gì. Đó là hiệu
        // quả TỐI ĐA, không phải thiếu dữ liệu.
        required === null
        ? 1
        : 0.5
      : Math.min(1, perDollar / climate.maxValuePerSpendDollar);

  const feeScore =
    value <= 0 ? 0 : Math.max(0, 1 - fact.firstYearFeeCents / value);

  return clamp01(
    0.3 * clamp01(valueScore) +
      0.25 * clamp01(percentileScore) +
      0.15 * clamp01(usableScore) +
      0.2 * clamp01(efficiencyScore) +
      0.1 * clamp01(feeScore),
  );
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
