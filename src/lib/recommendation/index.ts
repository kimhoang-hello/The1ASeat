export * from "./types.ts";
export { validateDataset, type ValidationIssue } from "./validate.ts";
export { activeAt, datasetAt, isActiveAt, oneActiveAt } from "./temporal.ts";
export { indexDataset, routeKey, type DatasetIndex } from "./indexes.ts";
export {
  repoDataSource,
  OFFER_HISTORY_SINCE,
  type DatasetQuery,
  type RecommendationDataSource,
} from "./source.ts";
export {
  dedupeHistory,
  type OfferHistoryPoint,
  type OfferHistoryState,
} from "./offer-history.ts";
export { offlineDataset } from "./data/index.ts";
export { INCOMPLETE_OFFERS, UNQUOTABLE_AWARD_PROGRAMS } from "./data/index.ts";

/* Phase 2 — trạng thái người dùng */
export * from "./user-types.ts";
export {
  asArray,
  balanceRowFor,
  compareToThreshold,
  everHeld,
  everHeldProductIds,
  heldProductIds,
  holdsNow,
  isObject,
  lastClosed,
  primaryGoal,
  resolveTripGoal,
  sortedGoals,
  spendFor,
  statedCategories,
  unallocatedMonthly,
  type ClosureLookup,
  type PrimaryGoal,
  type ResolvedTripGoal,
} from "./user.ts";
export { userGaps } from "./user-gaps.ts";
export { validateUserState } from "./user-validate.ts";
export { inMemoryUserStore, type UserDataSource } from "./user-source.ts";

/* Phase 3 — engine.
 *
 * Import từ đây, không import thẳng file con: thứ tự các tầng là một phần của
 * hợp đồng (§26), và một chỗ gọi `scoreTrip` mà bỏ qua `applyRules` sẽ chạy
 * được, cho ra số, và sai. */
export { ENGINE_VERSION, recommend, recommendFromSource, type RecommendInput } from "./engine.ts";
export * from "./engine-types.ts";
export {
  REASON_CODES,
  REASON_CODE_NOTES,
  STRATEGY_TYPES,
  WARNING_CODES,
  WARNING_CODE_NOTES,
  type ReasonCode,
  type StrategyType,
  type WarningCode,
} from "./reason-codes.ts";
export { normalize, candidateUniverse, type NormalizedInput } from "./normalize.ts";
export {
  accessibleFor,
  analyzePortfolio,
  balanceKnowledge,
  centsPerPoint,
  currentProductIds,
  pastProductIds,
  topEcosystemShare,
} from "./portfolio.ts";
export { availabilityDifficulty, tripNeedFor } from "./trip-need.ts";
export {
  CONCENTRATION_THRESHOLD,
  LOW_FLEXIBILITY_THRESHOLD,
  generateStrategies,
  newCardNeed,
  tripCoverage,
} from "./strategies.ts";
// `bestAccessibleFor` đã bị gỡ: `tripCoverage` trả về cùng con số kèm cả
// chương trình phủ tốt nhất, và hai hàm cho cùng một khái niệm là hai chỗ
// lệch được.
export { bestCurrencyNeedVia, computeNeeds, currencyNeed } from "./needs.ts";
export { evaluateEligibility } from "./eligibility.ts";
export { evaluateSuitability, minimumSpendFit } from "./suitability.ts";
export { earnFitFor, type EarnFit } from "./earn-fit.ts";
export { benefitFitFor, heldBenefitKeys, type BenefitFit } from "./benefit-fit.ts";
export {
  activeOfferFor,
  historicalPercentile,
  offerClimate,
  offerFacts,
  offerQualityScore,
  type OfferClimate,
  type OfferFacts,
} from "./offer-quality.ts";
export { EDITORIAL_CAP, applyRules } from "./rules.ts";
export { buildNoNewCardCandidate, finalScore, rankCandidates } from "./rank.ts";
export { computeConfidence } from "./confidence.ts";
export { mergeReasonCodes, mergeWarnings, nextQuestion, scoreTable } from "./explain.ts";
export { assembleScore, EDITORIAL_WEIGHT, SCORABLE_WEIGHT } from "./scoring/weights.ts";
export { buildScale, type CandidateFacts, type ScoringContext } from "./scoring/context.ts";
export { scoreNextCard } from "./scoring/next-card.ts";
export { scoreTrip } from "./scoring/trip.ts";
export { scoreDiversify } from "./scoring/diversify.ts";
export { scoreEarning } from "./scoring/earning.ts";
export {
  allWindowEnds,
  requiredSpendOf,
  spendWindowsOf,
  type SpendComponentShape,
} from "./spend.ts";
