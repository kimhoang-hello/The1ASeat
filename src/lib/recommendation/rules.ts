/**
 * §16 — tám luật bắt buộc, và §17 giới hạn điều chỉnh biên tập.
 *
 * Chúng chạy SAU khi chấm điểm, và mỗi luật để lại một dòng trong
 * `adjustments` nói nó đã làm gì. Đó không phải trang trí: §22 đòi admin trả
 * lời được "vì sao thẻ này thắng", và một luật sửa điểm mà không để lại dấu
 * vết chính là thứ §17 gọi là "arbitrary hidden score modification".
 *
 * Ba luật KHÔNG nằm trong file này, và chỗ chúng nằm là một phần của thiết kế:
 *
 *   Rule 5 (đang giữ thẻ này)  → `normalize.ts` lọc khỏi tập ứng viên. Một thẻ
 *                                đã trong ví không phải một ứng viên bị phạt
 *                                nặng, nó không phải ứng viên.
 *   Rule 7 (affiliate)         → cưỡng chế bằng SỰ VẮNG MẶT. `affiliateAvailable`
 *                                không được đọc ở bất kỳ đâu trong engine, và
 *                                có test đảo giá trị nó trên toàn bộ sản phẩm
 *                                rồi đòi kết quả không đổi một chữ.
 *   Rule 8 (NO_NEW_CARD)       → `rank.ts` dựng nó thành một ứng viên thật.
 */

import { CONCENTRATION_THRESHOLD, tripCoverage } from "./strategies.ts";
import { isFlexibleInPractice } from "./portfolio.ts";
import { activeAt } from "./temporal.ts";
import type { PointsProgramId } from "./types.ts";
import type { CandidateFacts, ScoringContext } from "./scoring/context.ts";
import type { ScoreAdjustment } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/**
 * §17 — điều chỉnh biên tập tối đa ±10%, và mỗi lần phải có `reason_code` +
 * `editor_note`.
 *
 * Hôm nay nó luôn trả 0, vì §15 (`editorial_rules`) cố ý CHƯA làm — §35 không
 * xếp nó vào Phase 1 hay 2, và thêm sau là thêm một entity chứ không phải
 * migrate cái nào. Hàm vẫn tồn tại, có tên và có trần, để ngày luật biên tập
 * xuất hiện thì chỗ áp nó đã có sẵn và đã bị chặn ±10% — chứ không phải một
 * phép nhân ai đó viết thêm vào giữa `rank.ts`.
 */
export const EDITORIAL_CAP = 0.1;

export function editorialAdjustment(): ScoreAdjustment | null {
  return null;
}

export interface RuleInput {
  candidate: CandidateFacts;
  ctx: ScoringContext;
  baseScore: number;
}

export interface RuleOutcome {
  adjustments: ScoreAdjustment[];
  reasonCodes: ReasonCode[];
  warnings: WarningCode[];
}

/** Hệ sinh thái đang chiếm quá ngưỡng §16 Rule 3, hoặc `null`. */
function dominantEcosystem(ctx: ScoringContext): string | null {
  const top = ctx.portfolio.concentration[0];
  if (top === undefined || top.share <= CONCENTRATION_THRESHOLD) return null;
  return top.ecosystem;
}

/**
 * Đồng tiền thẻ này đổ vào hệ sinh thái đang quá tải tới mức nào — 0..1.
 *
 * KHÔNG phải một câu hỏi có/không, và đó là một lỗi đã bắt được trên dữ liệu
 * thật. Membership Rewards® chuyển được sang Aeroplan®, nên phép kiểm có/không
 * phạt một thẻ Amex® nguyên 15% với người đang dồn 100% vào Aeroplan® — trong
 * khi MR còn đi được Avios®, Flying Blue®, Asia Miles® và Bonvoy®, tức nó
 * chính là thứ ĐA DẠNG NHẤT trong bảng. Luật chống tập trung quay ra phạt
 * đúng liều thuốc.
 *
 * Chia cho số đích đi được là cùng một phép chia phân số mà `portfolio.ts`
 * dùng để không đếm trùng: một đồng điểm với tới năm nơi thì nó thuộc về mỗi
 * nơi một phần năm. Thẻ đồng thương hiệu chỉ kiếm đúng đồng tiền đang quá tải
 * vẫn ăn trọn hình phạt, và đó là ca luật này sinh ra để bắt.
 */
function feedShare(
  ctx: ScoringContext,
  programId: PointsProgramId | null,
  ecosystem: string,
): number {
  if (programId === null) return 0;
  if ((programId as string) === ecosystem) return 1;
  const destinations = new Set(
    activeAt(ctx.ix.pathsBySource.get(programId) ?? [], ctx.asOf)
      .filter((path) => path.requiresTier === null)
      .map((path) => path.destinationProgramId as string),
  );
  if (!destinations.has(ecosystem)) return 0;
  return 1 / destinations.size;
}

export function applyRules(input: RuleInput): RuleOutcome {
  const { candidate, ctx } = input;
  const adjustments: ScoreAdjustment[] = [];
  const reasonCodes: ReasonCode[] = [];
  const warnings: WarningCode[] = [];

  /* ---- Rule 1 — đã đủ điểm ---------------------------------------- */
  const need = ctx.goal.tripNeed;
  if (need !== null) {
    const { coverage } = tripCoverage(ctx.state, ctx.ix, ctx.asOf, need);
    if (coverage !== null && coverage >= 1) {
      // Điểm số ĐÃ phản ánh chuyện này ở `points_gap_reduction` (bằng 0 cho
      // mọi thẻ). Phạt thêm ở đây để nhu cầu mở thẻ giảm THẬT, chứ không chỉ
      // giảm tương đối giữa các thẻ với nhau — vì đối thủ thật của chúng lúc
      // này là `NO_NEW_CARD`, và nó được chấm trên một bảng khác.
      adjustments.push({
        rule: "R1_points_already_sufficient",
        delta: -0.1,
        reasonCode: "POINTS_ALREADY_SUFFICIENT",
      });
      reasonCodes.push("POINTS_ALREADY_SUFFICIENT");
      // Hạn điểm KHÔNG nằm trong mô hình V1. Aeroplan® hết hạn sau 18 tháng
      // không hoạt động, nên câu "bạn đã đủ điểm" không được nói như thể số dư
      // là vĩnh viễn.
      warnings.push("POINTS_EXPIRY_NOT_MODELLED");
    }
  }

  /* ---- Rule 2 — đừng chuyển điểm sớm ------------------------------ */
  // Phát biểu ở phía sản phẩm: khi chưa có ý định đặt NGAY, đồng tiền chuyển
  // được đáng hơn đồng tiền đã khoá vào một hãng — vì nó giữ lại quyền quyết
  // định muộn hơn. Chuyến đi đã có ngày khởi hành cụ thể thì lợi thế đó mất,
  // và luật này im lặng.
  const programId = candidate.product.pointsProgramId;
  const bookNow = ctx.goal.trip?.travelStart != null && ctx.goal.trip.flexibility === "low";
  const flexible = programId !== null && isFlexibleInPractice(ctx.ix, programId, ctx.asOf);
  if (flexible && !bookNow) {
    adjustments.push({
      rule: "R2_keep_points_flexible",
      delta: 0.03,
      reasonCode: "FLEXIBLE_CURRENCY_VALUABLE",
    });
    reasonCodes.push("FLEXIBLE_CURRENCY_VALUABLE");
  }

  /* ---- Rule 3 — tập trung danh mục -------------------------------- */
  const dominant = dominantEcosystem(ctx);
  const feeds = dominant === null ? 0 : feedShare(ctx, programId, dominant);
  if (dominant !== null && feeds > 0) {
    const share = ctx.portfolio.concentration[0].share;
    // Tỷ lệ với mức vượt ngưỡng, trần -0.15 — đúng con số §15 lấy làm ví dụ
    // cho một `editorial_rule`, và ở đây nó là một luật CỨNG chứ không phải
    // một dòng dữ liệu ai đó gõ vào. Nhân thêm `feeds`: xem `feedShare`.
    const delta =
      -Math.min(
        0.15,
        (0.15 * (share - CONCENTRATION_THRESHOLD)) / (1 - CONCENTRATION_THRESHOLD),
      ) * feeds;
    adjustments.push({
      rule: "R3_portfolio_concentration",
      delta,
      reasonCode: "PORTFOLIO_CONCENTRATED",
    });
    reasonCodes.push("PORTFOLIO_CONCENTRATED");
  }

  /* ---- Rule 4 — áp lực mốc chi ------------------------------------ */
  const fit = candidate.suitability.minSpendFit;
  if (fit !== null && fit < 0.4) {
    // §13: "may remain a candidate but receive strong penalty + warning". Cả
    // hai vế, không chỉ vế phạt — người đọc phải biết vì sao một thẻ tốt lại
    // nằm dưới.
    adjustments.push({
      rule: "R4_minimum_spend_pressure",
      delta: -0.25 * (1 - fit),
      reasonCode: "MIN_SPEND_TOO_HIGH",
    });
  }

  /* ---- Rule 6 — quyền lợi trùng ----------------------------------- */
  const { duplicatedCount, incrementalCount, totalCount } = candidate.benefits;
  if (duplicatedCount > 0 && totalCount > 0) {
    const duplicatedShare = duplicatedCount / totalCount;
    // Chỉ phạt khi phần TRÙNG áp đảo. Một thẻ có mười quyền lợi và trùng một
    // cái vẫn là một thẻ mới; phạt nó là chấm lại cùng một thứ hai lần, vì
    // `benefit-fit.ts` đã bỏ phần trùng ra khỏi điểm quyền lợi rồi.
    if (duplicatedShare >= 0.5 && incrementalCount <= 2) {
      adjustments.push({
        rule: "R6_duplicate_benefits",
        delta: -0.08 * duplicatedShare,
        reasonCode: "LOW_INCREMENTAL_VALUE",
      });
      reasonCodes.push("LOW_INCREMENTAL_VALUE");
    }
  }

  /* ---- Phù hợp (§14) ---------------------------------------------- */
  if (candidate.suitability.penalty < 1) {
    adjustments.push({
      rule: "S_suitability_penalty",
      // Hệ số nhân thành một số cộng, để mọi dòng trong bảng §19 cùng đơn vị.
      // Bảng trộn cộng với nhân là bảng không cộng lại ra điểm cuối được.
      delta: -(input.baseScore * (1 - candidate.suitability.penalty)),
      reasonCode: null,
    });
  }

  /* ---- Điều kiện chưa chắc chắn (§14) ----------------------------- */
  if (candidate.eligibility.status === "unknown") {
    // KHÔNG loại. Khoảng thu nhập bắc qua ngưỡng bao trùm đúng những người vế
    // hộ gia đình sinh ra để nhận, và loại họ ở đây là biến một chỗ chưa biết
    // thành một câu trả lời "không".
    adjustments.push({
      rule: "E_eligibility_uncertain",
      delta: -0.05,
      reasonCode: "ELIGIBILITY_UNCERTAIN",
    });
  }

  /* ---- Welcome bonus bị chặn -------------------------------------- */
  if (candidate.eligibility.welcomeOfferBlocked) {
    // Thẻ vẫn mở được và vẫn kiếm điểm, nên không loại. Nhưng phần lớn giá trị
    // ngắn hạn của nó vừa biến mất, và điểm phải nói ra điều đó.
    adjustments.push({
      rule: "E_welcome_offer_blocked",
      delta: -0.15,
      reasonCode: "WELCOME_BONUS_UNAVAILABLE",
    });
  }

  const editorial = editorialAdjustment();
  if (editorial !== null) {
    adjustments.push({
      ...editorial,
      delta: Math.max(-EDITORIAL_CAP, Math.min(EDITORIAL_CAP, editorial.delta)),
    });
  }

  return { adjustments, reasonCodes, warnings };
}
