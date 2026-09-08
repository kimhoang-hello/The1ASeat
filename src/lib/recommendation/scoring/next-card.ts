/**
 * §10.1 — "thẻ tiếp theo nên là gì", không gắn với một chuyến đi nào.
 *
 * ```
 * 25% Current Offer Quality
 * 20% Spend Fit
 * 15% Long-term Earn Fit
 * 15% Currency Fit
 * 10% Benefits Fit
 * 10% Portfolio Diversification
 *  5% Ghế 1A Editorial Adjustment   ← §15 chưa làm, áp ở `rules.ts`
 * ```
 *
 * Đây là ý định "rộng" nhất, và cách nó khác `trip.ts` nói lên toàn bộ lý do
 * §10 cấm một hàm vạn năng: ở đây `spend_fit` nặng 20% vì mốc chi là thứ quyết
 * định người dùng có LẤY ĐƯỢC bonus không; ở mục tiêu chuyến đi nó chỉ 10%, vì
 * lúc đó câu hỏi lớn hơn là bonus có ĐÚNG ĐỒNG TIỀN không.
 */

import { bestCurrencyNeedVia } from "../needs.ts";
import { centsPerPoint } from "../portfolio.ts";
import { offerQualityScore } from "../offer-quality.ts";
import { component, relativeTo } from "./weights.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

/**
 * Tỷ trọng giá trị người dùng đang có ở đồng tiền của thẻ này.
 *
 * `direct`, không phải `accessible` — xem `needs.ts`. Thẻ mở ra một đồng tiền
 * mới thì tỷ trọng bằng 0, và thành phần đa dạng hoá đạt tối đa.
 */
function existingShare(candidate: CandidateFacts, ctx: ScoringContext): number {
  const programId = candidate.product.pointsProgramId;
  if (programId === null || ctx.portfolio.knownValueCents <= 0) return 0;
  const entry = ctx.portfolio.direct.get(programId);
  if (entry === undefined || entry.kind !== "known") return 0;
  const cpp = centsPerPoint(ctx.ix, programId, ctx.asOf);
  if (cpp === null) return 0;
  return Math.min(1, (entry.points * cpp) / ctx.portfolio.knownValueCents);
}

/** Quyền lợi thành một số 0..1: tiền thật nặng hơn số lượng, vì tiền đo được. */
export function benefitsRaw(candidate: CandidateFacts, ctx: ScoringContext): number {
  const cash = relativeTo(candidate.benefits.incrementalCashCents, ctx.scale.maxBenefitCashCents);
  const count = relativeTo(candidate.benefits.incrementalCount, ctx.scale.maxBenefitCount);
  return 0.6 * cash + 0.4 * count;
}

export function scoreNextCard(
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  const offerRaw = offerQualityScore(candidate.offer, ctx.climate);

  // Chưa biết sức dồn chi tiêu thì 0.5 — TRUNG TÍNH, không phải 0 và không
  // phải 1. Cho 0 là phạt người chưa trả lời một câu hỏi; cho 1 là hứa thẻ vừa
  // sức trong khi chưa ai biết. Chỗ trống này đi thẳng vào §30 dưới dạng câu
  // hỏi tiếp theo, và vào §29 dưới dạng độ tin cậy thấp hơn.
  const spendRaw = candidate.suitability.minSpendFit ?? 0.5;

  const earnRaw = relativeTo(candidate.earn.annualValueCents, ctx.scale.maxEarnAnnualCents);

  const currencyRaw = bestCurrencyNeedVia(
    ctx.needs,
    ctx.ix,
    candidate.product.pointsProgramId,
    ctx.asOf,
  );

  // Nhu cầu đa dạng hoá của DANH MỤC nhân với việc thẻ này có mở ra chỗ mới
  // không. Nhân chứ không cộng: một thẻ mở ra đồng tiền mới cho người đã cân
  // bằng sẵn thì không giải quyết vấn đề gì, và một thẻ trùng đồng tiền cho
  // người tập trung 90% thì càng không.
  const diversificationRaw =
    (1 - existingShare(candidate, ctx)) *
    (0.5 + 0.5 * ctx.needs.portfolio.diversification);

  return [
    component("offer_quality", 0.25, offerRaw, "§11 offer quality trên tập ứng viên hôm nay"),
    component("spend_fit", 0.2, spendRaw, "§13 mốc chi so với sức dồn 3 tháng"),
    component("long_term_earn_fit", 0.15, earnRaw, "giá trị tích điểm một năm trên chi tiêu đã khai"),
    component("currency_fit", 0.15, currencyRaw, "nhu cầu đồng tiền, kể cả qua chặng chuyển"),
    component("benefits_fit", 0.1, benefitsRaw(candidate, ctx), "quyền lợi TĂNG THÊM (§16 Rule 6)"),
    component("diversification", 0.1, diversificationRaw, "mở ra chỗ mới × nhu cầu đa dạng hoá"),
  ];
}
