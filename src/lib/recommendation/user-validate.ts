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
 * HỢP ĐỒNG: hàm này TRẢ VỀ danh sách vấn đề, KHÔNG BAO GIỜ ném. Nó là thứ chạy
 * trên dữ liệu chưa đáng tin, nên một `TypeError` ở đây là chính lớp bảo vệ tự
 * sập trước thứ nó sinh ra để chặn. Vì vậy mọi phép so `null` dùng `== null`
 * (bắt cả `undefined`) và mọi phép duyệt object có `?? {}` — một dòng cũ thiếu
 * trường mới thêm phải ra một dòng LỖI, không ra một exception.
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
  type DeclaredCollections,
  type DiversifyGoal,
  type EarnPointsGoal,
  type EstimatedAmount,
  type NextCardGoal,
  type TripGoal,
  type UserCard,
  type UserPointBalance,
  type UserProfile,
  type UserSpendProfile,
  type UserState,
} from "./user-types.ts";
import type { RecommendationDataset } from "./types.ts";

function checkAmount(
  amount: EstimatedAmount | null | undefined,
  label: string,
  entity: string,
  issues: ValidationIssue[],
): void {
  // `== null` bắt CẢ `undefined`. Validator này tồn tại vì dữ liệu tới từ
  // database hoặc JSON, nơi một trường mới thêm sẽ vắng mặt ở mọi dòng cũ —
  // và `undefined !== null` là đúng, nên một phép so nghiêm ngặt sẽ đi tiếp
  // rồi ném `TypeError` thay vì báo lỗi dữ liệu.
  if (amount == null) return;
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

/**
 * `null` = ngày này vốn được phép trống. `undefined` thì KHÔNG — nó là trường
 * vắng mặt, và bỏ qua nó ở đây là đúng cách bản vá trước tự bắn vào chân mình:
 * đổi hàng loạt sang `== null` đã ngăn được exception nhưng làm `createdAt`,
 * `updatedAt` và ngày của goal thiếu hẳn mà vẫn trượt qua sạch.
 *
 * `requirePresent` mới là chỗ báo trường vắng mặt; ở đây chỉ cần KHÔNG im lặng
 * nuốt nó, và không ném.
 */
function checkDate(
  value: string | null | undefined,
  label: string,
  entity: string,
  issues: ValidationIssue[],
): void {
  if (value === null) return;
  if (value === undefined) {
    issues.push({ level: "error", entity, message: `${label}: thiếu ngày (undefined ≠ null)` });
    return;
  }
  if (!isRealDate(value)) {
    issues.push({ level: "error", entity, message: `${label}: "${value}" không phải ngày YYYY-MM-DD có thật` });
  }
}

/**
 * Bộ khoá của một dòng phải khớp ĐÚNG danh sách — không thiếu, và không thừa.
 *
 * THIẾU: `undefined` và `null` không giống nhau, và khác biệt đó im lặng theo
 * đúng hướng tệ nhất — một dòng database cũ thiếu trường mới thêm trượt qua mọi
 * phép kiểm `=== null`, nên dữ liệu THIẾU được trình bày như dữ liệu ĐẦY ĐỦ.
 *
 * THỪA: đây là chỗ hai lời hứa lớn nhất của mô hình được cưỡng chế LÚC CHẠY chứ
 * không chỉ lúc biên dịch. Kiểu dữ liệu chặn được người viết TypeScript, nhưng
 * một dòng JSON từ database hay từ API cũ thì không ai chặn — và
 * `loyaltyAccountNumber` (spec §4.4 CẤM lưu) hay `preferredProductId` (mô hình
 * người dùng không được mã hoá kết quả) sẽ đi thẳng qua validator, được lưu
 * lại, rồi tới tay Phase 3. Cả hai im lặng, và cái đầu còn là dữ liệu nhạy cảm
 * lẽ ra không được phép tồn tại.
 */
/**
 * Danh sách khoá phải CÓ MẶT trên từng thực thể.
 *
 * Viết ra thay vì suy từ kiểu, vì kiểu biến mất lúc chạy. Nhưng chúng được
 * CƯỠNG CHẾ khớp với kiểu bằng `AssertAllKeys` ngay bên dưới: thêm một trường
 * vào `UserProfile` mà quên thêm vào đây là một LỖI BIÊN DỊCH nêu đích danh
 * trường bị bỏ sót. Không có nó thì mỗi trường mới lại lặng lẽ thoát khỏi phép
 * kiểm hiện diện, và ca migration quay lại nguyên vẹn.
 */
const STATE_KEYS = ["profile", "spend", "cards", "balances", "goals", "declared"] as const;
const DECLARED_KEYS = ["cards", "balances"] as const;
const PROFILE_KEYS = [
  "id", "country", "province", "annualPersonalIncome", "annualHouseholdIncome",
  "personalIncomeDeclined", "householdIncomeDeclined", "annualFeeTolerancePerCard",
  "businessCardsAllowed", "hasBusiness", "isStudent", "createdAt", "updatedAt",
] as const;
const SPEND_KEYS = ["userId", "monthlyTotal", "byCategory", "minimumSpendCapacity3m", "updatedAt"] as const;
const CARD_KEYS = ["id", "userId", "productId", "status", "openedDate", "closedDate"] as const;
const BALANCE_KEYS = ["userId", "programId", "balance", "updatedAt"] as const;
const GOAL_BASE_KEYS = ["id", "userId", "type", "priority", "createdAt"] as const;
const TRIP_GOAL_KEYS = [
  ...GOAL_BASE_KEYS, "originRegion", "originAirport", "destinationRegion",
  "destinationAirport", "cabin", "passengers", "travelStart", "travelEnd", "flexibility",
] as const;
const EARN_GOAL_KEYS = [...GOAL_BASE_KEYS, "targetProgramId"] as const;

/** `true` nếu `K` phủ hết khoá của `T`; nếu không thì chính là tên khoá bị bỏ
 *  sót — nên phép gán bên dưới đỏ và thông báo lỗi nêu đích danh nó. */
type AssertAllKeys<T, K extends readonly (keyof T)[]> =
  Exclude<keyof T, K[number]> extends never ? true : Exclude<keyof T, K[number]>;

const _stateKeys: AssertAllKeys<UserState, typeof STATE_KEYS> = true;
const _declaredKeys: AssertAllKeys<DeclaredCollections, typeof DECLARED_KEYS> = true;
const _profileKeys: AssertAllKeys<UserProfile, typeof PROFILE_KEYS> = true;
const _spendKeys: AssertAllKeys<UserSpendProfile, typeof SPEND_KEYS> = true;
const _cardKeys: AssertAllKeys<UserCard, typeof CARD_KEYS> = true;
const _balanceKeys: AssertAllKeys<UserPointBalance, typeof BALANCE_KEYS> = true;
const _tripGoalKeys: AssertAllKeys<TripGoal, typeof TRIP_GOAL_KEYS> = true;
const _earnGoalKeys: AssertAllKeys<EarnPointsGoal, typeof EARN_GOAL_KEYS> = true;
const _nextCardGoalKeys: AssertAllKeys<NextCardGoal, typeof GOAL_BASE_KEYS> = true;
const _diversifyGoalKeys: AssertAllKeys<DiversifyGoal, typeof GOAL_BASE_KEYS> = true;
void [_stateKeys, _declaredKeys, _profileKeys, _spendKeys, _cardKeys, _balanceKeys, _tripGoalKeys, _earnGoalKeys, _nextCardGoalKeys, _diversifyGoalKeys];

/** Object thật, không phải mảng, không phải `null`. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkKeys(
  row: unknown,
  keys: readonly string[],
  entity: string,
  issues: ValidationIssue[],
): void {
  if (!isObject(row)) {
    // `key in row` ném khi `row` là chuỗi, số hay `false`. Hàm này chạy trên
    // JSON chưa đáng tin, nên nó phải tự chịu được thứ nó được sinh ra để kiểm.
    issues.push({ level: "error", entity, message: `Không phải object: ${JSON.stringify(row) ?? String(row)}` });
    return;
  }
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in row) || record[key] === undefined) {
      issues.push({ level: "error", entity, message: `Thiếu trường "${key}" (undefined ≠ null)` });
    }
  }
  const allowed = new Set<string>(keys);
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) {
      issues.push({
        level: "error",
        entity,
        message: `Trường lạ "${key}" — mô hình không nhận trường ngoài danh sách (spec §4.4 cấm dữ liệu nhạy cảm; mô hình cũng không được mã hoá kết quả)`,
      });
    }
  }
}

/**
 * Ngày KHÔNG được phép trống (`createdAt`, `updatedAt`).
 *
 * Tách khỏi `checkDate` vì `checkDate` return sớm ở `null` — đúng với những
 * ngày vốn có thể trống, nhưng với `createdAt` thì `null` là dữ liệu hỏng, và
 * gộp hai loại vào một hàm nghĩa là MỌI ngày bắt buộc đều nhận `null` sạch sẽ.
 * `checkKeys` không cứu được ca này: khoá CÓ MẶT, chỉ giá trị là sai.
 */
function checkRequiredDate(
  value: string | null | undefined,
  label: string,
  entity: string,
  issues: ValidationIssue[],
): void {
  if (value === null) {
    issues.push({ level: "error", entity, message: `${label}: không được để trống` });
    return;
  }
  checkDate(value, label, entity, issues);
}

export function validateUserState(
  state: UserState,
  data: RecommendationDataset,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ST = "user_state";

  // HÌNH DẠNG trước NỘI DUNG. `checkKeys` chỉ nói bộ khoá đúng hay sai; nó
  // không nói `cards` có phải mảng hay không. Và hai hướng hỏng khác nhau:
  //
  //   `cards: null`  — khoá CÓ MẶT nên không phải "thiếu trường", rồi `?? []`
  //                    lặng lẽ đọc thành "không có thẻ nào". Đúng cái luật
  //                    trống-≠-bằng-không mà cả mô hình dựng lên để giữ, thủng
  //                    ở tầng vật chứa.
  //   `declared: false` — `key in false` NÉM, phá hợp đồng "không bao giờ ném".
  //
  // Nên kiểm hình dạng trước, báo lỗi, rồi mới đọc tiếp trên bản đã biết là an
  // toàn.
  if (!isObject(state)) {
    return [{ level: "error", entity: ST, message: "UserState không phải object" }];
  }
  if (!isObject(state.profile)) {
    // Không có hồ sơ thì không phép kiểm nào còn nghĩa: mọi thứ khác đối chiếu
    // với `profile.id`.
    return [{ level: "error", entity: ST, message: "profile không phải object" }];
  }
  const cards = Array.isArray(state.cards) ? state.cards : [];
  const balances = Array.isArray(state.balances) ? state.balances : [];
  const goals = Array.isArray(state.goals) ? state.goals : [];
  for (const [label, value] of [
    ["cards", state.cards],
    ["balances", state.balances],
    ["goals", state.goals],
  ] as const) {
    if (!Array.isArray(value)) {
      issues.push({ level: "error", entity: ST, message: `${label} phải là mảng (nhận ${String(value)})` });
    }
  }
  if (!isObject(state.declared)) {
    issues.push({ level: "error", entity: ST, message: `declared phải là object (nhận ${String(state.declared)})` });
  }
  if (state.spend !== null && !isObject(state.spend)) {
    issues.push({ level: "error", entity: ST, message: `spend phải là object hoặc null (nhận ${String(state.spend)})` });
  }

  const profile = state.profile;
  const spend = isObject(state.spend) ? state.spend : null;
  const userId = profile.id;

  // Cả VẬT CHỨA cũng phải khớp bộ khoá, không chỉ các dòng bên trong. Một
  // `loyaltyAccountNumber` gắn thẳng vào gốc `UserState` hay vào `declared`
  // không đi qua vòng lặp nào của các thực thể con, nên lời hứa "không có chỗ
  // nào nhét được" thủng đúng ở chỗ dễ nhét nhất.
  checkKeys(state, STATE_KEYS, ST, issues);
  checkKeys(state.declared, DECLARED_KEYS, ST, issues);

  /* ---------------- user_profiles ---------------- */

  const P = "user_profiles";
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(profile.country)) {
    issues.push({ level: "error", entity: P, message: `Quốc gia chưa phục vụ: "${profile.country}"` });
  }
  if (profile.province != null && !(CANADIAN_PROVINCES as readonly string[]).includes(profile.province)) {
    issues.push({ level: "error", entity: P, message: `Tỉnh bang không hợp lệ: "${profile.province}"` });
  }
  checkRequiredDate(profile.createdAt, "createdAt", P, issues);
  checkRequiredDate(profile.updatedAt, "updatedAt", P, issues);
  if (isRealDate(profile.createdAt) && isRealDate(profile.updatedAt) && profile.updatedAt < profile.createdAt) {
    issues.push({ level: "error", entity: P, message: "updatedAt nằm trước createdAt" });
  }
  checkKeys(profile, PROFILE_KEYS, P, issues);
  checkAmount(profile.annualPersonalIncome, "annualPersonalIncome", P, issues);
  checkAmount(profile.annualHouseholdIncome, "annualHouseholdIncome", P, issues);
  const personal = profile.annualPersonalIncome;
  const household = profile.annualHouseholdIncome;
  if (personal != null && household != null && household.high != null && household.high < personal.low) {
    // Hộ gia đình bao gồm chính người đó, nên thu nhập hộ KHÔNG thể thấp hơn
    // thu nhập cá nhân. Chỉ báo khi chắc chắn — hai khoảng chồng lấn là bình
    // thường và không nói lên điều gì.
    issues.push({
      level: "error",
      entity: P,
      message: `Thu nhập hộ gia đình (≤${household.high}) thấp hơn thu nhập cá nhân (≥${personal.low})`,
    });
  }
  for (const [label, value] of [
    ["businessCardsAllowed", profile.businessCardsAllowed],
    ["hasBusiness", profile.hasBusiness],
    ["isStudent", profile.isStudent],
  ] as const) {
    // Cùng lớp lỗi với `status` gõ sai: chuỗi `"false"` đi qua sạch rồi
    // Phase 3 đọc bằng truthiness và hiểu ngược lại. TypeScript không có mặt
    // lúc chạy, nên nó không bảo vệ dữ liệu đọc từ database hay JSON.
    if (value != null && typeof value !== "boolean") {
      issues.push({ level: "error", entity: P, message: `${label} phải là boolean hoặc null (nhận "${String(value)}")` });
    }
  }
  for (const [label, declined, value] of [
    ["personalIncomeDeclined", profile.personalIncomeDeclined, personal],
    ["householdIncomeDeclined", profile.householdIncomeDeclined, household],
  ] as const) {
    if (typeof declined !== "boolean") {
      issues.push({ level: "error", entity: P, message: `${label} phải là boolean` });
    } else if (declined && value != null) {
      // Từ chối nói mà vẫn có số là hai câu trả lời mâu thuẫn; giữ cả hai thì
      // không nói được cái nào là thật. Kiểm THEO TỪNG TRƯỜNG, vì khai thu nhập
      // cá nhân rồi từ chối câu hộ gia đình là một trạng thái hợp lệ.
      issues.push({ level: "error", entity: P, message: `${label} = true nhưng vẫn có số thu nhập` });
    }
  }
  if (profile.annualFeeTolerancePerCard != null) {
    const fee = profile.annualFeeTolerancePerCard;
    if (!Number.isFinite(fee) || fee < 0) {
      issues.push({ level: "error", entity: P, message: `annualFeeTolerancePerCard không hợp lệ (${fee})` });
    }
  }

  /* ---------------- user_spend_profiles ---------------- */

  const S = "user_spend_profiles";
  if (spend != null) {
    if (spend.userId !== userId) {
      // Trộn hồ sơ chi tiêu của người khác vào là lỗi im lặng tuyệt đối: mọi
      // con số vẫn hợp lệ, chỉ là của người khác.
      issues.push({ level: "error", entity: S, message: `userId (${spend.userId}) không khớp hồ sơ (${userId})` });
    }
    checkKeys(spend, SPEND_KEYS, S, issues);
    checkRequiredDate(spend.updatedAt, "updatedAt", S, issues);
    checkAmount(spend.monthlyTotal, "monthlyTotal", S, issues);
    checkAmount(spend.minimumSpendCapacity3m, "minimumSpendCapacity3m", S, issues);

    let sumLow = 0;
    for (const [category, amount] of Object.entries(spend.byCategory ?? {})) {
      if (!(SPEND_CATEGORIES as readonly string[]).includes(category)) {
        issues.push({ level: "error", entity: S, message: `Hạng mục chi tiêu không tồn tại: "${category}"` });
        continue;
      }
      checkAmount(amount, `byCategory.${category}`, S, issues);
      if (amount != null) sumLow += amount.low;
    }

    const total = spend.monthlyTotal;
    if (total != null && total.high != null && sumLow > total.high) {
      // Số học mâu thuẫn, không phải chỗ trống: ngay cả khi mọi hạng mục rơi
      // vào cận DƯỚI của chúng thì tổng vẫn vượt cận TRÊN của tổng tháng.
      issues.push({
        level: "error",
        entity: S,
        message: `Tổng cận dưới các hạng mục (${sumLow}) vượt cận trên của monthlyTotal (${total.high})`,
      });
    }
    const capacity = spend.minimumSpendCapacity3m;
    if (capacity != null && total != null && total.high != null && capacity.low > total.high * 3) {
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
  for (const card of cards) {
    if (!isObject(card)) {
      issues.push({ level: "error", entity: C, message: `Dòng thẻ không phải object: ${String(card)}` });
      continue;
    }
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
    checkKeys(card, CARD_KEYS, C, issues);
    checkDate(card.openedDate, `${card.id}.openedDate`, C, issues);
    checkDate(card.closedDate, `${card.id}.closedDate`, C, issues);
    if (card.openedDate != null && card.closedDate != null && card.closedDate < card.openedDate) {
      issues.push({ level: "error", entity: C, message: `${card.id}: đóng trước khi mở` });
    }
    if (card.status === "active" && card.closedDate != null) {
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
  if (typeof state.declared?.cards !== "boolean" || typeof state.declared?.balances !== "boolean") {
    // `declared` là thứ tách "tôi chưa có thẻ nào" khỏi "tôi bấm bỏ qua".
    // Chuỗi `"false"` ở đây là truthy, nên nó lặng lẽ biến "chưa hỏi" thành
    // "đã khai" — đúng phân biệt mà cả mô hình dựng lên để giữ.
    issues.push({ level: "error", entity: C, message: "declared.cards và declared.balances phải là boolean" });
  }
  if (cards.length > 0 && !state.declared?.cards) {
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
  for (const row of balances) {
    if (!isObject(row)) {
      issues.push({ level: "error", entity: B, message: `Dòng số dư không phải object: ${String(row)}` });
      continue;
    }
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
    checkKeys(row, BALANCE_KEYS, B, issues);
    if (row.balance != null && (!Number.isFinite(row.balance) || row.balance < 0)) {
      issues.push({ level: "error", entity: B, message: `${row.programId}: số dư không hợp lệ (${row.balance})` });
    }
    checkRequiredDate(row.updatedAt, `${row.programId}.updatedAt`, B, issues);
  }
  if (balances.length > 0 && !state.declared?.balances) {
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
  for (const goal of goals) {
    if (!isObject(goal)) {
      issues.push({ level: "error", entity: G, message: `Dòng mục tiêu không phải object: ${String(goal)}` });
      continue;
    }
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
    checkKeys(
      goal,
      goal.type === "trip" ? TRIP_GOAL_KEYS : goal.type === "earn_points" ? EARN_GOAL_KEYS : GOAL_BASE_KEYS,
      G,
      issues,
    );
    checkRequiredDate(goal.createdAt, `${goal.id}.createdAt`, G, issues);
    if (goal.priority != null) {
      if (!Number.isInteger(goal.priority) || goal.priority < 1) {
        issues.push({ level: "error", entity: G, message: `${goal.id}: priority phải là số nguyên ≥ 1` });
      } else if (seenPriorities.has(goal.priority)) {
        // Không chặn: `sortedGoals` phá hoà bằng id nên thứ tự vẫn tất định.
        // Nhưng thứ tự đó là tuỳ tiện, và người nhập nhiều khả năng không có ý đó.
        issues.push({ level: "warning", entity: G, message: `Hai mục tiêu cùng priority ${goal.priority}` });
      }
      seenPriorities.add(goal.priority);
    }

    if (goal.type === "earn_points" && goal.targetProgramId != null && !programIds.has(goal.targetProgramId)) {
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
    if (goal.originRegion != null && !(TRIP_REGIONS as readonly string[]).includes(goal.originRegion)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: vùng đi không tồn tại "${goal.originRegion}"` });
    }
    if (goal.cabin != null && !(CABINS as readonly string[]).includes(goal.cabin)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: hạng ghế không tồn tại "${goal.cabin}"` });
    }
    for (const [label, code] of [
      ["originAirport", goal.originAirport],
      ["destinationAirport", goal.destinationAirport],
    ] as const) {
      // Ràng buộc hình dạng, và cũng là cái chốt duy nhất giữ cho mô hình
      // không có chỗ nào nhét được chuỗi tự do — xem đầu `user-types.ts`.
      if (code != null && !/^[A-Z]{3}$/.test(code)) {
        issues.push({ level: "error", entity: G, message: `${goal.id}: ${label} phải là mã IATA 3 chữ hoa ("${code}")` });
      }
    }
    if (goal.flexibility != null && !["low", "medium", "high"].includes(goal.flexibility)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: flexibility không hợp lệ "${goal.flexibility}"` });
    }
    if (goal.passengers != null && (!Number.isInteger(goal.passengers) || goal.passengers < 1)) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: passengers phải là số nguyên ≥ 1` });
    }
    checkDate(goal.travelStart, `${goal.id}.travelStart`, G, issues);
    checkDate(goal.travelEnd, `${goal.id}.travelEnd`, G, issues);
    if (goal.travelStart != null && goal.travelEnd != null && goal.travelEnd < goal.travelStart) {
      issues.push({ level: "error", entity: G, message: `${goal.id}: travelEnd nằm trước travelStart` });
    }
  }

  return issues;
}
