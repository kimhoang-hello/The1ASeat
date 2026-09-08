/**
 * Dây chuyền của Phase 3, và KHÔNG có gì khác.
 *
 * ```
 * User State → Goal → Portfolio → Strategies → Needs → Eligibility/Suitability
 *            → Candidates → Intent Scoring → Rules → Ranking → Recommendation
 * ```
 *
 * §26 nói "đừng dựng một `recommendation.ts` khổng lồ", và file này giữ đúng
 * lời đó bằng cách KHÔNG chứa một quyết định nào: mọi phép đo, mọi ngưỡng, mọi
 * trọng số đều ở module của nó. Việc duy nhất ở đây là thứ tự — và thứ tự
 * chính là thứ spec đòi. Một dòng logic lọt vào đây là một dòng không có test
 * riêng và không có chỗ để giải thích.
 *
 * TẤT ĐỊNH. Cùng đầu vào + cùng version = cùng đầu ra (§35). Ba chỗ giữ lời
 * hứa đó: mọi phép sắp xếp đều có khoá phá hoà tường minh, `asOf` được truyền
 * xuống chứ không ai gọi `new Date()`, và không có `Math.random`, không có
 * `Date.now`, không có LLM.
 */

import { analyzePortfolio, topEcosystemShare } from "./portfolio.ts";
import { normalize } from "./normalize.ts";
import { generateStrategies } from "./strategies.ts";
import { bestAccessibleFor, computeNeeds } from "./needs.ts";
import { evaluateEligibility } from "./eligibility.ts";
import { evaluateSuitability } from "./suitability.ts";
import { earnFitFor } from "./earn-fit.ts";
import { benefitFitFor, heldBenefitKeys } from "./benefit-fit.ts";
import { offerClimate, offerFacts } from "./offer-quality.ts";
import { activeAt } from "./temporal.ts";
import { assembleScore } from "./scoring/weights.ts";
import { buildScale } from "./scoring/context.ts";
import { scoreNextCard } from "./scoring/next-card.ts";
import { scoreTrip } from "./scoring/trip.ts";
import { scoreDiversify } from "./scoring/diversify.ts";
import { scoreEarning } from "./scoring/earning.ts";
import { applyRules } from "./rules.ts";
import { buildNoNewCardCandidate, finalScore, rankCandidates } from "./rank.ts";
import { computeConfidence } from "./confidence.ts";
import { mergeReasonCodes, mergeWarnings, nextQuestion } from "./explain.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { BenefitId, Product, RecommendationDataset } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { RecommendationDataSource } from "./source.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { CandidateFacts, ScoringContext } from "./scoring/context.ts";
import type {
  Candidate,
  GoalContext,
  Recommendation,
  RecommendationRun,
  ScoreComponent,
} from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/**
 * Version của engine, đi vào mọi lượt chạy.
 *
 * §20 (`recommendation_runs`) và tiêu chí "cùng đầu vào + CÙNG VERSION = cùng
 * đầu ra" đều dựa vào nó. Đổi bất kỳ trọng số, ngưỡng hay luật nào thì tăng
 * số này — nếu không, hai lượt chạy cho hai kết quả khác nhau sẽ trông như
 * một lỗi tất định thay vì như một lần đổi mô hình.
 */
export const ENGINE_VERSION = "3.0.0";

export interface RecommendInput {
  state: UserState;
  data: RecommendationDataset;
  ix: DatasetIndex;
  asOf: string;
  /** Lịch sử offer theo `productId`. Rỗng thì §12 trả `null`, không trả 0. */
  offerHistory?: ReadonlyMap<string, OfferHistoryPoint[]>;
}

/** Quyền lợi đi lại thẻ này THÊM vào — §10.2 dành 5% cho chúng. */
function travelBenefitCount(
  productId: string,
  held: ReadonlySet<string>,
  ix: DatasetIndex,
  asOf: string,
): number {
  let count = 0;
  for (const row of activeAt(ix.benefitsByProduct.get(productId) ?? [], asOf)) {
    const benefit = ix.benefitById.get(row.benefitId as BenefitId);
    if (benefit === undefined) continue;
    if (benefit.category !== "airline" && benefit.category !== "airport") continue;
    const key = `${row.benefitId}|${row.provider ?? ""}`;
    if (held.has(key) && benefit.duplicatesAcrossCards) continue;
    count += 1;
  }
  return count;
}

/** Ngày kiểm lại cũ nhất trong các bản ghi lượt chạy này dựa vào (§29 độ tươi). */
function oldestVerifiedAt(
  products: readonly Product[],
  ix: DatasetIndex,
  asOf: string,
): string | null {
  let oldest: string | null = null;
  const consider = (day: string | undefined) => {
    if (day === undefined) return;
    if (oldest === null || day < oldest) oldest = day;
  };
  for (const product of products) {
    for (const row of activeAt(ix.offersByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
    for (const row of activeAt(ix.feesByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
  }
  return oldest;
}

function scoreFor(
  goal: GoalContext,
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  // §10: bốn ý định, BỐN hàm. Không có nhánh mặc định — thêm một `GoalType`
  // vào Phase 2 mà quên hàm chấm điểm ở đây là lỗi biên dịch, không phải một
  // khuyến nghị lặng lẽ chạy bằng bảng trọng số của ý định khác.
  switch (goal.goal.type) {
    case "trip":
      return scoreTrip(candidate, ctx);
    case "diversify":
      return scoreDiversify(candidate, ctx);
    case "earn_points":
      return scoreEarning(candidate, ctx);
    case "next_card":
      return scoreNextCard(candidate, ctx);
  }
}

/**
 * Chạy engine.
 *
 * `offerHistory` là tuỳ chọn vì nó bất đồng bộ và đến từ một file khác — xem
 * `recommendFromSource` bên dưới. Vắng nó thì §12 trả `null` (chưa biết
 * percentile), KHÔNG trả 0: "chưa theo dõi đủ lâu" và "mức thấp nhất từng
 * thấy" là hai câu khác nhau, và câu thứ hai thì sai.
 */
export function recommend(input: RecommendInput): RecommendationRun {
  const { state, data, ix, asOf } = input;
  const history = input.offerHistory ?? new Map<string, OfferHistoryPoint[]>();
  const normalized = normalize(state, data, ix, asOf);

  const runReasons: ReasonCode[] = [];
  const runWarnings: WarningCode[] = [];
  if (normalized.goalResolution === "none") runReasons.push("GOAL_MISSING");
  if (normalized.goalResolution === "ambiguous") runReasons.push("GOAL_AMBIGUOUS");

  const portfolio = analyzePortfolio(state, ix, asOf);
  if (portfolio.balancesUndeclared) runWarnings.push("BALANCES_UNDECLARED");
  if (portfolio.cardsUndeclared) runWarnings.push("CARDS_UNDECLARED");

  const capacity = state.spend?.minimumSpendCapacity3m ?? null;
  const heldKeys = heldBenefitKeys(portfolio.heldProducts, ix, asOf);

  /* ---- Dữ kiện từng ứng viên (không phụ thuộc mục tiêu) ------------ */
  const facts: CandidateFacts[] = normalized.universe.map((product) => {
    const offer = offerFacts(product, ix, asOf, capacity, history.get(product.id) ?? []);
    return {
      product,
      offer,
      earn: earnFitFor(product.id, state.spend, ix, asOf),
      benefits: benefitFitFor(product.id, heldKeys, ix, asOf),
      eligibility: evaluateEligibility(product.id, state, ix, asOf),
      suitability: evaluateSuitability({
        product,
        state,
        facts: offer,
        capacity,
        ix,
        asOf,
        heldProducts: portfolio.heldProducts,
      }),
      travelBenefitCount: travelBenefitCount(product.id, heldKeys, ix, asOf),
    };
  });

  const climate = offerClimate(facts.map((row) => row.offer));
  const scale = buildScale(facts);
  const scorable = facts.filter((row) => !row.suitability.excluded);

  const results: Recommendation[] = normalized.goals.map((goal) => {
    const strategies = generateStrategies({ state, ix, asOf, portfolio, goal, climate });
    const needs = computeNeeds({ state, data, ix, asOf, portfolio, goal, strategies });
    const ctx: ScoringContext = { state, ix, asOf, needs, portfolio, goal, climate, scale };

    const cardCandidates: Candidate[] = scorable.map((candidate) => {
      const components = scoreFor(goal, candidate, ctx);
      const baseScore = assembleScore(components);
      const ruled = applyRules({ candidate, ctx, baseScore });
      return {
        kind: "open_card" as const,
        productId: candidate.product.id,
        productSlug: candidate.product.slug,
        productName: candidate.product.name,
        score: finalScore(baseScore, ruled.adjustments),
        baseScore,
        components,
        adjustments: ruled.adjustments,
        reasonCodes: mergeReasonCodes(
          ruled.reasonCodes,
          candidate.eligibility.reasonCodes,
          candidate.suitability.reasonCodes,
          candidate.offer.reasonCodes,
          candidate.benefits.reasonCodes,
        ),
        warnings: mergeWarnings(
          ruled.warnings,
          candidate.eligibility.warnings,
          candidate.suitability.warnings,
          candidate.offer.warnings,
        ),
        eligibility: candidate.eligibility,
        suitability: candidate.suitability,
      };
    });

    // §16 Rule 8 — MỌI lượt chạy, không phải chỉ khi không còn thẻ nào.
    const noAction = buildNoNewCardCandidate(scorable, ctx);
    const ranked = rankCandidates([...cardCandidates, noAction]);

    const confidence = computeConfidence({
      ranked,
      goal,
      userGaps: normalized.userGaps,
      dataGaps: normalized.dataGaps,
      oldestVerifiedAt: oldestVerifiedAt(normalized.universe, ix, asOf),
      asOf,
    });

    const need = goal.tripNeed;
    const accessible =
      need === null ? null : bestAccessibleFor(state, ix, asOf, need.programs);
    const winner = ranked[0];

    return {
      goalId: goal.goal.id,
      goalType: goal.goal.type,
      strategy: strategies[0] ?? { strategy: "OPEN_CARD", score: 0, reasonCodes: [] },
      strategies,
      primaryAction: winner,
      // Chỉ các thẻ, và `NO_NEW_CARD` luôn có chỗ riêng ở `noAction` — kể cả
      // khi nó đang đứng đầu. Trộn nó vào `alternatives` là để nó biến mất
      // khỏi đầu ra đúng lúc nó thắng.
      alternatives: ranked.filter((row) => row !== winner && row.kind === "open_card").slice(0, 4),
      noAction,
      reasonCodes: mergeReasonCodes(
        winner.reasonCodes,
        // Mã của MỌI chiến lược đạt ngưỡng, không chỉ chiến lược đứng đầu.
        // `PORTFOLIO_CONCENTRATED` thuộc về DANH MỤC, không thuộc về hành động
        // thắng cuộc — và nếu nó chỉ đi kèm `DIVERSIFY`, thì một người dồn
        // 89% vào Aeroplan® sẽ không bao giờ nghe thấy điều đó chỉ vì
        // `EARN_FLEXIBLE_POINTS` hơn `DIVERSIFY` đúng vài phần trăm.
        ...strategies.filter((row) => row.score >= 0.5).map((row) => row.reasonCodes),
        need?.reasonCodes ?? [],
        confidence.level === "low" && ranked.length > 1
          ? (["SCORES_NEARLY_TIED"] as ReasonCode[])
          : [],
      ),
      warnings: mergeWarnings(winner.warnings, need?.warnings ?? []),
      numbers: {
        tripNeedLow: need?.low ?? null,
        tripNeedTypical: need?.typical ?? null,
        tripNeedHigh: need?.high ?? null,
        directPoints:
          need === null
            ? null
            : need.programs.reduce((best, programId) => {
                const entry = portfolio.direct.get(programId);
                return entry?.kind === "known" ? Math.max(best, entry.points) : best;
              }, 0),
        accessiblePoints: accessible,
        pointsGapTypical:
          need?.typical == null || accessible === null
            ? null
            : Math.max(0, need.typical - accessible),
        topEcosystemShare: topEcosystemShare(portfolio),
        flexibilityScore: portfolio.flexibilityScore,
      },
      confidence,
    };
  });

  return {
    engineVersion: ENGINE_VERSION,
    asOf,
    goalResolution: normalized.goalResolution,
    results,
    followUp: nextQuestion({
      gaps: normalized.userGaps,
      ranked: results[0]?.primaryAction === undefined ? [] : [results[0].primaryAction, ...results[0].alternatives],
    }),
    reasonCodes: mergeReasonCodes(runReasons),
    warnings: mergeWarnings(runWarnings),
    dataGaps: normalized.dataGaps,
    userGaps: normalized.userGaps,
  };
}

/**
 * Chạy engine với lịch sử offer nạp sẵn từ nguồn dữ liệu.
 *
 * Tách khỏi `recommend` để hàm kia THUẦN và đồng bộ: test dựng được một lượt
 * chạy đầy đủ mà không cần I/O, và §20 (dựng lại một lượt chạy cũ từ bản chụp)
 * không phải đi qua một lớp bất đồng bộ để làm việc đó.
 */
export async function recommendFromSource(
  source: RecommendationDataSource,
  state: UserState,
  data: RecommendationDataset,
  ix: DatasetIndex,
  asOf: string,
): Promise<RecommendationRun> {
  const universe = normalize(state, data, ix, asOf).universe;
  const entries = await Promise.all(
    universe.map(
      async (product) => [product.id as string, await source.getOfferHistory(product.id)] as const,
    ),
  );
  return recommend({ state, data, ix, asOf, offerHistory: new Map(entries) });
}
