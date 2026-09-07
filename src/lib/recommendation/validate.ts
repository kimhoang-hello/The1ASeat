import { INCOMPLETE_OFFERS, UNQUOTABLE_AWARD_PROGRAMS } from "./data/index.ts";
import { isActiveAt } from "./temporal.ts";
import type { RecommendationDataset, Temporal } from "./types.ts";

/**
 * `YYYY-MM-DD` VÀ là một ngày có thật.
 *
 * So chuỗi thì "2026-02-31" và "2026-13-01" đều lọt: chúng sắp đúng thứ tự với
 * mọi ngày khác nên không phép so sánh nào phát hiện ra. Rồi `Date.parse` đọc
 * chúng thành một ngày khác hẳn, và mọi phép tính theo thời gian lệch đi âm
 * thầm.
 */
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Số ngày giữa hai ngày `YYYY-MM-DD`. Âm khi `from` nằm sau `to`. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Kiểm bộ dữ liệu Phase 1.
 *
 * Ở một database thì phần lớn những phép kiểm dưới đây là khoá ngoại và ràng
 * buộc CHECK. Kho này nằm trong git nên chúng phải chạy được — và chạy được
 * hoá ra lại hơn: chúng kiểm cả những thứ khoá ngoại không kiểm nổi, như "mỗi
 * cặp sản phẩm/hạng mục có đúng một tỷ lệ không giới hạn merchant", hay "thẻ
 * này có tỷ lệ cho chi tiêu thông thường chưa".
 *
 * HAI MỨC, và ranh giới giữa chúng là ranh giới quan trọng nhất trong file:
 *
 *   `error`   — dữ liệu SAI. Tham chiếu gãy, trùng id, ngày ngược. Engine
 *               dựng trên đó sẽ nói sai. Chặn.
 *   `warning` — dữ liệu THIẾU, và đã biết là thiếu. Thẻ chưa có tỷ lệ nền,
 *               vùng chưa có bảng giá. Không chặn: một bộ dữ liệu thật thà về
 *               chỗ trống của nó tốt hơn một bộ được lấp đầy bằng phỏng đoán.
 *               Việc của Phase 3 là hạ độ tin cậy khi chạm vào chỗ trống, chứ
 *               không phải giả vờ chúng không có.
 */

export interface ValidationIssue {
  level: "error" | "warning";
  entity: string;
  message: string;
}

function checkUniqueIds(
  rows: { id: string }[],
  entity: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      issues.push({ level: "error", entity, message: `Id trùng: ${row.id}` });
    }
    seen.add(row.id);
  }
}

function checkRef(
  rows: { id: string }[],
  field: string,
  valueOf: (row: never) => string | null,
  targets: Set<string>,
  entity: string,
  issues: ValidationIssue[],
): void {
  for (const row of rows) {
    const value = valueOf(row as never);
    if (value === null) continue;
    if (!targets.has(value)) {
      issues.push({
        level: "error",
        entity,
        message: `${row.id}: ${field} trỏ tới "${value}" không tồn tại`,
      });
    }
  }
}

/** `effectiveTo` trước `effectiveFrom` là một bản ghi chưa từng có hiệu lực —
 *  im lặng biến mất khỏi mọi truy vấn thay vì báo lỗi. */
function checkTemporal(
  rows: (Temporal & { id: string })[],
  entity: string,
  issues: ValidationIssue[],
): void {
  for (const row of rows) {
    for (const [field, value] of [
      ["effectiveFrom", row.effectiveFrom],
      ["effectiveTo", row.effectiveTo],
    ] as const) {
      if (value !== null && !isRealDate(value)) {
        issues.push({
          level: "error",
          entity,
          message: `${row.id}: ${field} "${value}" không phải một ngày có thật`,
        });
      }
    }
    if (row.effectiveTo !== null && row.effectiveTo < row.effectiveFrom) {
      issues.push({
        level: "error",
        entity,
        message: `${row.id}: effectiveTo (${row.effectiveTo}) trước effectiveFrom (${row.effectiveFrom})`,
      });
    }
  }
}

/**
 * `asOf` chỉ dùng cho phép kiểm ĐỘ TƯƠI. Truyền vào thay vì đọc đồng hồ bên
 * trong, để hàm còn thuần: cùng dữ liệu + cùng ngày = cùng kết quả, nên test
 * viết được mà không phải giả lập thời gian. Phía site truyền
 * `todayInSiteZone()`.
 */
export function validateDataset(
  data: RecommendationDataset,
  asOf: string = new Date().toISOString().slice(0, 10),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const issuerIds = new Set(data.issuers.map((r) => r.id));
  const programIds = new Set(data.pointsPrograms.map((r) => r.id));
  const productIds = new Set(data.products.map((r) => r.id));
  const productById = new Map(data.products.map((r) => [r.id as string, r]));
  const offerIds = new Set(data.offers.map((r) => r.id));
  const benefitIds = new Set(data.benefits.map((r) => r.id));

  checkUniqueIds(data.issuers, "issuers", issues);
  checkUniqueIds(data.pointsPrograms, "points_programs", issues);
  checkUniqueIds(data.products, "products", issues);
  checkUniqueIds(data.offers, "offers", issues);
  checkUniqueIds(data.offerComponents, "offer_components", issues);
  checkUniqueIds(data.earningRates, "earning_rates", issues);
  checkUniqueIds(data.benefits, "benefits", issues);
  checkUniqueIds(data.productBenefits, "product_benefits", issues);
  checkUniqueIds(data.eligibilityRules, "eligibility_rules", issues);
  checkUniqueIds(data.transferPaths, "transfer_paths", issues);
  checkUniqueIds(data.awardStrategies, "award_strategies", issues);
  checkUniqueIds(data.productFees, "product_fees", issues);
  checkUniqueIds(data.productFamilies, "product_families", issues);
  checkUniqueIds(data.programValuations, "program_valuations", issues);

  checkRef(data.products, "issuerId", (r: { issuerId: string }) => r.issuerId, issuerIds, "products", issues);
  checkRef(data.products, "pointsProgramId", (r: { pointsProgramId: string | null }) => r.pointsProgramId, programIds, "products", issues);
  checkRef(data.productFees, "productId", (r: { productId: string }) => r.productId, productIds, "product_fees", issues);
  checkRef(data.products, "supersededByProductId", (r: { supersededByProductId: string | null }) => r.supersededByProductId, productIds, "products", issues);
  checkRef(data.offers, "productId", (r: { productId: string }) => r.productId, productIds, "offers", issues);
  checkRef(data.offers, "bonusCurrencyId", (r: { bonusCurrencyId: string | null }) => r.bonusCurrencyId, programIds, "offers", issues);
  checkRef(data.offerComponents, "offerId", (r: { offerId: string }) => r.offerId, offerIds, "offer_components", issues);
  checkRef(data.earningRates, "productId", (r: { productId: string }) => r.productId, productIds, "earning_rates", issues);
  checkRef(data.earningRates, "pointsProgramId", (r: { pointsProgramId: string }) => r.pointsProgramId, programIds, "earning_rates", issues);
  checkRef(data.productBenefits, "productId", (r: { productId: string }) => r.productId, productIds, "product_benefits", issues);
  checkRef(data.productBenefits, "benefitId", (r: { benefitId: string }) => r.benefitId, benefitIds, "product_benefits", issues);
  checkRef(data.eligibilityRules, "productId", (r: { productId: string }) => r.productId, productIds, "eligibility_rules", issues);
  checkRef(data.transferPaths, "sourceProgramId", (r: { sourceProgramId: string }) => r.sourceProgramId, programIds, "transfer_paths", issues);
  checkRef(data.transferPaths, "destinationProgramId", (r: { destinationProgramId: string }) => r.destinationProgramId, programIds, "transfer_paths", issues);
  checkRef(data.awardStrategies, "programId", (r: { programId: string }) => r.programId, programIds, "award_strategies", issues);

  checkTemporal(data.products, "products", issues);
  checkTemporal(data.offers, "offers", issues);
  checkTemporal(data.earningRates, "earning_rates", issues);
  checkTemporal(data.productBenefits, "product_benefits", issues);
  checkTemporal(data.eligibilityRules, "eligibility_rules", issues);
  checkTemporal(data.transferPaths, "transfer_paths", issues);
  checkTemporal(data.awardStrategies, "award_strategies", issues);
  checkTemporal(data.productFees, "product_fees", issues);
  checkTemporal(data.programValuations, "program_valuations", issues);

  // Slug phải là duy nhất: nó là khoá nối sang Contentful, và hai sản phẩm
  // cùng slug nghĩa là một trong hai sẽ im lặng bị bỏ qua ở mọi phép tra.
  const slugs = new Set<string>();
  for (const product of data.products) {
    if (slugs.has(product.slug)) {
      issues.push({ level: "error", entity: "products", message: `Slug trùng: ${product.slug}` });
    }
    slugs.add(product.slug);
  }

  // Chuyển điểm về chính nó là một vòng lặp vô hạn đang chờ Phase 3.
  for (const path of data.transferPaths) {
    if (path.sourceProgramId === path.destinationProgramId) {
      issues.push({
        level: "error",
        entity: "transfer_paths",
        message: `${path.id}: chuyển từ một chương trình về chính nó`,
      });
    }
    if (path.ratioFrom <= 0 || path.ratioTo <= 0) {
      issues.push({
        level: "error",
        entity: "transfer_paths",
        message: `${path.id}: tỷ lệ phải dương`,
      });
    }
  }

  // Nguồn của chặng chuyển BẮT BUỘC là chương trình `transferable`. Không có
  // phép kiểm này thì một dòng seed sai đủ để engine coi điểm Aeroplan® là
  // điểm linh hoạt và bắt đầu hứa những chuyến bay không đặt được.
  const byProgram = new Map(data.pointsPrograms.map((p) => [p.id as string, p]));
  for (const path of data.transferPaths) {
    const source = byProgram.get(path.sourceProgramId);
    if (source && !source.transferable) {
      issues.push({
        level: "error",
        entity: "transfer_paths",
        message: `${path.id}: nguồn ${source.slug} có transferable=false nhưng lại có chặng chuyển đi`,
      });
    }
  }

  // Mỗi cặp (sản phẩm, hạng mục) đúng MỘT dòng không giới hạn merchant.
  // Nhiều hơn: engine không biết chọn dòng nào. Chỉ có dòng giới hạn: hạng mục
  // đó trông như có tỷ lệ cao trong khi tỷ lệ nền chưa ai biết.
  //
  // TÍNH TRÊN CÁC DÒNG CÒN HIỆU LỰC TẠI `asOf`, không tính trên cả lịch sử.
  // Bản trước đếm mọi dòng từng tồn tại, nên đóng một tỷ lệ rồi thêm bản mới —
  // tức cách DUY NHẤT ghi lại một lần đổi tỷ lệ — lập tức thành "2 tỷ lệ không
  // giới hạn cho cùng một hạng mục". Nói cách khác, phép kiểm này cấm đúng cái
  // việc mà hợp đồng chỉ-thêm bắt phải làm. Test vòng đời số 4 bắt được.
  const liveRates = data.earningRates.filter((rate) => isActiveAt(rate, asOf));
  const unrestricted = new Map<string, number>();
  const restrictedOnly = new Map<string, boolean>();
  for (const rate of liveRates) {
    const key = `${rate.productId}|${rate.category}`;
    if (rate.restrictedTo === null) {
      unrestricted.set(key, (unrestricted.get(key) ?? 0) + 1);
    } else if (!unrestricted.has(key)) {
      restrictedOnly.set(key, true);
    }
  }
  for (const [key, count] of unrestricted) {
    if (count > 1) {
      issues.push({
        level: "error",
        entity: "earning_rates",
        message: `${key}: ${count} tỷ lệ không giới hạn merchant cho cùng một hạng mục`,
      });
    }
  }
  for (const key of restrictedOnly.keys()) {
    if (!unrestricted.has(key)) {
      issues.push({
        level: "warning",
        entity: "earning_rates",
        message: `${key}: chỉ có tỷ lệ giới hạn merchant, chưa có tỷ lệ nền`,
      });
    }
  }

  // `dynamic_floor` chỉ được có mức sàn. Có `pointsTypical`/`pointsHigh` nghĩa
  // là ai đó đã điền một con số chương trình không cam kết — đúng lỗi mà cột
  // "Select Partners" của Aeroplan® từng dụ vào.
  for (const strategy of data.awardStrategies) {
    if (strategy.pricingModel !== "dynamic_floor") continue;
    if (strategy.pointsTypical !== null || strategy.pointsHigh !== null) {
      issues.push({
        level: "error",
        entity: "award_strategies",
        message: `${strategy.id}: pricingModel là dynamic_floor nhưng vẫn có pointsTypical/pointsHigh`,
      });
    }
    if (strategy.pointsLow === null) {
      issues.push({
        level: "error",
        entity: "award_strategies",
        message: `${strategy.id}: dynamic_floor mà không có pointsLow thì không nói được gì`,
      });
    }
  }

  // low ≤ typical ≤ high. Ngược thứ tự là một khoảng không đọc được, và engine
  // so số dư với nó sẽ ra kết luận ngẫu nhiên.
  for (const strategy of data.awardStrategies) {
    const { pointsLow: low, pointsTypical: mid, pointsHigh: high } = strategy;
    const ordered = [low, mid, high].filter((v): v is number => v !== null);
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i] < ordered[i - 1]) {
        issues.push({
          level: "error",
          entity: "award_strategies",
          message: `${strategy.id}: khoảng điểm không tăng dần (${ordered.join(" / ")})`,
        });
        break;
      }
    }
  }

  // Luật `hard` cùng một `ruleGroup` được nối bằng HOẶC. Một nhóm chỉ có ĐÚNG
  // MỘT luật là một nhóm vô nghĩa — và tệ hơn, nó gợi ý sai rằng có một vế
  // thay thế mà thực ra không có.
  const groupSizes = new Map<string, number>();
  for (const rule of data.eligibilityRules) {
    if (rule.ruleGroup === null) continue;
    groupSizes.set(rule.ruleGroup, (groupSizes.get(rule.ruleGroup) ?? 0) + 1);
  }
  for (const [group, size] of groupSizes) {
    if (size < 2) {
      issues.push({
        level: "error",
        entity: "eligibility_rules",
        message: `${group}: nhóm HOẶC chỉ có ${size} luật`,
      });
    }
  }

  // (Phép kiểm chồng lấn offer nay nằm trong `checkNoOverlap` phía dưới, cùng
  // một chỗ với mọi quan hệ khác — và nó biết loại trừ offer targeted.)

  const capIds = new Set(data.earningCaps.map((cap) => cap.id as string));
  for (const cap of data.earningCaps) {
    if (cap.amount <= 0) {
      issues.push({ level: "error", entity: "earning_caps", message: `${cap.id}: trần phải dương` });
    }
  }
  for (const rate of data.earningRates) {
    if (rate.capId !== null && !capIds.has(rate.capId)) {
      issues.push({
        level: "error",
        entity: "earning_rates",
        message: `${rate.id}: capId trỏ tới "${rate.capId}" không tồn tại`,
      });
    }
    // Trần và tỷ lệ sau trần đi cùng nhau: có trần mà không nói sau trần ăn
    // bao nhiêu là để engine tự đoán, và nó sẽ đoán là 0.
    if (rate.capId !== null && rate.rateAfterCap === null) {
      issues.push({
        level: "warning",
        entity: "earning_rates",
        message: `${rate.id}: có trần nhưng không khai rateAfterCap`,
      });
    }
    if (rate.multiplier <= 0) {
      issues.push({
        level: "error",
        entity: "earning_rates",
        message: `${rate.id}: multiplier phải dương`,
      });
    }
  }

  // Thẻ không có tỷ lệ `everything_else` thì engine không tính nổi giá trị dài
  // hạn của nó — nó chỉ so được phần welcome bonus, tức so một thẻ bằng đúng
  // cái phần dễ gây hiểu nhầm nhất.
  const withBaseRate = new Set(
    liveRates
      .filter((r) => r.category === "everything_else" && r.restrictedTo === null)
      .map((r) => r.productId as string),
  );
  for (const product of data.products) {
    // Thẻ đã đóng thì không cần tỷ lệ nền còn hiệu lực — nó không còn được
    // khuyên nữa, và đòi hỏi ngược lại buộc người sửa phải để dữ liệu treo.
    if (!isActiveAt(product, asOf)) continue;
    if (!withBaseRate.has(product.id)) {
      issues.push({
        level: "warning",
        entity: "earning_rates",
        message: `${product.slug}: chưa có tỷ lệ everything_else`,
      });
    }
  }

  // Offer có headline nhưng không có component nào: engine chỉ biết con số
  // quảng cáo, đúng thứ §11 nói không được tin.
  const componentsByOffer = new Map<string, number>();
  for (const component of data.offerComponents) {
    componentsByOffer.set(component.offerId, (componentsByOffer.get(component.offerId) ?? 0) + 1);
  }
  const knownIncomplete = new Set(INCOMPLETE_OFFERS.map((o) => o.offerId));
  for (const offer of data.offers) {
    if (offer.headlineBonus === null) continue;
    if ((componentsByOffer.get(offer.id) ?? 0) > 0) continue;
    const reason = INCOMPLETE_OFFERS.find((o) => o.offerId === offer.id)?.reason;
    issues.push({
      level: "warning",
      entity: "offers",
      message: knownIncomplete.has(offer.id)
        ? `${offer.id}: chưa có component. ${reason}`
        : `${offer.id}: có headlineBonus ${offer.headlineBonus} nhưng không có component nào, và cũng không khai lý do trong INCOMPLETE_OFFERS`,
    });
  }

  // Tổng điểm của các component không được VƯỢT headline. Bằng hoặc thấp hơn
  // đều hợp lệ — thấp hơn là chuyện thường khi một phần bonus trả bằng tiền.
  // Vượt thì một trong hai con số sai, và cả hai đều là con số về tiền.
  // Gom MỘT lần rồi tra. Bản cũ `filter` toàn bộ `offerComponents` bên trong
  // vòng lặp offer — O(offer × component). Không đau ở 31 thẻ, nhưng đây là
  // mẫu code Phase 3 sẽ sao chép, nên nó phải đúng ngay từ chỗ này.
  const pointsByOffer = new Map<string, number>();
  for (const component of data.offerComponents) {
    const points = (component.pointsAmount ?? 0) * (component.repeatCount ?? 1);
    pointsByOffer.set(component.offerId, (pointsByOffer.get(component.offerId) ?? 0) + points);
  }
  for (const offer of data.offers) {
    if (offer.headlineBonus === null) continue;
    const total = pointsByOffer.get(offer.id) ?? 0;
    if (total > offer.headlineBonus) {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${offer.id}: component cộng lại ${total} điểm, vượt headlineBonus ${offer.headlineBonus}`,
      });
    }
  }

  // Sản phẩm ngừng bán phải nói RÕ ngừng từ bao giờ. `isActive: false` mà
  // không có `effectiveTo` là một bản ghi nói "đã ngừng" nhưng không truy vấn
  // theo thời điểm nào đọc được — Phase 4 sẽ không giải thích nổi vì sao một
  // khuyến nghị cũ từng chọn nó.
  for (const product of data.products) {
    for (const [field, value] of [
      ["availableFrom", product.availableFrom],
      ["availableTo", product.availableTo],
    ] as const) {
      if (value !== null && !isRealDate(value)) {
        issues.push({
          level: "error",
          entity: "products",
          message: `${product.slug}: ${field} "${value}" không phải một ngày có thật`,
        });
      }
    }
    if (product.availableTo !== null && product.availableTo < product.availableFrom) {
      issues.push({
        level: "error",
        entity: "products",
        message: `${product.slug}: availableTo trước availableFrom`,
      });
    }
  }

  // Sản phẩm ngừng bán KHÔNG được kéo theo việc xoá bản ghi con. `checkRef` ở
  // trên đã bắt tham chiếu tới sản phẩm không tồn tại; phép kiểm này canh
  // chiều còn lại — sản phẩm đã đóng mà mất sạch lịch sử offer nghĩa là ai đó
  // đã dọn dẹp thay vì đóng lại, và lịch sử không dựng lại được.

  // ---- Chồng lấn theo thời gian, tổng quát -------------------------------
  //
  // Cùng một phép kiểm cho mọi quan hệ mà "hai bản ghi cùng lúc" là vô nghĩa.
  // Viết một lần rồi gọi bốn lần, thay vì bốn bản sao lệch nhau dần.
  function checkNoOverlap<T extends Temporal & { id: string }>(
    rows: readonly T[],
    keyOf: (row: T) => string,
    entity: string,
  ): void {
    const byKey = new Map<string, T[]>();
    for (const row of rows) {
      const list = byKey.get(keyOf(row));
      if (list === undefined) byKey.set(keyOf(row), [row]);
      else list.push(row);
    }
    for (const [key, list] of byKey) {
      const sorted = [...list].sort((a, b) =>
        a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0,
      );
      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1];
        // `effectiveTo` là NGÀY CUỐI CÙNG còn hiệu lực, nên chồng lấn có dấu
        // bằng. `\uffff` sắp sau mọi ký tự: bản ghi chưa đóng là "muộn hơn tất cả".
        const previousTo = previous.effectiveTo ?? "\uffff";
        if (sorted[i].effectiveFrom <= previousTo) {
          issues.push({
            level: "error",
            entity,
            message: `${key}: ${previous.id} và ${sorted[i].id} chồng thời gian`,
          });
        }
      }
    }
  }

  // CHỈ offer công khai, không targeted. Bản trước cấm mọi offer song song,
  // trong khi chính schema có `isTargeted`/`isPublic` — tức nó cấm đúng thứ hai
  // trường đó sinh ra để mô tả. Một offer công khai của ngân hàng và một offer
  // targeted qua link riêng tồn tại cùng lúc là chuyện bình thường.
  checkNoOverlap(
    data.offers.filter((row) => row.isPublic && !row.isTargeted),
    (row) => row.productId,
    "offers",
  );
  checkNoOverlap(data.productFees, (row) => row.productId, "product_fees");
  checkNoOverlap(data.programValuations, (row) => row.programId, "program_valuations");
  checkNoOverlap(data.transferPaths, (row) => `${row.sourceProgramId}->${row.destinationProgramId}`, "transfer_paths");
  checkNoOverlap(data.productBenefits, (row) => `${row.productId}|${row.benefitId}`, "product_benefits");
  // Tỷ lệ tích điểm: khoá gồm cả nhóm merchant, vì hai dòng cùng hạng mục khác
  // nhóm merchant là hợp lệ và cùng tồn tại (xem `restrictedTo`).
  checkNoOverlap(
    data.earningRates,
    (row) => `${row.productId}|${row.category}|${row.restrictedTo ?? ""}`,
    "earning_rates",
  );
  checkNoOverlap(data.earningCaps, (row) => `${row.productId}|${row.name}`, "earning_caps");
  // Danh tính LOGIC của một luật điều kiện là (sản phẩm, loại luật, nhóm HOẶC).
  // Thiếu phép kiểm này thì thêm bản mới mà quên đóng bản cũ sẽ cho ra hai
  // ngưỡng thu nhập cùng lúc, và Phase 3 duyệt hay từ chối tuỳ dòng nào nó gặp
  // trước.
  checkNoOverlap(
    data.eligibilityRules,
    (row) => `${row.productId}|${row.ruleType}|${row.ruleGroup ?? ""}`,
    "eligibility_rules",
  );
  checkNoOverlap(
    data.awardStrategies,
    (row) => `${row.originRegion}|${row.destinationRegion}|${row.cabin}|${row.programId}|${row.strategyName}`,
    "award_strategies",
  );

  // ---- Phí thường niên ----------------------------------------------------
  for (const fee of data.productFees) {
    if (fee.annualFee < 0) {
      issues.push({
        level: "error",
        entity: "product_fees",
        message: `${fee.id}: annualFee âm`,
      });
    }
  }
  // Sản phẩm CÒN HOẠT ĐỘNG mà không có dòng phí nào thì engine không tính nổi
  // giá trị ròng của nó — nó chỉ cộng được lợi ích và bỏ qua chi phí, tức luôn
  // nghiêng về thẻ đắt tiền.
  const liveFeeProducts = new Set(
    data.productFees.filter((fee) => isActiveAt(fee, asOf)).map((fee) => fee.productId as string),
  );
  for (const product of data.products) {
    // Theo hoạt động TẠI `asOf`, không theo cờ trạng thái hôm nay: một thẻ nay
    // đã ngừng nhưng còn hoạt động ở `asOf` vẫn phải có phí, nếu không thì
    // `datasetAt` dựng lại một thế giới cũ trong đó thẻ đó miễn phí.
    if (!isActiveAt(product, asOf)) continue;
    if (!liveFeeProducts.has(product.id)) {
      issues.push({
        level: "error",
        entity: "product_fees",
        message: `${product.slug}: bản ghi còn hiệu lực ${asOf} nhưng không có dòng phí nào còn hiệu lực`,
      });
    }
  }

  // ---- Định giá điểm ------------------------------------------------------
  //
  // Con số này nhân vào MỌI điểm số. Thiếu nó thì engine hoặc coi đồng điểm đó
  // đáng 0 — im lặng loại mọi thẻ kiếm nó — hoặc phải tự bịa một giá trị, tức
  // logic nghiệp vụ rơi ra khỏi dữ liệu vào code.
  const programIdsWithValuation = new Set(
    data.programValuations.filter((row) => isActiveAt(row, asOf)).map((row) => row.programId as string),
  );
  for (const valuation of data.programValuations) {
    if (valuation.centsPerPoint <= 0) {
      issues.push({
        level: "error",
        entity: "program_valuations",
        message: `${valuation.id}: định giá phải dương`,
      });
    }
  }
  for (const program of data.pointsPrograms) {
    if (!programIdsWithValuation.has(program.id)) {
      issues.push({
        level: "error",
        entity: "program_valuations",
        message: `${program.slug}: không có định giá nào còn hiệu lực ${asOf}`,
      });
    }
  }
  checkRef(data.programValuations, "programId", (r: { programId: string }) => r.programId, programIds, "program_valuations", issues);

  // ---- Họ sản phẩm và thứ hạng -------------------------------------------
  const familyIds = new Set(data.productFamilies.map((row) => row.id as string));
  checkRef(data.products, "familyId", (r: { familyId: string | null }) => r.familyId, familyIds, "products", issues);
  checkRef(data.productFamilies, "issuerId", (r: { issuerId: string }) => r.issuerId, issuerIds, "product_families", issues);
  checkRef(data.productFamilies, "pointsProgramId", (r: { pointsProgramId: string | null }) => r.pointsProgramId, programIds, "product_families", issues);

  for (const product of data.products) {
    // `familyId` và `tierRank` đi cùng nhau: có họ mà không có hạng thì engine
    // biết hai thẻ là anh em nhưng không biết cái nào trên cái nào — tức không
    // nói được "đây là nâng hạng" hay "đây là hạ xuống cho vừa điều kiện".
    if (
      product.tierRank !== null &&
      (!Number.isInteger(product.tierRank) || product.tierRank < 1)
    ) {
      issues.push({
        level: "error",
        entity: "products",
        message: `${product.slug}: tierRank phải là số nguyên ≥ 1, đang là ${product.tierRank}`,
      });
    }
    if ((product.familyId === null) !== (product.tierRank === null)) {
      issues.push({
        level: "error",
        entity: "products",
        message: `${product.slug}: familyId và tierRank phải cùng có hoặc cùng vắng`,
      });
    }
  }
  const tiersByFamily = new Map<string, Map<number, string>>();
  for (const product of data.products) {
    if (product.familyId === null || product.tierRank === null) continue;
    const seen = tiersByFamily.get(product.familyId) ?? new Map<number, string>();
    const clash = seen.get(product.tierRank);
    if (clash !== undefined) {
      issues.push({
        level: "error",
        entity: "products",
        message: `${product.slug}: trùng tierRank ${product.tierRank} với ${clash} trong cùng họ`,
      });
    }
    seen.set(product.tierRank, product.slug);
    tiersByFamily.set(product.familyId, seen);
  }
  for (const family of data.productFamilies) {
    const members = data.products.filter((p) => p.familyId === family.id);
    // Một họ trải trên hai nhà phát hành là dấu hiệu ai đó dùng lại nhãn họ
    // cho một thẻ khác — và hậu quả im lặng: `productsByFamily` gom chúng lại
    // như các hạng thay thế nhau, rồi engine giấu đi một lựa chọn hợp lệ.
    for (const member of members) {
      if (member.issuerId !== family.issuerId) {
        issues.push({
          level: "error",
          entity: "product_families",
          message: `${family.id}: ${member.slug} thuộc nhà phát hành khác với họ`,
        });
      }
    }
    // Một họ chỉ có một thành viên là một họ vô nghĩa — và nó gợi ý sai rằng
    // có hạng khác để tụt xuống.
    if (members.length < 2) {
      issues.push({
        level: "warning",
        entity: "product_families",
        message: `${family.id}: chỉ có ${members.length} thành viên`,
      });
    }
  }

  // ---- Sản phẩm kế nhiệm --------------------------------------------------
  for (const product of data.products) {
    if (product.supersededByProductId === null) continue;
    if (product.supersededByProductId === product.id) {
      issues.push({
        level: "error",
        entity: "products",
        message: `${product.slug}: tự trỏ vào chính mình làm sản phẩm kế nhiệm`,
      });
      continue;
    }
    // Vòng lặp kế nhiệm treo mọi phép duyệt chuỗi của Phase 3/4.
    const seen = new Set<string>([product.id]);
    let cursor = productById.get(product.supersededByProductId);
    while (cursor !== undefined && cursor.supersededByProductId !== null) {
      if (seen.has(cursor.id)) {
        issues.push({
          level: "error",
          entity: "products",
          message: `${product.slug}: chuỗi sản phẩm kế nhiệm có vòng lặp`,
        });
        break;
      }
      seen.add(cursor.id);
      cursor = productById.get(cursor.supersededByProductId);
    }
    // Sản phẩm còn mở cho người nộp đơn mới mà đã có kẻ kế nhiệm là mâu thuẫn.
    if (product.availableTo === null) {
      issues.push({
        level: "warning",
        entity: "products",
        message: `${product.slug}: còn mở cho người nộp đơn mới nhưng đã khai sản phẩm kế nhiệm`,
      });
    }
  }

  // ---- Thẻ hết khả dụng thì OFFER phải đóng ------------------------------
  //
  // Nhưng CHỈ offer. Tỷ lệ tích điểm và quyền lợi vẫn chạy cho người đang giữ
  // thẻ, nên đòi chúng đóng theo là buộc dữ liệu nói dối: nó sẽ khai rằng một
  // thẻ trong ví người dùng không kiếm được điểm nào. Đây là chỗ bản trước gộp
  // "ngừng phát hành" với "hết tồn tại" và làm sai cả hai.
  const unavailable = new Map(
    data.products
      .filter((p) => p.availableTo !== null && p.availableTo < asOf)
      .map((p) => [p.id as string, p]),
  );
  for (const offer of data.offers) {
    const product = unavailable.get(offer.productId);
    if (product === undefined) continue;
    if (offer.effectiveTo === null) {
      issues.push({
        level: "error",
        entity: "offers",
        message:
          `${offer.id}: thẻ ${product.slug} không còn mở cho người nộp đơn mới ` +
          `(availableTo ${product.availableTo}) nhưng offer vẫn chưa đóng`,
      });
    }
  }

  // ---- Welcome bonus: kiểu thưởng phải khớp dữ liệu -----------------------
  for (const offer of data.offers) {
    if (offer.bonusKind === "points" && offer.bonusCurrencyId === null) {
      issues.push({
        level: "error",
        entity: "offers",
        message: `${offer.id}: bonusKind là points nhưng không có bonusCurrencyId`,
      });
    }
    if (offer.bonusKind !== "points" && offer.bonusCurrencyId !== null) {
      issues.push({
        level: "error",
        entity: "offers",
        message: `${offer.id}: bonusKind là ${offer.bonusKind} nhưng vẫn có bonusCurrencyId`,
      });
    }
    if (offer.bonusKind === "none" && offer.headlineBonus !== null) {
      issues.push({
        level: "error",
        entity: "offers",
        message: `${offer.id}: bonusKind là none nhưng vẫn có headlineBonus`,
      });
    }
  }

  // ---- Hai trục thời gian phải nhất quán ---------------------------------
  //
  // `recordedAt` là ngày bản ghi được ĐƯA VÀO kho. Nó có thể SAU
  // `effectiveFrom` (đính chính lùi ngày — chuyện thường), nhưng không thể
  // trước: một bản ghi không thể được nhập trước khi nó tồn tại.
  for (const [entity, rows] of [
    ["offers", data.offers],
    ["product_fees", data.productFees],
    ["earning_rates", data.earningRates],
    ["earning_caps", data.earningCaps],
    ["product_benefits", data.productBenefits],
    ["eligibility_rules", data.eligibilityRules],
    ["transfer_paths", data.transferPaths],
    ["award_strategies", data.awardStrategies],
    ["program_valuations", data.programValuations],
  ] as const) {
    for (const row of rows) {
      if (!isRealDate(row.recordedAt)) {
        issues.push({
          level: "error",
          entity,
          message: `${row.id}: recordedAt "${row.recordedAt}" không phải một ngày có thật`,
        });
        continue;
      }
    }
  }

  // ---- Chương trình khai chuyển được nhưng không có chặng nào -------------
  //
  // Portfolio Analyzer đọc `transferable` để quyết định có đi tìm "số dư tiếp
  // cận được" hay không (spec §7). Khai `true` mà không có chặng nào nghĩa là
  // nó đi tìm rồi về tay không — và không có gì nói cho người đọc code biết đó
  // là CỐ Ý (chưa mô hình hoá) hay là dữ liệu thiếu.
  // Lọc theo `asOf`: chặng đã đóng hoặc chưa mở KHÔNG tính là "có đường đi".
  // Không lọc thì một chương trình chỉ còn chặng hết hạn vẫn im lặng qua được,
  // trong khi `datasetAt` không đưa cho Portfolio Analyzer đích nào.
  const sourcesWithPaths = new Set(
    data.transferPaths.filter((row) => isActiveAt(row, asOf)).map((row) => row.sourceProgramId as string),
  );
  for (const program of data.pointsPrograms) {
    if (!program.transferable || sourcesWithPaths.has(program.id)) continue;
    issues.push({
      level: "warning",
      entity: "points_programs",
      message:
        `${program.slug}: transferable=true nhưng chưa có chặng chuyển nào — ` +
        `Portfolio Analyzer sẽ coi số dư này không với tới đâu`,
    });
  }

  // ---- Chặng chuyển: hạng yêu cầu phải máy đọc được ----------------------
  //
  // Chặng nào nêu điều kiện bằng CHỮ mà không có `requiresTier` thì Phase 3
  // không đọc nổi — nó sẽ cộng chặng đó vào "số dư tiếp cận được" cho mọi
  // người, kể cả người không đủ hạng, rồi hứa một chuyến bay họ không đặt được.
  for (const path of data.transferPaths) {
    if (path.conditionText === null || path.requiresTier !== null) continue;
    // Chỉ soi cách nói HẠN CHẾ. "Mọi hạng Avion®" cũng nhắc tới hạng nhưng nói
    // điều ngược lại — không hạn chế gì — nên `requiresTier: null` ở đó là
    // đúng, và cảnh báo nó là dạy người đọc bỏ qua cảnh báo.
    // Ranh giới theo CHỮ CÁI Unicode, không theo `\b` cũng không theo khoảng
    // trắng. `\b` dựa trên bảng ASCII nên "Chỉ Avion®" không khớp — cả "ỉ" lẫn
    // khoảng trắng sau đều là ký tự không-từ. Còn neo bằng khoảng trắng thì
    // "(Chỉ Avion® Elite)" và "Only: Avion Elite" lại trượt vì dấu câu dính
    // liền. `\p{L}` với cờ `u` là thứ duy nhất đúng cho cả ba.
    if (/(?<!\p{L})(chỉ|only|requires?)(?!\p{L})/iu.test(path.conditionText)) {
      issues.push({
        level: "warning",
        entity: "transfer_paths",
        message:
          `${path.id}: conditionText nhắc tới hạng ("${path.conditionText}") nhưng ` +
          `requiresTier để trống — Phase 3 sẽ coi chặng này ai cũng dùng được`,
      });
    }
  }

  // ---- Độ tươi của dữ liệu ------------------------------------------------
  //
  // `confidence: "stale"` tồn tại trong kiểu từ đầu nhưng CHƯA AI sinh ra nó —
  // tức một trạng thái được khai báo mà không bao giờ xảy ra, và Phase 3 sẽ
  // học rằng nó không cần xử lý. Phép kiểm này làm nó có thật.
  //
  // Ngưỡng theo LOẠI dữ liệu, vì chúng mục với tốc độ khác nhau: welcome offer
  // đổi hằng tháng, còn tỷ lệ tích điểm và quyền lợi thì hằng năm.
  for (const [entity, rows, maxAgeDays] of [
    ["offers", data.offers, 120],
    ["product_fees", data.productFees, 365],
    ["earning_rates", data.earningRates, 365],
    ["product_benefits", data.productBenefits, 365],
    ["eligibility_rules", data.eligibilityRules, 365],
    ["transfer_paths", data.transferPaths, 180],
    ["award_strategies", data.awardStrategies, 180],
    // Định giá điểm mục chậm nhưng mục THẬT — mỗi lần devalue là một lần nó
    // sai, và nó nhân vào mọi điểm số.
    ["program_valuations", data.programValuations, 365],
  ] as const) {
    for (const row of rows) {
      // Chỉ soi bản ghi CÒN HIỆU LỰC TẠI `asOf`. Bản trước bỏ qua mọi dòng có
      // `effectiveTo`, kể cả khi ngày đó nằm ở TƯƠNG LAI — nên một offer dài
      // hạn có hạn kết thúc rõ ràng sẽ không bao giờ bị nhắc kiểm lại, dù nó đã
      // cũ hàng năm.
      if (!isActiveAt(row, asOf)) continue;
      if (row.confidence === "stale") continue;
      if (daysBetween(row.verifiedAt, asOf) > maxAgeDays) {
        issues.push({
          level: "warning",
          entity,
          message:
            `${row.id}: kiểm lần cuối ${row.verifiedAt}, quá ${maxAgeDays} ngày — ` +
            `kiểm lại hoặc đánh dấu confidence: "stale"`,
        });
      }
    }
  }

  // ---- Thành phần offer ---------------------------------------------------
  const seenSequence = new Set<string>();
  for (const component of data.offerComponents) {
    if (component.sequence < 1) {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${component.id}: sequence phải bắt đầu từ 1`,
      });
    }
    const seqKey = `${component.offerId}|${component.sequence}`;
    if (seenSequence.has(seqKey)) {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${component.id}: trùng sequence ${component.sequence} trong cùng một offer`,
      });
    }
    seenSequence.add(seqKey);

    // Một thành phần trả điểm HOẶC trả tiền, không phải cả hai — hai đơn vị
    // khác nhau trong một dòng thì mọi phép cộng phía sau phải đoán xem cộng
    // cái nào.
    if ((component.pointsAmount ?? 0) > 0 && (component.cashAmount ?? 0) > 0) {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${component.id}: vừa trả điểm vừa trả tiền trong một thành phần`,
      });
    }
    for (const [field, value] of [
      ["pointsAmount", component.pointsAmount],
      ["cashAmount", component.cashAmount],
      ["spendRequirement", component.spendRequirement],
      ["spendWindowDays", component.spendWindowDays],
      ["repeatCount", component.repeatCount],
    ] as const) {
      if (value !== null && value <= 0) {
        issues.push({
          level: "error",
          entity: "offer_components",
          message: `${component.id}: ${field} phải dương, đang là ${value}`,
        });
      }
    }
    if (component.windowStartsAfterDays < 0) {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${component.id}: windowStartsAfterDays âm`,
      });
    }
    // `repeatCount` chỉ có nghĩa với `monthly_spend`; ở chỗ khác nó lặng lẽ
    // nhân số điểm lên trong `totalSpendOf` và mọi phép cộng phía sau.
    if (component.repeatCount !== null && component.componentType !== "monthly_spend") {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${component.id}: repeatCount chỉ dùng cho monthly_spend`,
      });
    }
  }

  // Sản phẩm chưa có offer nào: không nhất thiết sai (thẻ không có welcome
  // bonus là chuyện có thật), nhưng phải thấy được.
  const productsWithOffer = new Set(data.offers.map((o) => o.productId as string));
  for (const product of data.products) {
    if (!isActiveAt(product, asOf)) continue;
    if (!productsWithOffer.has(product.id)) {
      issues.push({
        level: "warning",
        entity: "offers",
        message: `${product.slug}: chưa có offer nào`,
      });
    }
  }

  // Chương trình bay không có bảng giá và cũng không khai là không quote được:
  // Phase 3 sẽ im lặng bỏ qua nó, và người đọc không bao giờ biết vì sao.
  const withStrategy = new Set(data.awardStrategies.map((s) => s.programId as string));
  const declaredUnquotable = new Set(UNQUOTABLE_AWARD_PROGRAMS.map((p) => p.programId));
  for (const program of data.pointsPrograms) {
    if (program.programType !== "airline") continue;
    if (withStrategy.has(program.id) || declaredUnquotable.has(program.id)) continue;
    issues.push({
      level: "warning",
      entity: "award_strategies",
      message: `${program.slug}: chương trình hàng không chưa có award strategy và cũng chưa khai là không quote được`,
    });
  }

  // Sản phẩm chưa có điều kiện mở thẻ nào.
  const withEligibility = new Set(data.eligibilityRules.map((r) => r.productId as string));
  for (const product of data.products) {
    if (!isActiveAt(product, asOf)) continue;
    if (!withEligibility.has(product.id)) {
      issues.push({
        level: "warning",
        entity: "eligibility_rules",
        message: `${product.slug}: chưa có điều kiện mở thẻ nào`,
      });
    }
  }

  return issues;
}
