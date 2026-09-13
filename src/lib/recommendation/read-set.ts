/**
 * Lượt chạy này ĐÃ ĐỌC những dòng dữ liệu nào — MỘT câu trả lời cho mọi chỗ
 * cần biết.
 *
 * §29 hạ độ tin cậy vì dữ liệu cũ (độ tươi) và vì dữ liệu thiếu (độ đầy đủ),
 * và cả hai chỉ đúng khi chúng đo trên đúng thứ engine đã đọc. Năm vòng review
 * liên tiếp (Codex 9–12) mỗi vòng tìm ra một chỗ hai phép đo này lệch khỏi
 * phép tính thật, theo cả hai hướng:
 *
 *   thiếu — trần tích điểm, tỷ lệ của thẻ ĐANG GIỮ: được đọc, không được đo;
 *   thừa  — định giá của chương trình không ai giữ, offer của thẻ người dùng
 *           đã từ chối, tỷ lệ tích điểm mà chuyến đi đã định giá không đọc:
 *           không được đọc, vẫn trừ độ tin cậy.
 *
 * Mỗi lần vá ở MỘT chỗ thì chỗ kia vẫn trả lời câu hỏi theo cách cũ. File này
 * là chỗ duy nhất trả lời nó; `engine.ts` chỉ gọi.
 *
 * Tập sản phẩm, theo đúng cách engine dùng chúng:
 *
 *   `gated`  — tập ứng viên: luật điều kiện của MỌI thẻ được đánh giá để quyết
 *              định cửa (một luật sai loại oan một thẻ, dù thẻ đó không được
 *              chấm điểm).
 *   `scored` — thẻ CHỌN ĐƯỢC: offer, phí, quyền lợi, tỷ lệ tích điểm của chúng
 *              đi vào điểm số và thang đo chung.
 *   `held`   — thẻ ĐANG GIỮ: quyền lợi (quyền lợi trùng, §16 Rule 6) và tỷ lệ
 *              tích điểm (`walletEarnCoverage` của `NO_NEW_CARD`). Không offer,
 *              không phí, không điều kiện.
 */

import { activeAt } from "./temporal.ts";
import { activeOfferFor } from "./offer-quality.ts";
import { isOpenToEveryone } from "./portfolio.ts";
import { tripCoverage } from "./strategies.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { AwardStrategy, DataGap, Product, RecommendationDataset } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { GoalContext, OldestVerified } from "./engine-types.ts";

/**
 * Điểm số của mục tiêu này có đọc tỷ lệ tích điểm không.
 *
 * Ba bảng §10 đọc (thẻ tiếp theo, tích điểm, đa dạng hoá); bảng chuyến đi thì
 * KHÔNG — trừ khi chặng chưa tính được tỷ lệ phủ, vì khi đó `NO_NEW_CARD` rơi
 * về so tích điểm của ví với thẻ mới (`walletEarnCoverage` ở `rank.ts`).
 */
export function goalReadsEarn(goal: GoalContext, state: UserState, ix: DatasetIndex, asOf: string): boolean {
  return goal.goal.type !== "trip" || tripCoverage(state, ix, asOf, goal.tripNeed).coverage === null;
}

export interface ReadSet {
  gated: ReadonlySet<string>;
  scored: ReadonlySet<string>;
  held: ReadonlySet<string>;
  readsEarn: boolean;
  /** Chương trình người dùng có dòng số dư khác 0 — portfolio và phép phủ đọc chúng. */
  balancePrograms: ReadonlySet<string>;
  /** Award strategy của CHẶNG đang hỏi, đúng những dòng `tripNeed` đã đọc. */
  awardStrategies: readonly AwardStrategy[];
}

export function buildReadSet(input: {
  universe: readonly Product[];
  scored: readonly Product[];
  held: readonly Product[];
  readsEarn: boolean;
  balancePrograms: Iterable<string>;
  awardStrategies: readonly AwardStrategy[];
}): ReadSet {
  return {
    gated: new Set(input.universe.map((product) => product.id as string)),
    scored: new Set(input.scored.map((product) => product.id as string)),
    held: new Set(input.held.map((product) => product.id as string)),
    readsEarn: input.readsEarn,
    balancePrograms: new Set(input.balancePrograms),
    awardStrategies: input.awardStrategies,
  };
}

/**
 * `subjectId` của chỗ trống thuộc về một trong các sản phẩm này — chính sản
 * phẩm, hoặc một offer của nó. So bằng ĐƯỜNG BIÊN, không bằng `includes` trần:
 * `prd_amex-aeroplan` là chuỗi con của `prd_amex-aeroplan-reserve`, nên phép so
 * lỏng gán chỗ trống của thẻ này cho thẻ kia.
 */
export function touchesAny(productIds: Iterable<string>, subjectId: string): boolean {
  for (const productId of productIds) {
    if (
      subjectId === productId ||
      subjectId.startsWith(`${productId}_`) ||
      subjectId.includes(`_${productId}_`)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Chỗ trống THEO SẢN PHẨM mà lượt chạy thật sự đọc. Các loại khác (chặng,
 * chương trình) đã được `normalize.ts` lọc theo mục tiêu và đi qua nguyên.
 */
export function scopeDataGaps(gaps: readonly DataGap[], read: ReadSet): DataGap[] {
  return gaps.filter((gap) => {
    switch (gap.kind) {
      case "eligibility_unknown":
        return touchesAny(read.gated, gap.subjectId);
      case "offer_terms_unknown":
        return touchesAny(read.scored, gap.subjectId);
      case "base_earn_rate_unknown":
        return read.readsEarn && touchesAny([...read.scored, ...read.held], gap.subjectId);
      default:
        return true;
    }
  });
}

/**
 * Bản ghi có `verifiedAt` cũ nhất trong ĐÚNG những gì lượt chạy đọc (§29 độ
 * tươi) — trả về cả dòng, để "độ tin cậy thấp vì dữ kiện cũ" nói được dữ kiện
 * NÀO. Hoà ngày thì giữ dòng gặp trước; thứ tự quét cố định.
 */
export function oldestVerified(
  read: ReadSet,
  data: RecommendationDataset,
  ix: DatasetIndex,
  asOf: string,
): OldestVerified | null {
  let oldest: OldestVerified | null = null;
  const consider = (table: string, row: { id: string; verifiedAt?: string }) => {
    if (row.verifiedAt === undefined) return;
    if (oldest === null || row.verifiedAt < oldest.verifiedAt) {
      oldest = { table, id: row.id, verifiedAt: row.verifiedAt };
    }
  };
  const sorted = (ids: ReadonlySet<string>) => [...ids].sort();

  /** Chương trình có điểm số của lượt chạy phụ thuộc — cho định giá và chặng chuyển. */
  const programs = new Set<string>(read.balancePrograms);
  const earnProducts = read.readsEarn ? [...read.scored, ...read.held] : [];

  for (const productId of sorted(read.gated)) {
    for (const row of activeAt(ix.rulesByProduct.get(productId) ?? [], asOf)) consider("eligibility_rules", row);
  }
  for (const productId of sorted(read.scored)) {
    // CÙNG phép chọn offer với `offerFacts` — không phải mọi offer đang hiệu lực.
    const active = activeOfferFor(ix, productId, asOf);
    if (active !== null) {
      consider("offers", active.offer);
      if (active.offer.bonusCurrencyId !== null) programs.add(active.offer.bonusCurrencyId as string);
    }
    for (const row of activeAt(ix.feesByProduct.get(productId) ?? [], asOf)) consider("product_fees", row);
    const product = ix.productById.get(productId as never);
    if (product?.pointsProgramId != null) programs.add(product.pointsProgramId as string);
  }
  for (const productId of [...new Set([...read.scored, ...read.held])].sort()) {
    for (const row of activeAt(ix.benefitsByProduct.get(productId) ?? [], asOf)) consider("product_benefits", row);
  }
  for (const productId of sorted(read.held)) {
    const product = ix.productById.get(productId as never);
    if (product?.pointsProgramId != null) programs.add(product.pointsProgramId as string);
  }
  const caps = new Set<string>();
  for (const productId of [...new Set(earnProducts)].sort()) {
    for (const row of activeAt(ix.ratesByProduct.get(productId) ?? [], asOf)) {
      consider("earning_rates", row);
      programs.add(row.pointsProgramId as string);
      if (row.capId !== null) caps.add(row.capId as string);
    }
  }
  // Trần tích điểm mà các tỷ lệ ĐÃ ĐỌC trỏ vào — `earnFitFor` đọc chúng qua
  // `capId`, và một trần sai đổi điểm y như một tỷ lệ sai.
  for (const capId of [...caps].sort()) {
    const cap = ix.capById.get(capId);
    if (cap !== undefined) consider("earning_caps", cap);
  }
  // Chặng chuyển KHÔNG đòi hạng thành viên, đi từ chương trình mà lượt chạy
  // đọc: số dư (phủ chuyến đi, danh mục), đồng tiền của thẻ chấm điểm và thẻ
  // đang giữ (bonus quy đổi, tầm với, `tripCurrencyCoverage`).
  for (const row of activeAt(data.transferPaths, asOf)) {
    if (isOpenToEveryone(row.requiresTier) && programs.has(row.sourceProgramId as string)) {
      consider("transfer_paths", row);
    }
  }
  // Định giá CHỈ của chương trình có mặt trong phép tính — không cả bảng: một
  // định giá AAdvantage® cũ không làm kém tươi một lượt chạy không có đồng
  // AAdvantage® nào (vòng Codex 12).
  for (const row of activeAt(data.programValuations, asOf)) {
    if (programs.has(row.programId as string)) consider("program_valuations", row);
  }
  for (const strategy of read.awardStrategies) consider("award_strategies", strategy);
  return oldest;
}
