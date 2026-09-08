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
import { asArray, primaryGoal, resolveTripGoal } from "./user.ts";
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
  heldBalancePrograms: readonly string[],
): DataGap[] {
  const inPlay = new Set(universe.map((product) => product.id as string));

  /** Cặp vùng người dùng THẬT SỰ hỏi, dạng `ORIGIN|DESTINATION`. */
  const routesAsked = new Set(
    goals
      .map((goal) => goal.trip)
      .filter((trip): trip is NonNullable<typeof trip> => trip !== null)
      .map((trip) => `${trip.originRegion}|${trip.destinationRegion}`),
  );
  /**
   * Chương trình một MỤC TIÊU CHUYẾN ĐI đụng tới.
   *
   * `no_award_chart` nói "chương trình này không công bố bảng giá", và câu đó
   * chỉ có nghĩa khi ai đó đang định ĐỔI VÉ. Nên hai phép lọc, và bản trước
   * sai cả hai chiều:
   *
   *   - Không có mục tiêu chuyến đi thì KHÔNG tính. Bản trước gom cả sản phẩm
   *     ứng viên, nên một người hỏi "thẻ tiếp theo" bị báo thiếu bảng giá
   *     MileagePlus® chỉ vì thẻ United® nằm trong danh sách.
   *   - Có mục tiêu chuyến đi thì phải tính cả SỐ DƯ NGƯỜI DÙNG ĐANG GIỮ. Bản
   *     trước chỉ gom chương trình định giá được chặng; người giữ Avios® hay
   *     Flying Blue® — hai chương trình có `no_award_chart` và không có thẻ
   *     riêng trong bộ dữ liệu — mất hẳn chỗ trống đó, nên engine lặng lẽ bỏ
   *     qua số điểm của họ mà KHÔNG hạ độ tin cậy.
   */
  const tripGoals = goals.filter((goal) => goal.goal.type === "trip");
  const programsInPlay = new Set<string>();
  if (tripGoals.length > 0) {
    for (const goal of tripGoals) {
      for (const programId of goal.tripNeed?.programs ?? []) {
        programsInPlay.add(programId as string);
      }
    }
    for (const row of heldBalancePrograms) programsInPlay.add(row);
    // Và đồng tiền của các thẻ ỨNG VIÊN: với một mục tiêu chuyến đi, thẻ
    // United® vẫn được chấm điểm, và `scoreTrip` cho nó mức thấp nhất chính vì
    // MileagePlus® không định giá được chặng. Chỗ trống đó có thật và phải hạ
    // độ tin cậy — nhưng CHỈ trong nhánh chuyến đi, để nó không rò sang một
    // người chỉ hỏi "thẻ tiếp theo".
    for (const product of universe) {
      if (product.pointsProgramId !== null) programsInPlay.add(product.pointsProgramId as string);
    }
  }

  return data.gaps
    .filter((gap) => {
      switch (gap.kind) {
        case "offer_terms_unknown":
        case "base_earn_rate_unknown":
        case "eligibility_unknown":
          // `subjectId` của ba loại này là một sản phẩm hoặc một offer của nó.
          // So bằng ĐƯỜNG BIÊN, không bằng `includes` trần: `prd_amex-aeroplan`
          // là chuỗi con của `prd_amex-aeroplan-reserve`, nên phép so lỏng gán
          // chỗ trống của thẻ này cho thẻ kia.
          return [...inPlay].some(
            (productId) =>
              gap.subjectId === productId ||
              gap.subjectId.startsWith(`${productId}_`) ||
              gap.subjectId.includes(`_${productId}_`),
          );
        case "award_route_uncovered":
          // CHỈ chặng người dùng hỏi. Báo ra mọi vùng chưa có dữ liệu cho một
          // chuyến Canada–Việt Nam đã có giá là nói với họ rằng khuyến nghị
          // của họ thiếu dữ liệu, trong khi nó không thiếu — và §29 sẽ hạ độ
          // tin cậy vì một chỗ trống không liên quan.
          return routesAsked.has(gap.subjectId);
        case "no_award_chart":
          // `subjectId` là một chương trình. Chỉ tính khi nó có trong cuộc.
          return programsInPlay.has(gap.subjectId);
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
    dataGaps: relevantDataGaps(
      data,
      universe,
      goals,
      // Chương trình người dùng ĐANG có số dư — kể cả những chương trình không
      // có thẻ nào trong bộ dữ liệu.
      //
      // `balance: 0` KHÔNG tính: nó là câu trả lời "đã hỏi, không có điểm nào"
      // (luật trống-≠-bằng-không ở mức DÒNG, README Phase 2). Không đồng điểm
      // nào của chương trình đó tham gia phép tính, nên khai thiếu bảng giá
      // của nó là hạ độ tin cậy vì một thứ không ảnh hưởng gì.
      // `balance: null` thì NGƯỢC LẠI — có tài khoản, chưa biết bao nhiêu, tức
      // số điểm đó có thể đang tham gia.
      asArray(state.balances)
        .filter((row) => row?.programId != null && row.balance !== 0)
        .map((row) => row.programId as string),
    ),
  };
}
