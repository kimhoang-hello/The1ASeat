/**
 * Chuẩn hoá đầu vào: từ `UserState` + bộ dữ liệu ra thứ engine chạy được.
 *
 * Ba việc, và cả ba đều là những việc mà làm sai ở đây thì mọi tầng sau đều
 * sai theo mà không tầng nào phát hiện được:
 *
 *  1. **Giải mục tiêu.** `primaryGoal` trả về ba trạng thái, và `ambiguous`
 *     KHÔNG được rút gọn thành "lấy cái đầu tiên". §10 dùng hàm chấm điểm khác
 *     nhau cho từng loại mục tiêu, nên phá hoà bằng `GoalId` — một chuỗi sinh
 *     lúc lưu — là để một chi tiết lưu trữ chọn giúp người dùng.
 *  2. **Dựng tập ứng viên.** Đây là chỗ §16 Rule 5 sống: thẻ đang giữ không
 *     phải một ứng viên bị phạt nặng, nó KHÔNG phải ứng viên.
 *  3. **Gom chỗ trống.** Của cả người dùng lẫn lớp dữ liệu, và chỉ những chỗ
 *     lượt chạy này thật sự chạm tới — chỗ trống không chặn gì mà vẫn khai ra
 *     sẽ chiếm suất câu hỏi của §30 và trừ độ tin cậy §29 vô cớ.
 */

import { isAvailableAt } from "./temporal.ts";
import { primaryGoal, resolveTripGoal } from "./user.ts";
import { userGaps } from "./user-gaps.ts";
import { tripNeedFor } from "./trip-need.ts";
import { currentProductIds } from "./portfolio.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { DataGap, Product, RecommendationDataset } from "./types.ts";
import type { Goal, UserDataGap, UserState } from "./user-types.ts";
import type { GoalContext } from "./engine-types.ts";

export interface NormalizedInput {
  asOf: string;
  state: UserState;
  data: RecommendationDataset;
  ix: DatasetIndex;
  /** Mục tiêu engine sẽ chạy. Nhiều hơn một CHỈ khi chúng hoà ưu tiên. */
  goals: GoalContext[];
  goalResolution: "none" | "resolved" | "ambiguous";
  universe: Product[];
  userGaps: UserDataGap[];
  dataGaps: DataGap[];
}

/**
 * Thẻ tín dụng còn nhận đơn ở `asOf`, đúng nước, và người dùng chưa giữ.
 *
 * `isAvailableAt` trên `product_availability` chứ không phải `Product.isActive`
 * hay `effectiveTo`: danh tính sản phẩm là VĨNH VIỄN (thẻ đã ngừng vẫn phải
 * tra được, vì nó có thể đang nằm trong ví người dùng), còn "hôm đó có mở
 * được không" là một bảng riêng — và thẻ ngừng rồi mở lại là chuyện có thật.
 *
 * `productType === "credit_card"` là một phép lọc TƯỜNG MINH, không phải một
 * giả định. Bộ dữ liệu hôm nay chỉ có thẻ tín dụng, nhưng kiểu đã mở sẵn cho
 * `bank_account` và `brokerage`, và ngày chúng xuất hiện thì không lọc ở đây
 * nghĩa là engine sẽ chấm một tài khoản ngân hàng bằng bảng trọng số của thẻ.
 */
export function candidateUniverse(
  state: UserState,
  data: RecommendationDataset,
  ix: DatasetIndex,
  asOf: string,
): Product[] {
  const held = currentProductIds(state);
  const country = state.profile?.country ?? "CA";
  return data.products
    .filter((product) => product.productType === "credit_card")
    .filter((product) => product.country === country)
    .filter((product) => isAvailableAt(ix.availabilityByProduct.get(product.id) ?? [], asOf))
    // §16 Rule 5. Thẻ đang giữ ra khỏi bảng "thẻ mới" — trừ khi kiểu khuyến
    // nghị là "giữ/dùng thẻ hiện có", và kiểu đó là `NO_NEW_CARD`, một ứng
    // viên riêng ở `rank.ts`.
    .filter((product) => !held.has(product.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Chỗ trống của lớp dữ liệu mà lượt chạy này thật sự chạm tới. */
function relevantDataGaps(
  data: RecommendationDataset,
  universe: readonly Product[],
  goals: readonly GoalContext[],
): DataGap[] {
  const inPlay = new Set(universe.map((product) => product.id as string));
  const wantsAward = goals.some((goal) => goal.goal.type === "trip");
  return data.gaps
    .filter((gap) => {
      switch (gap.kind) {
        case "offer_terms_unknown":
        case "base_earn_rate_unknown":
        case "eligibility_unknown":
          // `subjectId` của ba loại này là một sản phẩm hoặc một offer của nó.
          return [...inPlay].some((productId) => gap.subjectId.includes(productId));
        case "award_route_uncovered":
        case "no_award_chart":
          return wantsAward;
        case "transfer_paths_unmodelled":
          // Chặng chuyển ảnh hưởng mọi ý định: chúng quyết định điểm tiếp cận
          // được, độ linh hoạt và phép đo tập trung.
          return true;
      }
    })
    .sort((a, b) =>
      a.kind !== b.kind
        ? a.kind < b.kind
          ? -1
          : 1
        : a.subjectId < b.subjectId
          ? -1
          : a.subjectId > b.subjectId
            ? 1
            : 0,
    );
}

function contextFor(
  goal: Goal,
  state: UserState,
  ix: DatasetIndex,
  asOf: string,
): GoalContext {
  if (goal.type !== "trip") return { goal, trip: null, tripNeed: null };
  const trip = resolveTripGoal(state.profile, goal);
  return { goal, trip, tripNeed: tripNeedFor(trip, ix, asOf) };
}

export function normalize(
  state: UserState,
  data: RecommendationDataset,
  ix: DatasetIndex,
  asOf: string,
): NormalizedInput {
  const resolved = primaryGoal(state);

  const goals: GoalContext[] =
    resolved.kind === "resolved"
      ? [contextFor(resolved.goal, state, ix, asOf)]
      : resolved.kind === "ambiguous"
        ? // Chạy CẢ HAI rồi trình bày song song, thay vì bí mật chọn một cái.
          // Sắp theo `id` để thứ tự trình bày cũng tất định.
          [...resolved.candidates]
            .sort((a, b) => (a.id < b.id ? -1 : 1))
            .map((goal) => contextFor(goal, state, ix, asOf))
        : [];

  const universe = candidateUniverse(state, data, ix, asOf);

  return {
    asOf,
    state,
    data,
    ix,
    goals,
    goalResolution: resolved.kind,
    universe,
    userGaps: userGaps(state),
    dataGaps: relevantDataGaps(data, universe, goals),
  };
}
