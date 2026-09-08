/**
 * §8 Strategy Generator — **tầng quyết định thật sự**.
 *
 * Trước khi nghĩ tới thẻ nào, sinh ra các HÀNH ĐỘNG có thể làm. Đây là chỗ
 * engine này khác một bộ lọc sản phẩm: câu hỏi "bước hợp lý tiếp theo là gì"
 * có những câu trả lời không phải là một cái thẻ — dùng số điểm đang có, chờ
 * một offer tốt hơn, hoặc đi tìm chỗ ngồi thay vì đi tìm điểm.
 *
 * Nếu tầng này không tồn tại thì `NO_NEW_CARD` chỉ có thể là "không thẻ nào đủ
 * điểm", tức một lời thú nhận thất bại. Có tầng này thì nó là một khuyến nghị
 * có lý do riêng, và §16 Rule 8 mới có nghĩa.
 *
 * KHÔNG có tên sản phẩm nào xuất hiện trong file này. Đó là phép thử: khoảnh
 * khắc một chiến lược được sinh ra vì một cái thẻ cụ thể, thứ tự suy luận của
 * spec đã bị đảo ngược.
 */

import { accessibleFor } from "./portfolio.ts";
import { availabilityDifficulty } from "./trip-need.ts";
import { clamp01 } from "./offer-quality.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { PointsProgramId } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { OfferClimate } from "./offer-quality.ts";
import type {
  GoalContext,
  PortfolioAnalysis,
  StrategyScore,
  TripNeed,
} from "./engine-types.ts";
import type { ReasonCode, StrategyType } from "./reason-codes.ts";

/**
 * Phần số điểm chuyến đi cần mà người dùng đã có.
 *
 * HỎI TỪNG CHƯƠNG TRÌNH MỘT, bằng chính giá của nó và chính số điểm với tới
 * được nó — rồi lấy chương trình phủ tốt nhất. Hai lỗi khác nhau bị chặn ở
 * đây, và cả hai đều đã xảy ra thật:
 *
 *  1. **Cộng qua các chương trình.** Đó là phép đếm trùng §7 cấm: người dùng
 *     dồn điểm về MỘT chương trình để đặt vé, nên "điểm tiếp cận được" của
 *     Aeroplan® và của Avios® đang tranh nhau cùng một pool Membership
 *     Rewards®.
 *  2. **So với một khoảng GỘP.** Khoảng gộp trộn mức thấp của chương trình
 *     này với mức cao của chương trình kia. 150,000 dặm AAdvantage® phủ đủ
 *     chuyến 140,000 dặm của chính AAdvantage®, nhưng đem so với trần 238,000
 *     của Asia Miles® thì engine kết luận còn thiếu — trong khi vẫn báo khoảng
 *     cách bằng 0 ở chỗ khác. Xem `TripNeed.byProgram`.
 *
 * So với cận TRÊN của chương trình đó. Nói "bạn đã đủ điểm" dựa trên cận dưới
 * là hứa đủ cho một người sẽ phát hiện mình thiếu ở bước đặt vé.
 */
export function tripCoverage(
  state: UserState,
  ix: DatasetIndex,
  asOf: string,
  need: Pick<TripNeed, "byProgram"> | null,
): { coverage: number | null; bestProgram: PointsProgramId | null; accessible: number } {
  const rows = need?.byProgram ?? [];
  let coverage: number | null = null;
  let bestProgram: PointsProgramId | null = null;
  let accessible = 0;

  // BA giá trị trả về phải nói về CÙNG MỘT chương trình.
  //
  // Bản trước giữ `accessible` là cực đại toàn cục trong khi `bestProgram` đi
  // theo tỷ lệ phủ — hai đại lượng chọn độc lập nhau, nên chúng tách ra ngay
  // khi chương trình nhiều điểm nhất không phải chương trình phủ tốt nhất:
  // 130,000 dặm AAdvantage® (phủ 93%) cộng 200,000 Asia Miles® chọn
  // AAdvantage® nhưng trả về 200,000 điểm, và tầng sau báo khoảng cách bằng 0
  // thay vì 10,000. Cùng loại mâu thuẫn mà khoảng GỘP từng gây ra, chỉ ở một
  // chỗ khác.
  //
  // Thứ tự cố định: `byProgram` đã sắp theo id ở `trip-need.ts`, và phép so
  // `>` bên dưới giữ chương trình ĐẦU TIÊN khi hoà.
  for (const row of rows) {
    if (row.high === null || row.high <= 0) continue;
    const reach = accessibleFor(state, ix, row.programId, asOf).total;
    const own = Math.min(1, reach / row.high);
    if (coverage === null || own > coverage) {
      coverage = own;
      bestProgram = row.programId;
      accessible = reach;
    }
  }

  // Không chương trình nào tính được giá (thiếu thừa số, hoặc toàn giá động):
  // `coverage` là CHƯA BIẾT, không phải 0. Vẫn trả về chương trình nhiều điểm
  // nhất để các tầng sau có chỗ bám — và `accessible` đi kèm đúng chương trình
  // đó.
  if (bestProgram === null) {
    for (const row of rows) {
      const reach = accessibleFor(state, ix, row.programId, asOf).total;
      if (bestProgram === null || reach > accessible) {
        accessible = reach;
        bestProgram = row.programId;
      }
    }
  }

  return { coverage, bestProgram, accessible };
}

export interface StrategyInput {
  state: UserState;
  ix: DatasetIndex;
  asOf: string;
  portfolio: PortfolioAnalysis;
  goal: GoalContext;
  climate: OfferClimate;
}

/**
 * Ngưỡng tập trung của §16 Rule 3, viết ra một chỗ.
 *
 * Spec nói ">70% dẫn tới một hệ sinh thái hàng không". Con số nằm ở đây chứ
 * không rải trong ba phép so, vì `needs.ts` và `rules.ts` cùng đọc nó và ba
 * bản sao của một ngưỡng là ba chỗ lệch được.
 */
export const CONCENTRATION_THRESHOLD = 0.7;

/** Dưới mức này thì danh mục coi như thiếu linh hoạt (§9 portfolio_needs). */
export const LOW_FLEXIBILITY_THRESHOLD = 0.3;

export function generateStrategies(input: StrategyInput): StrategyScore[] {
  const { state, ix, asOf, portfolio, goal, climate } = input;
  const reasons = new Map<StrategyType, ReasonCode[]>();
  const scores = new Map<StrategyType, number>();

  const add = (type: StrategyType, score: number, ...codes: ReasonCode[]) => {
    scores.set(type, clamp01(score));
    if (codes.length > 0) reasons.set(type, codes);
  };

  const need = goal.tripNeed;
  const isTrip = goal.goal.type === "trip";
  const hasBalances = portfolio.knownValueCents > 0 || portfolio.hasUnknownBalance;
  const topShare = portfolio.concentration[0]?.share ?? 0;

  /* ---- Dùng điểm đang có / xây thêm điểm -------------------------- */
  let coverage: number | null = null;
  if (isTrip && need !== null) {
    coverage = tripCoverage(state, ix, asOf, need).coverage;
  }

  if (coverage !== null) {
    add(
      "USE_EXISTING_POINTS",
      coverage,
      ...(coverage >= 1 ? (["POINTS_ALREADY_SUFFICIENT"] as ReasonCode[]) : []),
    );
    add(
      "BUILD_POINTS",
      1 - coverage,
      ...(coverage < 0.5 ? (["POINTS_GAP_LARGE"] as ReasonCode[]) : []),
    );
  } else if (isTrip) {
    // Chuyến đi mà chưa tính được số điểm cần — thiếu hạng ghế, thiếu số
    // người, hoặc chưa có award strategy cho vùng này. KHÔNG được suy ra "đủ
    // điểm": cả ba chỗ trống đó đều làm số điểm cần bị chia nhỏ.
    add("USE_EXISTING_POINTS", hasBalances ? 0.2 : 0, "TRIP_ROUTE_NOT_PRICED");
    add("BUILD_POINTS", 0.5);
  } else {
    add("USE_EXISTING_POINTS", hasBalances ? 0.35 : 0);
    add("BUILD_POINTS", goal.goal.type === "earn_points" ? 0.8 : hasBalances ? 0.3 : 0.6);
  }

  /* ---- Điểm linh hoạt -------------------------------------------- */
  // Thiếu linh hoạt là một nhu cầu THẬT chỉ khi người dùng có gì đó để mà kém
  // linh hoạt. Người chưa có điểm nào không "tập trung sai chỗ"; họ chỉ chưa
  // bắt đầu, và câu trả lời cho họ là BUILD_POINTS.
  const flexibilityGap = hasBalances ? 1 - portfolio.flexibilityScore : 0.5;
  const multiProgramRoute = (need?.programs.length ?? 0) > 1;
  add(
    "EARN_FLEXIBLE_POINTS",
    goal.goal.type === "diversify"
      ? Math.max(0.7, flexibilityGap)
      : multiProgramRoute
        ? Math.max(0.6, flexibilityGap)
        : flexibilityGap * 0.8,
    ...(flexibilityGap > 1 - LOW_FLEXIBILITY_THRESHOLD
      ? (["PORTFOLIO_LACKS_FLEXIBILITY"] as ReasonCode[])
      : []),
  );

  /* ---- Một đồng tiền cụ thể --------------------------------------- */
  const namedTarget = goal.goal.type === "earn_points" && goal.goal.targetProgramId !== null;
  const singleProgramRoute = (need?.programs.length ?? 0) === 1;
  add(
    "EARN_SPECIFIC_CURRENCY",
    namedTarget ? 1 : singleProgramRoute ? 0.75 : isTrip ? 0.5 : 0.25,
    ...(isTrip && need !== null && need.programs.length > 0
      ? (["TRIP_PROGRAM_MATCH"] as ReasonCode[])
      : []),
  );

  /* ---- Đa dạng hoá (§16 Rule 3) ----------------------------------- */
  const concentrationPressure =
    topShare <= CONCENTRATION_THRESHOLD
      ? 0
      : // Từ ngưỡng tới 100% thì áp lực đi từ 0 lên 1 — tuyến tính, và ngưỡng
        // là con số spec viết ra chứ không phải một hằng nghĩ thêm.
        (topShare - CONCENTRATION_THRESHOLD) / (1 - CONCENTRATION_THRESHOLD);
  add(
    "DIVERSIFY",
    goal.goal.type === "diversify" ? 1 : concentrationPressure,
    ...(concentrationPressure > 0 ? (["PORTFOLIO_CONCENTRATED"] as ReasonCode[]) : []),
  );

  /* ---- Chờ offer tốt hơn ------------------------------------------ */
  // Đọc từ THỊ TRƯỜNG (percentile trung vị của các offer đang chạy), không từ
  // một thẻ cụ thể: "chờ" chỉ là lời khuyên đúng khi cả bảng đang yếu, chứ
  // không phải khi một thẻ nào đó đang yếu — thẻ đó chỉ cần tụt hạng.
  const climateWeak =
    climate.medianPercentile === null ? 0 : clamp01(1 - climate.medianPercentile / 100);
  add(
    "WAIT_FOR_BETTER_OFFER",
    climateWeak,
    ...(climateWeak >= 0.7 ? (["WAIT_FOR_BETTER_OFFER"] as ReasonCode[]) : []),
  );

  /* ---- Đi tìm chỗ ngồi, không đi tìm điểm (§16 Rule 1) ------------- */
  const difficulty = need === null ? null : availabilityDifficulty(need);
  const availabilityPressure = difficulty === "hard" ? 1 : difficulty === "medium" ? 0.6 : 0.2;
  add(
    "FOCUS_ON_AVAILABILITY",
    coverage !== null && coverage >= 1 ? availabilityPressure : 0,
    ...(coverage !== null && coverage >= 1 && difficulty !== "easy"
      ? (["FOCUS_ON_AWARD_AVAILABILITY"] as ReasonCode[])
      : []),
  );

  /* ---- Hai hành động tổng hợp -------------------------------------- */
  const openCard = Math.max(
    scores.get("BUILD_POINTS") ?? 0,
    scores.get("EARN_FLEXIBLE_POINTS") ?? 0,
    scores.get("EARN_SPECIFIC_CURRENCY") ?? 0,
    scores.get("DIVERSIFY") ?? 0,
  );
  const standStill = Math.max(
    scores.get("USE_EXISTING_POINTS") ?? 0,
    scores.get("FOCUS_ON_AVAILABILITY") ?? 0,
    scores.get("WAIT_FOR_BETTER_OFFER") ?? 0,
  );

  add("OPEN_CARD", openCard);
  add("NO_NEW_CARD", standStill, ...(standStill >= 0.7 ? (["NO_NEW_CARD_NEEDED"] as ReasonCode[]) : []));

  return [...scores]
    .map(([strategy, score]) => ({
      strategy,
      score,
      reasonCodes: reasons.get(strategy) ?? [],
    }))
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : (TIEBREAK.get(a.strategy) ?? 99) - (TIEBREAK.get(b.strategy) ?? 99),
    );
}

/**
 * Thứ tự phá hoà giữa các chiến lược — TRỰC TIẾP NHẤT ĐỨNG TRƯỚC.
 *
 * Cần một thứ tự tường minh vì hoà là chuyện thường xuyên, không phải hiếm:
 * một người dùng đủ điểm cho chuyến đi VÀ tập trung 100% vào một hệ sinh thái
 * sẽ có `USE_EXISTING_POINTS` và `DIVERSIFY` cùng bằng 1.0. Sắp theo tên thì
 * "DIVERSIFY" thắng vì chữ D đứng trước chữ U — tất định, và vô nghĩa: engine
 * báo tiêu đề "hãy đa dạng hoá" cho một người vừa hỏi về một chuyến bay họ đã
 * đủ điểm để đặt.
 *
 * Thứ tự dưới đây xếp theo mức TRẢ LỜI THẲNG câu người dùng hỏi. Hai hành động
 * tổng hợp (`OPEN_CARD`, `NO_NEW_CARD`) đứng cuối: chúng gần như luôn bằng
 * đúng cực đại của những cái trên, nên khi hoà thì cái cụ thể mới là câu trả
 * lời có nội dung.
 */
const TIEBREAK = new Map<StrategyType, number>([
  ["USE_EXISTING_POINTS", 0],
  ["FOCUS_ON_AVAILABILITY", 1],
  ["EARN_SPECIFIC_CURRENCY", 2],
  ["BUILD_POINTS", 3],
  ["EARN_FLEXIBLE_POINTS", 4],
  ["DIVERSIFY", 5],
  ["WAIT_FOR_BETTER_OFFER", 6],
  ["OPEN_CARD", 7],
  ["NO_NEW_CARD", 8],
]);

/**
 * Nhu cầu MỞ THẺ MỚI, suy từ các chiến lược (§9 `action_need.new_card`).
 *
 * Không phải `OPEN_CARD` một mình: đủ điểm rồi thì nhu cầu mở thẻ giảm, kể cả
 * khi vẫn còn lý do để mở. Đó đúng là §16 Rule 1 phát biểu bằng số.
 */
export function newCardNeed(strategies: readonly StrategyScore[]): number {
  const byType = new Map(strategies.map((row) => [row.strategy, row.score]));
  const open = byType.get("OPEN_CARD") ?? 0;
  const still = byType.get("NO_NEW_CARD") ?? 0;
  return clamp01(open - 0.5 * still);
}
