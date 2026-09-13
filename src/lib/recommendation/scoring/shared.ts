/**
 * Thành phần xuất hiện ở NHIỀU bảng §10 — một hàm cho mỗi khái niệm.
 *
 * `spend_fit`, `long_term_earn_fit`, `currency_fit` và `offer_quality` từng
 * được dựng riêng ở từng bảng: cùng khoá, cùng phép tính, mà bốn ghi chú khác
 * nhau ("§13", "§13 mốc chi so với sức dồn 3 tháng", ...) và không ghi chú nào
 * mang con số đầu vào. Bảng điểm §19 là thứ admin đọc để trả lời "vì sao thẻ
 * này thắng", nên một dòng `raw=0.636` mà không dựng lại được từ chính dòng đó
 * là một phép biến đổi chạy ngầm (vòng rà Phase 4).
 *
 * Mỗi hàm ở đây giữ NGUYÊN phép tính cũ — chỉ thêm lời kể.
 */

import { bestCurrencyNeedDetail } from "../needs.ts";
import { offerQuality } from "../offer-quality.ts";
import { component, relativeTo } from "./weights.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

/**
 * §11 cho thẻ NÀY, với người dùng NÀY: bonus bị chặn thì không có gì để chấm,
 * bonus chưa chắc thì một nửa.
 *
 * Bản trước chấm §11 như nhau cho mọi người rồi trừ một mức CỐ ĐỊNH ở
 * `rules.ts` (−0.15 bị chặn). Mức cố định không đổi theo cỡ bonus, nên cỡ của
 * một bonus người dùng KHÔNG nhận được vẫn xếp hạng thẻ: đổi bonus bị chặn
 * của Amex® Gold từ 1 lên 1,000,000 điểm đưa nó từ hạng 20 lên hạng 1 (vòng
 * Codex 20). Mất bonus nay đo ở chính chỗ đọc bonus — đây và
 * `points_gap_reduction` — và mức phạt cố định bỏ đi.
 */
export function offerQualityComponent(weight: number, candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent {
  const offer = offerQuality(candidate.offer, ctx.climate);
  if (candidate.eligibility.welcomeOfferBlocked) {
    return component("offer_quality", weight, 0, "§11: welcome bonus BỊ CHẶN với người dùng này — không có gì để chấm");
  }
  if (candidate.eligibility.welcomeOfferUncertain) {
    return component(
      "offer_quality",
      weight,
      offer.score / 2,
      `${offer.note} — chưa chắc nhận được bonus: tính MỘT NỬA (${(offer.score / 2).toFixed(3)})`,
    );
  }
  return component("offer_quality", weight, offer.score, offer.note);
}

/**
 * §13. Chưa biết sức dồn chi tiêu thì 0.5 — TRUNG TÍNH, không phải 0 và không
 * phải 1. Cho 0 là phạt người chưa trả lời một câu hỏi; cho 1 là hứa thẻ vừa
 * sức trong khi chưa ai biết.
 */
export function spendFitComponent(weight: number, candidate: CandidateFacts): ScoreComponent {
  const fit = candidate.suitability.minSpendFit;
  const note =
    fit !== null
      ? `§13 mốc chi so với sức dồn 3 tháng: ${fit.toFixed(2)}`
      : candidate.offer.termsUnknown
        ? "§13 điều khoản offer chưa biết — 0.5 trung tính"
        : "§13 chưa biết sức dồn chi tiêu — 0.5 trung tính";
  return component("spend_fit", weight, fit ?? 0.5, note);
}

export function earnFitComponent(weight: number, candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent {
  const annual = candidate.earn.annualValueCents;
  const max = ctx.scale.maxEarnAnnualCents;
  return component(
    "long_term_earn_fit",
    weight,
    relativeTo(annual, max),
    max <= 0
      ? "chưa tính được giá trị tích điểm của thẻ nào (chưa khai chi tiêu)"
      : `tích ${dollars(annual)}/năm ÷ cao nhất tập ứng viên ${dollars(max)}`,
  );
}

export function currencyFitComponent(weight: number, candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent {
  const programId = candidate.product.pointsProgramId;
  const detail = bestCurrencyNeedDetail(ctx.needs, ctx.ix, programId, ctx.asOf);
  return component(
    "currency_fit",
    weight,
    detail.need,
    programId === null
      ? "thẻ không kiếm đồng tiền nào"
      : detail.via === null
        ? `nhu cầu ${programId} ${detail.need.toFixed(2)}`
        : `nhu cầu ${detail.via} × 0.85 qua chặng chuyển từ ${programId} = ${detail.need.toFixed(2)}`,
  );
}
