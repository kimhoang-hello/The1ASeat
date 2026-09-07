/**
 * Kiểm một `UserState`.
 *
 * Ở một database, phần lớn phép kiểm dưới đây là khoá ngoại và ràng buộc
 * CHECK. Vì lựa chọn lưu trữ của Phase 2 còn để ngỏ (xem `user-source.ts`),
 * chúng phải chạy được bằng code — và như Phase 1 đã thấy, chạy được hoá ra
 * lại hơn: chúng kiểm được cả những thứ khoá ngoại không kiểm nổi, như "tổng
 * các hạng mục không được vượt tổng tháng" hay "mảng rỗng thì cờ đã-khai phải
 * nói đúng chuyện đó".
 *
 * HAI MỨC, giống `validate.ts`:
 *
 *   `error`   — trạng thái SAI. Trộn dữ liệu hai người, tham chiếu gãy, số học
 *               mâu thuẫn. Engine đọc vào sẽ nói sai. Chặn.
 *   `warning` — bất thường nhưng có thể có thật. Không chặn.
 *
 * Chỗ trống KHÔNG phải lỗi và không xuất hiện ở đây — hồ sơ thiếu dữ liệu là
 * ca bình thường nhất của Phase 2, không phải ca hỏng. Chúng đi qua
 * `user-gaps.ts`.
 */

import { CABINS, SPEND_CATEGORIES, TRIP_REGIONS } from "./types.ts";
import { isRealDate, type ValidationIssue } from "./validate.ts";
import {
  CANADIAN_PROVINCES,
  GOAL_TYPES,
  SUPPORTED_COUNTRIES,
  type EstimatedAmount,
  type UserState,
} from "./user-types.ts";
import type { RecommendationDataset } from "./types.ts";

function checkAmount(
  amount: EstimatedAmount | null | undefined,
  label: string,
  entity: string,
  issues: ValidationIssue[],
): void {
  if (amount === null || amount === undefined) return;
  if (!Number.isFinite(amount.low) || amount.low < 0) {
    issues.push({ level: "error", entity, message: `${label}: cận dưới không hợp lệ (${amount.low})` });
  }
  if (amount.high !== null) {
    if (!Number.isFinite(amount.high)) {
      issues.push({ level: "error", entity, message: `${label}: cận trên không hợp lệ (${amount.high})` });
    } else if (amount.high < amount.low) {
      issues.push({
        level: "error",
        entity,
        message: `${label}: cận trên (${amount.high}) nhỏ hơn cận dưới (${amount.low})`,
      });
    }
  }
}

function checkDate(
  value: string | null,
  label: string,
  entity: string,
  issues: ValidationIssue[],
): void {
  if (value === null) return;
  if (!isRealDate(value)) {
    issues.push({ level: "error", entity, message: `${label}: "${value}" không phải ngày YYYY-MM-DD có thật` });
  }
}

export function validateUserState(
  state: UserState,
  data: RecommendationDataset,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { profile, spend } = state;
  const userId = profile.id;

  /* ---------------- user_profiles ---------------- */

  const P = "user_profiles";
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(profile.country)) {
    issues.push({ level: "error", entity: P, message: `Quốc gia chưa phục vụ: "${profile.country}"` });
  }
  if (profile.province !== null && !(CANADIAN_PROVINCES as readonly string[]).includes(profile.province)) {
    issues.push({ level: "error", entity: P, message: `Tỉnh bang không hợp lệ: "${profile.province}"` });
  }
  checkDate(profile.createdAt, "createdAt", P, issues);
  checkDate(profile.updatedAt, "updatedAt", P, issues);
  if (isRealDate(profile.createdAt) && isRealDate(profile.updatedAt) && profile.updatedAt < profile.createdAt) {
    issues.push({ level: "error", entity: P, message: "updatedAt nằm trước createdAt" });
  }
  checkAmount(profile.annualPersonalIncome, "annualPersonalIncome", P, issues);
  checkAmount(profile.annualHouseholdIncome, "annualHouseholdIncome", P, issues);
  const personal = profile.annualPersonalIncome;
  const household = profile.annualHouseholdIncome;
  if (personal !== null && household !== null && household.high !== null && household.high < personal.low) {
    // Hộ gia đình bao gồm chính người đó, nên thu nhập hộ KHÔNG thể thấp hơn
    // thu nhập cá nhân. Chỉ báo khi chắc chắn — hai khoảng chồng lấn là bình
    // thường và không nói lên điều gì.
    issues.push({
      level: "error",
      entity: P,
      message: `Thu nhập hộ gia đình (≤${household.high}) thấp hơn thu nhập cá nhân (≥${personal.low})`,
    });
  }
  if (profile.annualFeeTolerancePerCard !== null) {
    const fee = profile.annualFeeTolerancePerCard;
    if (!Number.isFinite(fee) || fee < 0) {
      issues.push({ level: "error", entity: P, message: `annualFeeTolerancePerCard không hợp lệ (${fee})` });
    }
  }

  /* ---------------- user_spend_profiles ---------------- */

  const S = "user_spend_profiles";
  if (spend !== null) {
    if (spend.userId !== userId) {
      // Trộn hồ sơ chi tiêu của người khác vào là lỗi im lặng tuyệt đối: mọi
      // con số vẫn hợp lệ, chỉ là của người khác.
      issues.push({ level: "error", entity: S, message: `userId (${spend.userId}) không khớp hồ sơ (${userId})` });
    }
    checkDate(spend.updatedAt, "updatedAt", S, issues);
    checkAmount(spend.monthlyTotal, "monthlyTotal", S, issues);
    checkAmount(spend.minimumSpendCapacity3m, "minimumSpendCapacity3m", S, issues);

    let sumLow = 0;
    for (const [category, amount] of Object.entries(spend.byCategory)) {
      if (!(SPEND_CATEGORIES as readonly string[]).includes(category)) {
        issues.push({ level: "error", entity: S, message: `Hạng mục chi tiêu không tồn tại: "${category}"` });
        continue;
      }
      checkAmount(amount, `byCategory.${category}`, S, issues);
      if (amount !== undefined) sumLow += amount.low;
    }

    const total = spend.monthlyTotal;
    if (total !== null && total.high !== null && sumLow > total.high) {
      // Số học mâu thuẫn, không phải chỗ trống: ngay cả khi mọi hạng mục rơi
      // vào cận DƯỚI của chúng thì tổng vẫn vượt cận TRÊN của tổng tháng.
      issues.push({
        level: "error",
        entity: S,
        message: `Tổng cận dưới các hạng mục (${sumLow}) vượt cận trên của monthlyTotal (${total.high})`,
      });
    }
    const capacity = spend.minimumSpendCapacity3m;
    if (capacity !== null && total !== null && total.high !== null && capacity.low > total.high * 3) {
      // Có thật — một khoản mua lớn đã lên kế hoạch — nên chỉ cảnh báo. Nhưng
      // nó cũng là hình dạng của việc gõ nhầm tổng tháng thành tổng quý.
      issues.push({
        level: "warning",
        entity: S,
        message: `minimumSpendCapacity3m (${capacity.low}) vượt 3× tổng tháng (${total.high * 3}) — kiểm lại đơn vị`,
      });
    }
  }

  /* ---------------- user_cards ---------------- */

  const C = "user_cards";
  const CARD_STATUSES = ["active", "closed", "previously_held"];
  const productIds = new Set(data.products.map((row) => row.id as string));
  const seenCardIds = new Set<string>();
  const activeByProduct = new Map<string, number>();
  for (const card of state.cards) {
    if (seenCardIds.has(card.id)) {
      issues.push({ level: "error", entity: C, message: `Id trùng: ${card.id}` });
    }
    seenCardIds.add(card.id);
    if (card.userId !== userId) {
      issues.push({ level: "error", entity: C, message: `${card.id}: userId không khớp hồ sơ` });
    }
    if (!productIds.has(card.productId)) {
      issues.push({ level: "error", entity: C, message: `${card.id}: productId "${card.productId}" không tồn tại` });
    }
    if (!CARD_STATUSES.includes(card.status)) {
      // Một status gõ sai làm `holdsNow` VÀ `everHeld` cùng trả false: thẻ biến
      // mất khỏi cả danh mục hiện tại lẫn lịch sử sở hữu, không một phép kiểm
      // nào khác nhận ra, và welcome bonus của thẻ đó được hứa lại.
      issues.push({ level: "error", entity: C, message: `${card.id}: status không tồn tại "${card.status}"` });
    }
    checkDate(card.openedDate, `${card.id}.openedDate`, C, issues);
    checkDate(card.closedDate, `${card.id}.closedDate`, C, issues);
    if (card.openedDate !== null && card.closedDate !== null && card.closedDate < card.openedDate) {
      issues.push({ level: "error", entity: C, message: `${card.id}: đóng trước khi mở` });
    }
    if (card.status === "active" && card.closedDate !== null) {
      issues.push({ level: "error", entity: C, message: `${card.id}: đang giữ mà có closedDate` });
    }
    if (card.status === "active") {
      const count = (activeByProduct.get(card.productId) ?? 0) + 1;
      activeByProduct.set(card.productId, count);
      if (count === 2) {
        // Một sản phẩm chỉ giữ được một lần cùng lúc. Hai dòng `active` sẽ
        // làm Portfolio Analyzer đếm đôi quyền lợi và tỷ lệ tích điểm của nó.
        // Mở lại sau khi đóng thì là một dòng `closed` + một dòng `active`,
        // và đó là hợp lệ.
        issues.push({
          level: "error",
          entity: C,
          message: `Hai dòng đang-giữ cho cùng một sản phẩm: ${card.productId}`,
        });
      }
    }
  }
  if (state.cards.length > 0 && !state.declared.cards) {
    issues.push({
      level: "error",
      entity: C,
      message: "Có thẻ trong danh sách nhưng declared.cards = false",
    });
  }

  /* ---------------- user_point_balances ---------------- */

  const B = "user_point_balances";
  const programIds = new Set(data.pointsPrograms.map((row) => row.id as string));
  const seenPrograms = new Set<string>();
  for (const row of state.balances) {
    if (row.userId !== userId) {
      issues.push({ level: "error", entity: B, message: `${row.programId}: userId không khớp hồ sơ` });
    }
    if (!programIds.has(row.programId)) {
      issues.push({ level: "error", entity: B, message: `programId "${row.programId}" không tồn tại` });
    }
    if (seenPrograms.has(row.programId)) {
      // Hai dòng cho một chương trình thì "số dư" phụ thuộc vào dòng nào được
      // đọc trước — và Portfolio Analyzer cộng cả hai.
      issues.push({ level: "error", entity: B, message: `Hai dòng số dư cho cùng chương trình: ${row.programId}` });
    }
    seenPrograms.add(row.programId);
    if (row.balance !== null && (!Number.isFinite(row.balance) || row.balance < 0)) {
      issues.push({ level: "error", entity: B, message: `${row.programId}: số dư không hợp lệ (${row.balance})` });
    }
    checkDate(row.updatedAt, `${row.programId}.updatedAt`, B, issues);
  }
  if (state.balances.length > 0 && !state.declared.balances) {
    issues.push({
      level: "error",
      entity: B,
      message: "Có số dư trong danh sách nhưng declared.balances = false",
    });
  }

  /* ---------------- goals ---------------- */

  const G = "goals";
  const seenGoalIds = new Set<string>();
  const seenPriorities = new Set<number>();
  for (const goal of state.goals) {
    if (seenGoalIds.has(goal.id)) {
      issues.push({ level: "error", entity: G, message: `Id trùng: ${goal.id}` });
    }
    seenGoalIds.add(goal.id);
    if (goal.userId !== userId) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: userId không khớp hồ sơ` });
    }
    if (!(GOAL_TYPES as readonly string[]).includes(goal.type)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: goal type không tồn tại "${goal.type}"` });
    }
    checkDate(goal.createdAt, `${goal.id}.createdAt`, G, issues);
    if (goal.priority !== null) {
      if (!Number.isInteger(goal.priority) || goal.priority < 1) {
        issues.push({ level: "error", entity: G, message: `${goal.id}: priority phải là số nguyên ≥ 1` });
      } else if (seenPriorities.has(goal.priority)) {
        // Không chặn: `sortedGoals` phá hoà bằng id nên thứ tự vẫn tất định.
        // Nhưng thứ tự đó là tuỳ tiện, và người nhập nhiều khả năng không có ý đó.
        issues.push({ level: "warning", entity: G, message: `Hai mục tiêu cùng priority ${goal.priority}` });
      }
      seenPriorities.add(goal.priority);
    }

    if (goal.type === "earn_points" && goal.targetProgramId !== null && !programIds.has(goal.targetProgramId)) {
      issues.push({
        level: "error",
        entity: G,
        message: `${goal.id}: targetProgramId "${goal.targetProgramId}" không tồn tại`,
      });
    }

    if (goal.type !== "trip") continue;

    if (!(TRIP_REGIONS as readonly string[]).includes(goal.destinationRegion)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: vùng đến không tồn tại "${goal.destinationRegion}"` });
    }
    if (goal.originRegion !== null && !(TRIP_REGIONS as readonly string[]).includes(goal.originRegion)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: vùng đi không tồn tại "${goal.originRegion}"` });
    }
    if (goal.cabin !== null && !(CABINS as readonly string[]).includes(goal.cabin)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: hạng ghế không tồn tại "${goal.cabin}"` });
    }
    for (const [label, code] of [
      ["originAirport", goal.originAirport],
      ["destinationAirport", goal.destinationAirport],
    ] as const) {
      // Ràng buộc hình dạng, và cũng là cái chốt duy nhất giữ cho mô hình
      // không có chỗ nào nhét được chuỗi tự do — xem đầu `user-types.ts`.
      if (code !== null && !/^[A-Z]{3}$/.test(code)) {
        issues.push({ level: "error", entity: G, message: `${goal.id}: ${label} phải là mã IATA 3 chữ hoa ("${code}")` });
      }
    }
    if (goal.flexibility !== null && !["low", "medium", "high"].includes(goal.flexibility)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: flexibility không hợp lệ "${goal.flexibility}"` });
    }
    if (goal.passengers !== null && (!Number.isInteger(goal.passengers) || goal.passengers < 1)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: passengers phải là số nguyên ≥ 1` });
    }
    checkDate(goal.travelStart, `${goal.id}.travelStart`, G, issues);
    checkDate(goal.travelEnd, `${goal.id}.travelEnd`, G, issues);
    if (goal.travelStart !== null && goal.travelEnd !== null && goal.travelEnd < goal.travelStart) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: travelEnd nằm trước travelStart` });
    }
  }

  return issues;
}
