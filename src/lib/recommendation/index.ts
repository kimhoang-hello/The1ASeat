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
