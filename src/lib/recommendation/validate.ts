import { INCOMPLETE_OFFERS, UNQUOTABLE_AWARD_PROGRAMS } from "./data";
import type { RecommendationDataset, Temporal } from "./types";

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
    if (row.effectiveTo !== null && row.effectiveTo < row.effectiveFrom) {
      issues.push({
        level: "error",
        entity,
        message: `${row.id}: effectiveTo (${row.effectiveTo}) trước effectiveFrom (${row.effectiveFrom})`,
      });
    }
  }
}

export function validateDataset(data: RecommendationDataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const issuerIds = new Set(data.issuers.map((r) => r.id));
  const programIds = new Set(data.pointsPrograms.map((r) => r.id));
  const productIds = new Set(data.products.map((r) => r.id));
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

  checkRef(data.products, "issuerId", (r: { issuerId: string }) => r.issuerId, issuerIds, "products", issues);
  checkRef(data.products, "pointsProgramId", (r: { pointsProgramId: string | null }) => r.pointsProgramId, programIds, "products", issues);
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
  const unrestricted = new Map<string, number>();
  const restrictedOnly = new Map<string, boolean>();
  for (const rate of data.earningRates) {
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

  // Mỗi sản phẩm chỉ được có MỘT offer đang chạy tại một thời điểm. Hai cái
  // cùng lúc thì mọi phép tra "offer hiện tại" trả về cái nào tuỳ thứ tự khai.
  const today = new Date().toISOString().slice(0, 10);
  const liveByProduct = new Map<string, string[]>();
  for (const offer of data.offers) {
    if (offer.effectiveFrom > today) continue;
    if (offer.effectiveTo !== null && offer.effectiveTo < today) continue;
    const list = liveByProduct.get(offer.productId) ?? [];
    list.push(offer.id);
    liveByProduct.set(offer.productId, list);
  }
  for (const [productId, ids] of liveByProduct) {
    if (ids.length > 1) {
      issues.push({
        level: "error",
        entity: "offers",
        message: `${productId}: ${ids.length} offer cùng đang chạy (${ids.join(", ")})`,
      });
    }
  }

  // Trần phải đủ ba mảnh mới dùng được.
  for (const rate of data.earningRates) {
    const parts = [rate.capKind, rate.capAmount, rate.capPeriod].filter((p) => p !== null).length;
    if (parts !== 0 && parts !== 3) {
      issues.push({
        level: "error",
        entity: "earning_rates",
        message: `${rate.id}: trần khai thiếu — cần đủ capKind, capAmount và capPeriod`,
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
    data.earningRates
      .filter((r) => r.category === "everything_else" && r.restrictedTo === null)
      .map((r) => r.productId as string),
  );
  for (const product of data.products) {
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
  for (const offer of data.offers) {
    if (offer.headlineBonus === null) continue;
    const total = data.offerComponents
      .filter((c) => c.offerId === offer.id)
      .reduce((sum, c) => sum + (c.pointsAmount ?? 0) * (c.repeatCount ?? 1), 0);
    if (total > offer.headlineBonus) {
      issues.push({
        level: "error",
        entity: "offer_components",
        message: `${offer.id}: component cộng lại ${total} điểm, vượt headlineBonus ${offer.headlineBonus}`,
      });
    }
  }

  // Sản phẩm chưa có offer nào: không nhất thiết sai (thẻ không có welcome
  // bonus là chuyện có thật), nhưng phải thấy được.
  const productsWithOffer = new Set(data.offers.map((o) => o.productId as string));
  for (const product of data.products) {
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
