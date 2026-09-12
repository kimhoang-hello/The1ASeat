/**
 * §20 `derived_state` — biến những gì engine TÍNH RA thành dữ liệu lưu được.
 *
 * Không có một quyết định nào ở đây. Mọi con số trong file này đã được tầng
 * sinh ra nó tính xong; việc duy nhất là đổi hình dạng — `Map` thành danh
 * sách đã sắp, sản phẩm thành id, offer thành id kèm bản ghi nguồn — để nó đi
 * qua JSON nguyên vẹn và đọc lại được sau nhiều tháng.
 *
 * Vì sao phải kỹ tới vậy: `JSON.stringify(new Map(...))` là `{}`. Không lỗi,
 * không cảnh báo — lượt chạy lưu lại chỉ đơn giản MẤT phần giải thích, và
 * người phát hiện ra là admin đang cần nó nhất. `runs.test.ts` đòi mọi lượt
 * chạy đi qua JSON rồi quay về y nguyên.
 */

import type { Product, ProductId } from "./types.ts";
import type { CandidateFacts } from "./scoring/context.ts";
import type {
  Candidate,
  CandidateFactsSnapshot,
  CandidateVisibility,
  ExcludedProduct,
  Needs,
  NeedsSnapshot,
  PortfolioAnalysis,
  PortfolioSnapshot,
  RankedCandidate,
  UniverseExclusionReason,
} from "./engine-types.ts";

/** Sắp một bảng số theo giá trị giảm dần, hoà thì theo khoá — thứ tự cố định. */
function byValueThenKey<T>(rows: T[], value: (row: T) => number, key: (row: T) => string): T[] {
  return rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (vb !== va) return vb - va;
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function snapshotPortfolio(portfolio: PortfolioAnalysis): PortfolioSnapshot {
  return {
    direct: [...portfolio.direct]
      .map(([programId, knowledge]) => ({ programId, knowledge }))
      .sort((a, b) => (a.programId < b.programId ? -1 : 1)),
    knownValueCents: portfolio.knownValueCents,
    hasUnknownBalance: portfolio.hasUnknownBalance,
    balancesUndeclared: portfolio.balancesUndeclared,
    cardsUndeclared: portfolio.cardsUndeclared,
    concentration: portfolio.concentration.map((row) => ({ ...row })),
    flexibilityScore: portfolio.flexibilityScore,
    earnedPrograms: [...portfolio.earnedPrograms].sort(),
    heldProductIds: portfolio.heldProducts.map((product) => product.id).sort(),
  };
}

export function snapshotNeeds(needs: Needs): NeedsSnapshot {
  return {
    currency: byValueThenKey(
      [...needs.currency].map(([programId, need]) => ({ programId, need })),
      (row) => row.need,
      (row) => row.programId,
    ),
    benefit: byValueThenKey(
      [...needs.benefit].map(([benefitId, need]) => ({ benefitId, need })),
      (row) => row.need,
      (row) => row.benefitId,
    ),
    portfolio: { ...needs.portfolio },
    action: { ...needs.action },
  };
}

export function snapshotFacts(facts: CandidateFacts, selectable: boolean): CandidateFactsSnapshot {
  const { active, ...offer } = facts.offer;
  return {
    productId: facts.product.id,
    productSlug: facts.product.slug,
    productName: facts.product.name,
    selectable,
    offer: {
      ...offer,
      activeOfferId: active === null ? null : (active.offer.id as string),
      componentIds: active === null ? [] : active.components.map((row) => row.id as string),
    },
    earn: { ...facts.earn, programs: [...facts.earn.programs] },
    benefits: { ...facts.benefits },
    travelBenefitCount: facts.travelBenefitCount,
    eligibility: facts.eligibility,
    suitability: facts.suitability,
  };
}

/**
 * Mọi sản phẩm KHÔNG được chấm điểm, theo thứ tự các cửa chặn chúng.
 *
 * Suitability đứng TRƯỚC eligibility vì `engine.ts` lọc theo đúng thứ tự đó,
 * và một thẻ doanh nghiệp người dùng đã từ chối thì câu trả lời đúng cho "vì
 * sao không thấy nó" là "vì bạn đã nói không" — không phải "vì bạn không có
 * doanh nghiệp", dù cả hai cùng đúng.
 */
export function excludedProducts(
  universeExclusions: readonly { product: Product; reason: UniverseExclusionReason }[],
  facts: readonly CandidateFacts[],
): ExcludedProduct[] {
  const rows: ExcludedProduct[] = universeExclusions.map(({ product, reason }) => ({
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    stage: "universe",
    reason,
    failedRuleIds: [],
  }));
  for (const row of facts) {
    if (row.suitability.excluded) {
      rows.push({
        productId: row.product.id,
        productSlug: row.product.slug,
        productName: row.product.name,
        stage: "suitability",
        reason: row.suitability.excludedReason ?? "excluded",
        failedRuleIds: [],
      });
    } else if (row.eligibility.status === "ineligible") {
      rows.push({
        productId: row.product.id,
        productSlug: row.product.slug,
        productName: row.product.name,
        stage: "eligibility",
        reason: "ineligible",
        failedRuleIds: [...row.eligibility.failedRuleIds],
      });
    }
  }
  return rows.sort((a, b) => (a.productId < b.productId ? -1 : 1));
}

/**
 * Bảng xếp hạng đầy đủ, mỗi dòng biết mình có hiện ra không.
 *
 * `hidden` đến thẳng từ phép gom họ thẻ của engine — không đoán lại ở đây.
 */
export function rankingTrace(
  ranked: readonly Candidate[],
  winner: Candidate,
  alternatives: readonly Candidate[],
  hidden: ReadonlyMap<Candidate, ProductId>,
): RankedCandidate[] {
  const shown = new Set<Candidate>(alternatives);
  return ranked.map((candidate, index) => {
    let visibility: CandidateVisibility;
    if (candidate === winner) visibility = "primary";
    else if (candidate.kind === "no_new_card") visibility = "no_action";
    else if (shown.has(candidate)) visibility = "alternative";
    else if (hidden.has(candidate)) visibility = "hidden_same_family";
    else visibility = "hidden_beyond_cutoff";
    return {
      rank: index + 1,
      visibility,
      hiddenBy: visibility === "hidden_same_family" ? (hidden.get(candidate) ?? null) : null,
      candidate,
    };
  });
}
