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
 * thẻ mất 20% điểm cùng lúc, và `NO_NEW_CARD` thắng vì lý do đúng.
 */

import { bestCurrencyNeedVia } from "../needs.ts";
import { offerQualityScore } from "../offer-quality.ts";
import { tripCoverage } from "../strategies.ts";
import { flexibilityReach } from "../portfolio.ts";
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

export function scoreTrip(candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent[] {
  const need = ctx.goal.tripNeed;
  const programs = need?.programs ?? [];

  const utility = tripCurrencyUtility(candidate, ctx, programs);

  /* ---- Thu hẹp khoảng cách điểm ---------------------------------- */
  let gapRaw = 0;
  let gapNote = "chưa tính được khoảng cách điểm";
  if (need !== null) {
    const { coverage, bestProgram } = tripCoverage(ctx.state, ctx.ix, ctx.asOf, need);
    // Khoảng cách đo bằng giá của CHÍNH chương trình phủ tốt nhất, không bằng
    // khoảng gộp — xem `tripCoverage`.
    const bestRow = need.byProgram.find((row) => row.programId === bestProgram);
    const gap =
      coverage === null || bestRow?.high == null
        ? null
        : Math.max(0, bestRow.high * (1 - coverage));
    if (gap !== null && bestProgram !== null) {
      if (gap === 0) {
        gapRaw = 0;
        gapNote = "đã đủ điểm — không còn khoảng cách nào để thu hẹp (§16 Rule 1)";
      } else {
        const bonus = bonusPointsToward(candidate, bestProgram, ctx.ix, ctx.asOf);
        gapRaw = bonus === null ? 0 : Math.min(1, bonus / gap);
        gapNote =
          bonus === null
            ? "welcome bonus không với tới được đồng tiền cần"
            : `bonus quy đổi ${Math.round(bonus).toLocaleString("en-US")} trên khoảng cách ${Math.round(gap).toLocaleString("en-US")}`;
      }
    }
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
  const flexibilityRaw =
    programId === null ? 0.3 : 0.3 + 0.7 * flexibilityReach(ctx.ix, programId, ctx.asOf);

  return [
    component("trip_currency_utility", 0.35, utility.raw, utility.note),
    component("points_gap_reduction", 0.2, gapRaw, gapNote),
    component(
      "offer_quality",
      0.15,
      offerQualityScore(candidate.offer, ctx.climate),
      "§11 offer quality",
    ),
    component(
      "spend_fit",
      0.1,
      candidate.suitability.minSpendFit ?? 0.5,
      "§13 mốc chi; 0.5 khi chưa biết sức dồn",
    ),
    component("flexibility_value", 0.1, flexibilityRaw, "đồng tiền chuyển được giữ lại lựa chọn"),
    component(
      "travel_benefits",
      0.05,
      relativeTo(candidate.travelBenefitCount, ctx.scale.maxTravelBenefitCount),
      "quyền lợi hàng không/sân bay TĂNG THÊM",
    ),
  ];
}
