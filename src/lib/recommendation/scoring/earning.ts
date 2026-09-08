/**
 * §10 `score_card_for_earning()` — "tôi muốn tích điểm", không nói để làm gì.
 *
 * **TRỌNG SỐ Ở ĐÂY LÀ LỰA CHỌN CỦA ENGINE, KHÔNG PHẢI CỦA SPEC.** §10 liệt kê
 * hàm này nhưng chỉ cho bảng trọng số của ba ý định kia. Nói ra chỗ đó thay vì
 * để nó trông giống ba bảng có nguồn:
 *
 * ```
 * 40% Long-term Earn Fit    ← ý định này CHÍNH LÀ tích điểm dài hạn
 * 20% Currency Fit          ← có đồng tiền đích thì nó là tất cả
 * 15% Offer Quality
 * 10% Spend Fit
 * 10% Fee Drag              ← phí ăn mất bao nhiêu phần tích được mỗi năm
 *  5% Editorial Adjustment  ← §15 chưa làm, áp ở `rules.ts`
 * ```
 *
 * `fee_drag` chỉ có ở bảng này, và có lý do: ba ý định kia đều xoay quanh một
 * sự kiện một lần (mở thẻ, lấy bonus, cân lại danh mục), còn ý định này là một
 * dòng chảy hằng năm — và một khoản phí $699 ăn hết phần tích được là câu trả
 * lời cho chính câu hỏi đang hỏi. Ở `next-card.ts` phí đã được tính trong
 * `offer_quality` và trong `suitability.penalty`, nên cộng thêm ở đó là phạt
 * hai lần.
 */

import { bestCurrencyNeedVia } from "../needs.ts";
import { offerQualityScore } from "../offer-quality.ts";
import { component, relativeTo } from "./weights.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

export function scoreEarning(
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  const annual = candidate.earn.annualValueCents;
  // Phí so với chính phần tích được. Thẻ chưa tính được giá trị tích điểm —
  // người dùng chưa khai chi tiêu nào — thì 0.5 trung tính, không phải 0: cho
  // 0 là phạt mọi thẻ có phí vì một câu chưa ai hỏi.
  const feeDrag =
    annual <= 0 ? 0.5 : Math.max(0, 1 - candidate.offer.ongoingFeeCents / annual);

  return [
    component(
      "long_term_earn_fit",
      0.4,
      relativeTo(annual, ctx.scale.maxEarnAnnualCents),
      "giá trị tích điểm một năm trên chi tiêu đã khai",
    ),
    component(
      "currency_fit",
      0.2,
      bestCurrencyNeedVia(ctx.needs, ctx.ix, candidate.product.pointsProgramId, ctx.asOf),
      "nhu cầu đồng tiền, kể cả qua chặng chuyển",
    ),
    component("offer_quality", 0.15, offerQualityScore(candidate.offer, ctx.climate), "§11"),
    component("spend_fit", 0.1, candidate.suitability.minSpendFit ?? 0.5, "§13"),
    component("fee_drag", 0.1, feeDrag, "phí thường niên so với phần tích được mỗi năm"),
  ];
}
