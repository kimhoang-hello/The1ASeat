/**
 * Số điểm một chuyến đi cần — §6 (khoảng, không phải giá) và §5.1 của bàn giao
 * (BA thừa số).
 *
 * ```
 * điểm cần = AwardStrategy.points × passengers × (roundTrip ? 2 : 1)
 * ```
 *
 * `AwardStrategy.pointsLow/Typical/High` là **một chiều, một người**. Thiếu
 * thừa số nào cũng sai IM LẶNG, và cả hai đều sai về hướng nguy hiểm: chúng
 * chia nhỏ số điểm cần rồi để `NO_NEW_CARD` thắng nhờ một giả định. Vì vậy
 * `passengers: null` hay `roundTrip: null` KHÔNG được mặc định — chúng làm
 * `low/typical/high` thành `null` và sinh một cảnh báo, tức biến một chỗ trống
 * thành một câu hỏi (§30) thay vì thành một con số sai.
 *
 * Tách khỏi `scoring/trip.ts` vì `rules.ts` (Rule 1: đã đủ điểm) và `rank.ts`
 * (NO_NEW_CARD) cũng đọc nó, và ba chỗ tự nhân lại ba lần là ba chỗ sai được.
 */

import { activeAt } from "./temporal.ts";
import { routeKey } from "./indexes.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { AwardStrategy, PointsProgramId } from "./types.ts";
import type { ResolvedTripGoal } from "./user.ts";
import type { TripNeed } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

function emptyNeed(reasonCodes: ReasonCode[], warnings: WarningCode[]): TripNeed {
  return {
    strategies: [],
    programs: [],
    perPassengerOneWayLow: null,
    perPassengerOneWayTypical: null,
    perPassengerOneWayHigh: null,
    low: null,
    typical: null,
    high: null,
    passengers: null,
    roundTrip: null,
    floorOnly: false,
    reasonCodes,
    warnings,
  };
}

function minOf(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.min(...known);
}

function maxOf(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.max(...known);
}

/**
 * Tra khoảng điểm cho một chuyến đi đã điền vùng khởi hành.
 *
 * CÁCH GỘP NHIỀU CHIẾN LƯỢC. Một cặp vùng–hạng ghế thường có nhiều chương
 * trình đặt được, và người dùng chỉ cần MỘT trong số đó. Nên:
 *
 *   low     = rẻ nhất trong những mức thấp   — đặt được đúng cách, đúng chỗ.
 *   typical = rẻ nhất trong những mức thường — đường đi hợp lý nhất.
 *   high    = cao nhất trong những mức cao   — rơi vào chương trình đắt hơn,
 *             hoặc mùa cao điểm.
 *
 * Lấy `high` theo mức cao nhất chứ không theo chính chiến lược rẻ nhất, vì
 * khoảng này còn được `rules.ts` Rule 1 dùng để kết luận "đã đủ điểm" — và câu
 * đó chỉ được nói khi số dư phủ cả cận TRÊN. Lấy cận trên hẹp lại là hứa đủ
 * điểm cho một người sẽ phát hiện mình thiếu ở bước đặt vé.
 */
export function tripNeedFor(
  trip: ResolvedTripGoal,
  ix: DatasetIndex,
  asOf: string,
): TripNeed {
  const warnings: WarningCode[] = [];
  const reasonCodes: ReasonCode[] = [];

  if (trip.cabin == null) {
    // Không có hạng ghế thì không có khoá tra. Đoán `economy` ở đây là chia số
    // điểm của một chuyến business cho ba.
    return emptyNeed(["TRIP_ROUTE_NOT_PRICED"], ["TRIP_CABIN_UNKNOWN"]);
  }

  const key = routeKey(trip.originRegion, trip.destinationRegion, trip.cabin);
  const strategies = activeAt(ix.strategiesByRoute.get(key) ?? [], asOf)
    // Thứ tự cố định: các chiến lược tới từ một `groupBy` trên mảng seed, và
    // `programs` bên dưới đi thẳng vào lời giải thích.
    .sort((a: AwardStrategy, b: AwardStrategy) => (a.id < b.id ? -1 : 1));

  if (strategies.length === 0) {
    // §33 mới phủ CANADA_US → SEA_VIETNAM. JAPAN / EUROPE / EAST_ASIA còn
    // trống, và Phase 1 đã khai đúng là `award_route_uncovered`. Nói "chưa có
    // dữ liệu" chứ KHÔNG lấp bằng số phỏng đoán.
    return emptyNeed(["TRIP_ROUTE_NOT_PRICED"], ["AWARD_ROUTE_NOT_IN_DATASET"]);
  }

  const programs = [...new Set(strategies.map((row) => row.programId))].sort() as PointsProgramId[];

  // `dynamic_floor` thì CHỈ `pointsLow` có nghĩa — hai số kia bắt buộc `null`
  // ở phía dữ liệu. Trình bày mức sàn như một cái giá là nói sai về tiền.
  const priced = strategies.filter((row) => row.pricingModel === "fixed");
  const floorOnly = priced.length === 0;
  if (floorOnly) {
    reasonCodes.push("AWARD_PRICE_IS_FLOOR_ONLY");
    warnings.push("AWARD_PRICE_FLOOR_ONLY");
  }

  const perLow = minOf(strategies.map((row) => row.pointsLow));
  const perTypical = minOf(priced.map((row) => row.pointsTypical));
  const perHigh = maxOf(priced.map((row) => row.pointsHigh));

  if (trip.passengers == null) warnings.push("TRIP_PASSENGERS_UNKNOWN");
  if (trip.roundTrip == null) warnings.push("TRIP_ROUND_TRIP_UNKNOWN");

  const canMultiply = trip.passengers != null && trip.roundTrip != null;
  const factor = canMultiply
    ? (trip.passengers as number) * ((trip.roundTrip as boolean) ? 2 : 1)
    : null;

  const scale = (value: number | null): number | null =>
    value === null || factor === null ? null : value * factor;

  return {
    strategies,
    programs,
    perPassengerOneWayLow: perLow,
    perPassengerOneWayTypical: perTypical,
    perPassengerOneWayHigh: perHigh,
    low: scale(perLow),
    typical: scale(perTypical),
    high: scale(perHigh),
    passengers: trip.passengers,
    roundTrip: trip.roundTrip,
    floorOnly,
    reasonCodes,
    warnings,
  };
}

/**
 * Độ khó tìm chỗ của chặng này — `null` khi không chiến lược nào nói.
 *
 * §16 Rule 1 cần nó: đủ điểm rồi thì vấn đề chuyển từ ĐIỂM sang CHỖ NGỒI, và
 * "mở thêm thẻ" không giải quyết được chỗ ngồi.
 */
export function availabilityDifficulty(need: TripNeed): "easy" | "medium" | "hard" | null {
  const ranks = { easy: 0, medium: 1, hard: 2 } as const;
  let best: "easy" | "medium" | "hard" | null = null;
  for (const strategy of need.strategies) {
    const value = strategy.availabilityDifficulty;
    if (value === null) continue;
    // DỄ NHẤT trong các chiến lược, không phải khó nhất: người dùng chỉ cần
    // một đường đặt được, nên đường dễ nhất là đường thật sự phải đi qua.
    if (best === null || ranks[value] < ranks[best]) best = value;
  }
  return best;
}
