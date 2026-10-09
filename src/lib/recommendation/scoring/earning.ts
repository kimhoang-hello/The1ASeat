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

import { currencyFitComponent, earnFitComponent, offerQualityComponent, spendFitComponent } from "./shared.ts";
import { component } from "./weights.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

export function scoreEarning(
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  // Phí so với phần thẻ này THÊM VÀO ví đang giữ — thứ phí phải trả cho
  // (`addedEarnFor`). Thẻ chưa tính được giá trị tích điểm — người dùng chưa
  // khai chi tiêu nào — thì 0.5 trung tính, không phải 0: cho 0 là phạt mọi thẻ
  // có phí vì một câu chưa ai hỏi. Còn tính ĐƯỢC mà thẻ không thêm gì (ví đã
  // kiếm bằng hoặc hơn) thì phí không bù được bằng gì: 0, trừ thẻ không phí.
  const computable = candidate.earn.annualValueCents > 0;
  const annual = candidate.earn.addedValueCents;
  const fee = candidate.offer.ongoingFeeCents;
  const feeDrag = !computable ? 0.5 : annual <= 0 ? (fee > 0 ? 0 : 1) : Math.max(0, 1 - fee / annual);
  const extra = annual === candidate.earn.annualValueCents ? "" : " thêm so với thẻ đang giữ";

  return [
    earnFitComponent(0.4, candidate, ctx),
    currencyFitComponent(0.2, candidate, ctx),
    offerQualityComponent(0.15, candidate, ctx),
    spendFitComponent(0.1, candidate, ctx),
    component(
      "fee_drag",
      0.1,
      feeDrag,
      !computable
        ? "chưa tính được phần tích mỗi năm — 0.5 trung tính"
        : annual <= 0
          ? fee > 0
            ? "ví đang giữ đã kiếm bằng hoặc hơn thẻ này — phí không bù được bằng gì"
            : "không thêm được gì so với ví, nhưng không phí"
          : `1 − phí $${Math.round(fee / 100)} ÷ tích${extra} $${Math.round(annual / 100)}/năm`,
    ),
  ];
}
