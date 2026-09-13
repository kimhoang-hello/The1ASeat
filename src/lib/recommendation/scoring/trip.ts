/**
 * §10.2 — "tôi muốn bay chuyến này".
 *
 * ```
 * 35% Trip Currency Utility
 * 20% Points Gap Reduction
 * 15% Offer Quality
 * 10% Minimum Spend Fit
 * 10% Flexibility Value
 *  5% Relevant Travel Benefits
 *  5% Editorial Adjustment   ← §15 chưa làm, áp ở `rules.ts`
 * ```
 *
 * Khác `next-card.ts` ở chỗ then chốt: 35% nặng nhất không phải offer mà là
 * **đồng tiền này có đặt được chặng đó không**. Một thẻ với offer rực rỡ bằng
 * một đồng tiền không bay tới Nhật được không giúp gì cho người muốn bay Nhật,
 * và một hàm chấm điểm vạn năng sẽ xếp nó đầu bảng.
 *
 * `points_gap_reduction` bằng 0 khi khoảng cách bằng 0 — và đó không phải lỗi
 * làm tròn, nó là §16 Rule 1 phát biểu bằng điểm số: người đã đủ điểm thì mọi
 * thẻ mất 20% điểm cùng lúc, và `NO_NEW_CARD` thắng vì lý do đúng. Nó đi về 0
 * LIỀN MẠCH khi người dùng gần đủ, không nhảy từ 1 xuống 0 ở mép — xem
 * `scoreTrip`.
 */

import { bestCurrencyNeedVia } from "../needs.ts";
import { offerQualityComponent, spendFitComponent } from "./shared.ts";
import { tripCoverage } from "../strategies.ts";
import { flexibilityReach, flexibilityScale } from "../portfolio.ts";
import { activeAt } from "../temporal.ts";
import { component, relativeTo } from "./weights.ts";
import { bonusPointsToward } from "./context.ts";
import type { PointsProgramId } from "../types.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

/** Đồng tiền của thẻ này phục vụ chặng đó tới mức nào. */
function tripCurrencyUtility(
  candidate: CandidateFacts,
  ctx: ScoringContext,
  programs: readonly PointsProgramId[],
): { raw: number; note: string } {
  const programId = candidate.product.pointsProgramId;
  if (programId === null) return { raw: 0, note: "thẻ không kiếm đồng tiền nào" };
  if (programs.length === 0) {
    // Chưa có award strategy cho chặng này. KHÔNG chấm 0 cho mọi thẻ — làm vậy
    // là để một chỗ trống của lớp dữ liệu tự động đẩy `NO_NEW_CARD` lên đầu.
    // Rơi về nhu cầu đồng tiền chung, và độ tin cậy hạ ở §29.
    return {
      raw: bestCurrencyNeedVia(ctx.needs, ctx.ix, programId, ctx.asOf),
      note: "chặng chưa có award strategy — dùng nhu cầu đồng tiền chung",
    };
  }
  if (programs.includes(programId)) {
    return { raw: 1, note: "kiếm thẳng đồng tiền định giá được chặng này" };
  }
  const reaches = activeAt(ctx.ix.pathsBySource.get(programId) ?? [], ctx.asOf).some(
    (path) =>
      path.requiresTier === null &&
      programs.includes(path.destinationProgramId as PointsProgramId),
  );
  if (reaches) return { raw: 0.85, note: "chuyển được sang đồng tiền định giá chặng" };
  return { raw: 0.05, note: "không với tới chương trình nào định giá chặng này" };
}

/**
 * Phần chuyến đi mà welcome bonus của thẻ này thêm vào — `null` khi chưa tính
 * được (chặng chưa định giá, thiếu thừa số chuyến đi).
 *
 * Một hàm cho cả điểm số lẫn mã lý do: `estimated` là chỗ bản trước im lặng.
 * Bonus rơi vào một chương trình chỉ biết giá SÀN thì tỷ lệ phủ "sau" là điểm
 * giữa của [0, bonus/sàn] — với bonus bằng đúng mức sàn, 50% chuyến đi được
 * cộng vào điểm từ một con số không ai hứa, và người đọc chỉ thấy "phủ từ 0%
 * lên 50%" (vòng Codex 15).
 */
export function tripGain(
  candidate: CandidateFacts,
  ctx: ScoringContext,
): {
  before: number;
  after: number;
  raw: number;
  estimated: boolean;
  floorOnly: boolean;
  /** Cửa welcome bonus chưa biết — phần tăng tính MỘT NỬA, xem dưới. */
  bonusUncertain: boolean;
} | null {
  const need = ctx.goal.tripNeed;
  if (need === null) return null;
  const before = tripCoverage(ctx.state, ctx.ix, ctx.asOf, need).coverage;
  if (before === null) return null;
  if (before >= 1) return { before, after: before, raw: 0, estimated: false, floorOnly: false, bonusUncertain: false };
  const bonusTo = (programId: PointsProgramId) => bonusPointsToward(candidate, programId, ctx.ix, ctx.asOf) ?? 0;
  const after = tripCoverage(ctx.state, ctx.ix, ctx.asOf, need, bonusTo);
  const full = Math.max(0, (after.coverage as number) - before);
  // Bonus BỊ CHẶN thì `bonusPointsToward` về 0 — phần tăng bằng 0. Bonus
  // CHƯA CHẮC thì điểm giữa của hai thế giới: nửa phần tăng — cùng quy ước với
  // nửa `offer_quality` (`scoring/shared.ts`). Cộng trọn là hứa bonus cho người
  // có thể đã từng giữ thẻ (vòng Codex 19).
  const bonusUncertain = candidate.eligibility.welcomeOfferUncertain && full > 0;
  const raw = bonusUncertain ? full / 2 : full;
  const estimated = raw > 0 && !after.coverageKnown;
  return {
    before,
    after: after.coverage as number,
    raw,
    estimated,
    bonusUncertain,
    // Cảnh báo "chỉ biết giá sàn" CHỈ khi bonus của CHÍNH thẻ này rơi vào một
    // chương trình chỉ-có-sàn đang còn bất định — xem `uncertainFloorOnlyPrograms`.
    floorOnly: estimated && after.uncertainFloorOnlyPrograms.some((programId) => bonusTo(programId) > 0),
  };
}

export function scoreTrip(candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent[] {
  const need = ctx.goal.tripNeed;
  const programs = need?.programs ?? [];

  const utility = tripCurrencyUtility(candidate, ctx, programs);

  /* ---- Thu hẹp khoảng cách điểm ---------------------------------- */
  /*
   * Phần CHUYẾN ĐI mà welcome bonus này thêm vào — đo bằng CHÍNH `tripCoverage`,
   * chạy hai lần: không có bonus, và có bonus cộng vào mọi chương trình nó
   * với tới. Hiệu hai con số là điểm.
   *
   * Ba bản trước đều dựng một phép đo thứ hai ở đây, và cả ba hỏng:
   *   - `bonus / khoảng cách`: thiếu 5,000 trên 205,000 thì mọi thẻ nhận
   *     trọn 20%, và điểm gãy bậc ở mép đủ điểm (Test C, 4.1.0);
   *   - `min(bonus, khoảng cách) / cận trên` của `bestProgram`: đúng dáng,
   *     nhưng với người CHƯA có điểm nào, mọi chương trình cùng phủ 0% và
   *     `bestProgram` là cái đứng đầu theo id (`aadvantage`) — nên mọi thẻ
   *     Aeroplan® được 0 điểm thu hẹp khoảng cách chỉ vì "aa" đứng trước "ae";
   *   - và số dư chưa biết lọt vào như số 0 (vòng Codex 3).
   * Cùng một hàm cho "trước" và "sau" thì cả ba hết chỗ quay lại: chỉ cần MỘT
   * chương trình đủ, số dư chưa biết lấy điểm giữa, và mép đủ điểm liền mạch
   * vì hiệu hai tỷ lệ phủ đi về 0 khi cả hai cùng về 1.
   */
  const gain = tripGain(candidate, ctx);
  let gapRaw = 0;
  let gapNote = "chưa tính được khoảng cách điểm";
  if (gain !== null && gain.before >= 1) {
    gapNote = "đã đủ điểm — không còn khoảng cách nào để thu hẹp (§16 Rule 1)";
  } else if (gain !== null) {
    gapRaw = gain.raw;
    gapNote =
      gapRaw === 0
        ? "welcome bonus không đưa chương trình nào đặt được chặng này tiến gần hơn"
        : `welcome bonus đưa phần chuyến đi đã phủ từ ${Math.round(gain.before * 100)}% lên ${Math.round(gain.after * 100)}%` +
          (gain.bonusUncertain ? " — chưa chắc nhận được bonus: tính MỘT NỬA phần tăng" : "") +
          (gain.estimated ? " — ƯỚC LƯỢNG: điểm giữa một khoảng phủ, không phải số đo" : "");
  }

  /* ---- Giá trị của sự linh hoạt (§16 Rule 2) ---------------------- */
  const programId = candidate.product.pointsProgramId;
  // Đồng tiền chuyển được giữ lại lựa chọn: chặng đổi giá, chương trình
  // devalue, hoặc chỗ ngồi hết — người giữ điểm linh hoạt vẫn đi được. Rule 2
  // ("đừng chuyển sớm") là cùng một ý ở phía hành động.
  //
  // `isFlexibleInPractice`, không phải cờ `transferable`: một đồng tiền chưa
  // có chặng nào trong dữ liệu không giữ được lựa chọn nào cho ai cả.
  // Theo TẦM VỚI, không theo có/không: một đồng tiền chuyển được tới đúng một
  // hãng nội địa giữ lại ít lựa chọn hơn hẳn một đồng tiền tới được năm nơi.
  const reach = programId === null ? null : flexibilityReach(ctx.ix, programId, ctx.asOf);
  const flexibilityRaw = reach === null ? 0.3 : 0.3 + 0.7 * reach;
  // Mẫu số của tầm với là chương trình với tới NHIỀU đích nhất — thường chẳng
  // dính gì tới thẻ này, nên phải nói tên nó ra (xem `flexibilityScale`).
  const scale = flexibilityScale(ctx.ix, ctx.asOf);
  const flexibilityNote =
    reach === null
      ? "thẻ không kiếm đồng tiền nào — 0.3 sàn"
      : `0.3 + 0.7 × tầm với ${reach.toFixed(2)} (mẫu số ${scale.best} đích của ${scale.programs.join(", ")})`;

  return [
    component("trip_currency_utility", 0.35, utility.raw, utility.note),
    component("points_gap_reduction", 0.2, gapRaw, gapNote),
    offerQualityComponent(0.15, candidate, ctx),
    spendFitComponent(0.1, candidate),
    component("flexibility_value", 0.1, flexibilityRaw, flexibilityNote),
    component(
      "travel_benefits",
      0.05,
      relativeTo(candidate.travelBenefitCount, ctx.scale.maxTravelBenefitCount),
      `${candidate.travelBenefitCount} quyền lợi hàng không/sân bay TĂNG THÊM ÷ nhiều nhất ${ctx.scale.maxTravelBenefitCount}`,
    ),
  ];
}
