/**
 * Đọc trạng thái người dùng cho đúng.
 *
 * Mọi hàm ở đây là hàm THUẦN suy ra từ `UserState`. Không có phân tích danh
 * mục, không có chấm điểm, không có luật eligibility — những thứ đó là Phase 3
 * (§7 Portfolio Analyzer, §14, §16), và trộn chúng vào lớp dữ liệu là cách
 * chắc chắn nhất để mô hình người dùng bắt đầu mã hoá kết quả.
 *
 * Việc của file này chỉ là: những phép đọc mà viết tay ở chỗ gọi thì SAI ÂM
 * THẦM. `everHeld` là ví dụ điển hình — xem chú thích của nó.
 */

import type { PointsProgramId, ProductId, SpendCategory, TripRegion } from "./types.ts";
import type {
  EstimatedAmount,
  Goal,
  TripGoal,
  UserCard,
  UserPointBalance,
  UserProfile,
  UserSpendProfile,
  UserState,
} from "./user-types.ts";

/* ------------------------------------------------------------------ *
 * Thẻ đang giữ và thẻ từng giữ
 * ------------------------------------------------------------------ */

/** Đang giữ thẻ này. Dùng cho danh mục, tích điểm, và trùng quyền lợi. */
export function holdsNow(card: UserCard): boolean {
  return card.status === "active";
}

/**
 * ĐÃ TỪNG giữ thẻ này — kể cả đang giữ.
 *
 * Tồn tại vì `status === "previously_held"` là phép so ai cũng viết và nó BỎ
 * SÓT `closed`. Hai giá trị đó cùng nghĩa "từng giữ", và luật quyết định phụ
 * thuộc vào chúng — Amex® "once in a lifetime" — chỉ chặn WELCOME BONUS chứ
 * không chặn đơn (`EligibilityRule.scope === "welcome_offer"`). Nên hậu quả
 * của việc bỏ sót không phải một lỗi: là một khuyến nghị trông hoàn toàn hợp
 * lý, hứa một khoản bonus mà ngân hàng sẽ từ chối.
 *
 * Bao gồm cả thẻ đang giữ vì "once in a lifetime" tính cả lần này.
 */
export function everHeld(card: UserCard): boolean {
  return card.status === "active" || card.status === "closed" || card.status === "previously_held";
}

export function heldProductIds(state: UserState): Set<ProductId> {
  return new Set(state.cards.filter(holdsNow).map((card) => card.productId));
}

export function everHeldProductIds(state: UserState): Set<ProductId> {
  return new Set(state.cards.filter(everHeld).map((card) => card.productId));
}

/**
 * Lần gần nhất người dùng THÔI giữ sản phẩm này, nếu biết.
 *
 * `null` có hai nghĩa và người gọi phải phân biệt: chưa từng giữ (kiểm bằng
 * `everHeldProductIds`), hoặc từng giữ mà không rõ ngày đóng. Vế thứ hai sinh
 * ra `card_closed_date_unknown` — luật "không có bonus nếu từng giữ trong N
 * tháng qua" không đánh giá được, và mặc định là đủ điều kiện thì lại hứa một
 * khoản bonus không có thật.
 */
export function lastClosedDate(state: UserState, productId: ProductId): string | null {
  const dates = state.cards
    .filter((card) => card.productId === productId && card.closedDate !== null)
    .map((card) => card.closedDate as string);
  if (dates.length === 0) return null;
  return dates.reduce((latest, day) => (day > latest ? day : latest));
}

/* ------------------------------------------------------------------ *
 * Chi tiêu
 * ------------------------------------------------------------------ */

/** `null` = chưa biết. KHÔNG phải bằng không — xem đầu `user-types.ts`. */
export function spendFor(state: UserState, category: SpendCategory): EstimatedAmount | null {
  return state.spend?.byCategory[category] ?? null;
}

/** Các hạng mục người dùng ĐÃ trả lời. Phần bù là phần chưa biết. */
export function statedCategories(spend: UserSpendProfile): SpendCategory[] {
  return Object.keys(spend.byCategory) as SpendCategory[];
}

/**
 * Phần chi tiêu tháng CHƯA PHÂN BỔ vào hạng mục nào.
 *
 * Người khai tổng $2,000 và siêu thị $800 chưa nói gì về mười sáu hạng mục còn
 * lại. Coi chúng bằng không là engine kết luận người này không đi du lịch, và
 * kết luận đó đến từ một câu chưa ai hỏi. Con số trả về ở đây là phần còn lại
 * đó — nó thuộc về đâu thì vẫn chưa biết.
 *
 * Phép trừ trên KHOẢNG: `[a,b] − [c,d] = [a−d, b−c]`. Cận dưới không âm, và
 * tổng mở (`high: null`) ở bất kỳ vế nào lan sang kết quả.
 */
export function unallocatedMonthly(spend: UserSpendProfile): EstimatedAmount | null {
  const total = spend.monthlyTotal;
  if (total === null) return null;
  const stated = Object.values(spend.byCategory);
  let sumLow = 0;
  let sumHigh: number | null = 0;
  for (const amount of stated) {
    sumLow += amount.low;
    if (sumHigh !== null) sumHigh = amount.high === null ? null : sumHigh + amount.high;
  }
  const low = sumHigh === null ? 0 : Math.max(0, total.low - sumHigh);
  const high = total.high === null ? null : Math.max(0, total.high - sumLow);
  return { low, high };
}

/* ------------------------------------------------------------------ *
 * Số dư điểm
 * ------------------------------------------------------------------ */

/**
 * Dòng số dư của một chương trình, nếu người dùng có khai.
 *
 * Trả về CẢ DÒNG chứ không trả về con số: dòng tồn tại với `balance: null`
 * nghĩa là "có tài khoản, không biết bao nhiêu", còn không có dòng nào nghĩa
 * là "không có tài khoản". Trả về `number | null` sẽ gộp hai thứ đó làm một,
 * và Portfolio Analyzer mất khả năng nói "chặng chuyển này bạn dùng được".
 */
export function balanceRowFor(
  state: UserState,
  programId: PointsProgramId,
): UserPointBalance | null {
  return state.balances.find((row) => row.programId === programId) ?? null;
}

/* ------------------------------------------------------------------ *
 * Mục tiêu
 * ------------------------------------------------------------------ */

/**
 * Mục tiêu sắp theo thứ tự ưu tiên: số nhỏ trước, chưa xếp thì xuống cuối.
 *
 * Hoà thì phá bằng `id` chứ không giữ nguyên thứ tự mảng — thứ tự mảng đến từ
 * thứ tự database trả về, và một lượt chạy phải cho cùng một kết quả với cùng
 * đầu vào (§35 Phase 3: "same input + same version = same output"). Một phép
 * sắp xếp không tất định ở đây là chỗ rò rỉ tính tất định sớm nhất có thể.
 */
export function sortedGoals(state: UserState): Goal[] {
  return [...state.goals].sort((a, b) => {
    const pa = a.priority ?? Number.POSITIVE_INFINITY;
    const pb = b.priority ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** `null` = người dùng chưa nói họ muốn gì. Engine phải hỏi, không được đoán. */
export function primaryGoal(state: UserState): Goal | null {
  return sortedGoals(state)[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Chuyến đi
 * ------------------------------------------------------------------ */

/** Nước ở → vùng khởi hành. V1 chỉ có Canada, và mọi award strategy trong bộ
 *  dữ liệu đều đi từ `CANADA_US`. */
const ORIGIN_REGION_BY_COUNTRY: Record<"CA", TripRegion> = {
  CA: "CANADA_US",
};

/**
 * Chuyến đi với vùng khởi hành đã điền — thứ `award_strategies` tra được.
 *
 * `passengers` và `cabin` CỐ Ý vẫn có thể `null`. Chúng không suy được từ đâu,
 * và điền bừa một giá trị ở đây là giấu chỗ trống khỏi `user-gaps.ts` — engine
 * sẽ tự tin đúng ở chỗ nó không có quyền tự tin.
 */
export interface ResolvedTripGoal extends Omit<TripGoal, "originRegion"> {
  originRegion: TripRegion;
  /** Vùng khởi hành đến từ hồ sơ chứ không do người dùng nói ra. */
  originRegionInferred: boolean;
}

/**
 * Điền vùng khởi hành từ `profile.country` khi mục tiêu không nói.
 *
 * Suy được thì đừng hỏi lại (§30: "do not force users through a 25-question
 * form") — nước ở đã nằm trong hồ sơ rồi. Khác hẳn `passengers`: nó không suy
 * được từ dữ kiện nào cả, nên nó vẫn phải đi hỏi. Ranh giới là "đã biết ở chỗ
 * khác" chứ không phải "đoán được".
 */
export function resolveTripGoal(profile: UserProfile, goal: TripGoal): ResolvedTripGoal {
  const inferred = goal.originRegion === null;
  return {
    ...goal,
    originRegion: goal.originRegion ?? ORIGIN_REGION_BY_COUNTRY[profile.country],
    originRegionInferred: inferred,
  };
}

/* ------------------------------------------------------------------ *
 * So một khoảng với một ngưỡng
 * ------------------------------------------------------------------ */

/**
 * Một khoảng so với một ngưỡng cho BA kết quả, không phải hai.
 *
 * `straddles` là vế quan trọng: thu nhập khai "60–80K" so với thẻ đòi $80,000
 * không phải "không đạt". Trả về `false` ở đó là loại oan đúng những người mà
 * khoảng đó bao trùm, mà §14 lại nói eligibility và suitability phải tách
 * nhau và §4.1 lại khuyến khích hỏi bằng khoảng. Hai điều đó chỉ đứng chung
 * được nếu phép so biết nói "có thể".
 *
 * Đây là phép so THUẦN. Xử lý `straddles` thế nào — loại, phạt điểm, hay hỏi
 * thêm — là chính sách của Phase 3.
 */
export function compareToThreshold(
  amount: EstimatedAmount,
  threshold: number,
): "at_or_above" | "below" | "straddles" {
  if (amount.low >= threshold) return "at_or_above";
  if (amount.high !== null && amount.high < threshold) return "below";
  return "straddles";
}
