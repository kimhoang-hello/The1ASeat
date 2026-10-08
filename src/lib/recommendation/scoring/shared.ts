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
import { spendFitIfBonus } from "../suitability.ts";
import { component, relativeTo } from "./weights.ts";
import type { ScoreComponent } from "../engine-types.ts";
import { valuationModeFor } from "./context.ts";
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
  // Đo bằng thước của MỤC TIÊU — cùng luật với `earnFitComponent`. Mục tiêu
  // `cash` đọc bonus đã quy ra tiền mặt, và đọc luôn thị trường offer đo bằng
  // tiền mặt: so một offer tính theo tiền với mốc "offer lớn nhất" tính theo
  // giá đổi vé là chia hai đơn vị khác nhau.
  const cash = valuationModeFor(ctx.goal) === "cash";
  const offer = cash
    ? offerQuality(candidate.offerCash, ctx.climateCash)
    : offerQuality(candidate.offer, ctx.climate);
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
 *
 * Biết sức dồn thì §13 (`minSpendFit`) được cân theo PHẦN ĐẶT CƯỢC:
 * `0.5 + (fit − 0.5) × stake`. Vế này nặng 10–20% vì mốc chi quyết định người
 * dùng có LẤY ĐƯỢC bonus không — mà lấy được một bonus nhỏ không đáng bằng lấy
 * được một bonus lớn. Bản trước cho trọn 1.0 bất kể cỡ bonus, nên Amex® Green
 * (10,000 điểm, mốc $1,000) hơn TD® Aeroplan® Visa Infinite* (50,000 điểm)
 * đúng nhờ vế này và đứng đầu 6/16 nhân vật mẫu (07/10/2026). Stake 1 (phần bị
 * khoá từ cỡ trung vị thị trường trở lên) giữ nguyên phép tính cũ; stake 0
 * (không có gì đứng sau mốc chi, hoặc bonus bị chặn) về 0.5 trung tính — không
 * có gì để lấy thì "vừa sức" không khen được gì, mà cũng không phạt.
 *
 * Bonus CHƯA CHẮC: điểm giữa của hai thế giới, tính MỘT lần — thế giới nhận
 * được bonus (như trên) và thế giới bị chặn (0.5). `minSpendFit` đã là điểm
 * giữa theo quy ước cũ (thế giới bị chặn = 1, xem `uncertainSpendFit`), nên
 * tách lại `fit` của thế giới có bonus trước. Bản đầu 07/10 nhân stake thêm 0.5
 * trên chính con số đã trộn — tính chưa chắc hai lần: Amex® Gold với sức dồn
 * $500 ra 0.5 thay vì 0.25 (Codex).
 */
export function spendFitComponent(weight: number, candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent {
  const fit = candidate.suitability.minSpendFit;
  if (fit === null) {
    const note = candidate.eligibility.welcomeOfferBlocked
      ? "§13 bonus bị chặn, chưa biết sức dồn — 0.5 trung tính như mọi thẻ"
      : candidate.offer.termsUnknown
        ? "§13 điều khoản offer chưa biết — 0.5 trung tính"
        : "§13 chưa biết sức dồn chi tiêu — 0.5 trung tính";
    return component("spend_fit", weight, 0.5, note);
  }
  const stake = spendStake(candidate, ctx);
  const uncertain = !candidate.eligibility.welcomeOfferBlocked && candidate.eligibility.welcomeOfferUncertain === true;
  const fitIfBonus = uncertain ? spendFitIfBonus(fit) : fit;
  const withBonus = 0.5 + (fitIfBonus - 0.5) * stake.value;
  const raw = uncertain ? (withBonus + 0.5) / 2 : withBonus;
  return component(
    "spend_fit",
    weight,
    raw,
    `§13 mốc chi so với sức dồn 3 tháng: ${fitIfBonus.toFixed(2)} · ${stake.note} → ` +
      `0.5 + (${fitIfBonus.toFixed(2)} − 0.5) × ${stake.value.toFixed(2)} = ${withBonus.toFixed(3)}` +
      (uncertain ? ` · chưa chắc nhận được bonus: điểm giữa với 0.5 = ${raw.toFixed(3)}` : ""),
  );
}

/**
 * Phần đặt cược 0..1: giá trị phần BỊ MỐC CHI KHOÁ (`gatedValueCents`) so với
 * trung vị của chính phần đó trên thị trường của người này
 * (`climate.medianGatedValueCents`), cắt ở 1. Không đo bằng toàn bộ offer:
 * RBC® Avion® có 50,000/70,000 điểm nhận không cần chi, nên người dồn $1,000 mà
 * trượt mốc chi vẫn giữ phần lớn offer — đo bằng toàn bộ là phạt như mất cả
 * offer (Codex). Đo bằng thước của MỤC TIÊU, cùng luật với `offerQualityComponent`.
 *
 * Hai thứ trông như nhau mà khác hẳn: offer KHÔNG có thành phần nào để định giá
 * (Capital One® Quicksilver: match cashback năm đầu, `components: []`) là chưa
 * biết → giữ stake 1, không phạt chồng lên §11 vốn đã chấm thấp vì thiếu mô
 * hình; còn phần bị khoá BẰNG $0 là câu trả lời đã biết (bonus Aeroplan® với
 * mục tiêu rút tiền mặt) → stake 0. Bản đầu gộp hai ca vào stake 1 (Codex).
 */
function spendStake(candidate: CandidateFacts, ctx: ScoringContext): { value: number; note: string } {
  if (candidate.eligibility.welcomeOfferBlocked) return { value: 0, note: "bonus bị chặn — không có gì đặt cược" };
  const cash = valuationModeFor(ctx.goal) === "cash";
  const offer = cash ? candidate.offerCash : candidate.offer;
  if (offer.active === null || offer.active.offer.bonusKind === "none") {
    return { value: 0, note: "không có welcome bonus — không có gì đặt cược" };
  }
  if (offer.active.components.length === 0) {
    return { value: 1, note: "offer chưa có thành phần nào để định giá — giữ trọn §13" };
  }
  const gated = offer.gatedValueCents ?? 0;
  if (gated <= 0) {
    return { value: 0, note: "phần thưởng đứng sau mốc chi bằng $0 theo thước của mục tiêu — không có gì đặt cược" };
  }
  const median = (cash ? ctx.climateCash : ctx.climate).medianGatedValueCents;
  if (median === null || median <= 0) {
    return { value: 1, note: "thị trường chưa có mốc so — giữ trọn §13" };
  }
  return {
    value: Math.min(1, gated / median),
    note: `đặt cược: phần bị mốc chi khoá ${dollars(gated)} ÷ trung vị thị trường ${dollars(median)}`,
  };
}

/**
 * Giá trị tích điểm một năm, so với thẻ cao nhất trong tập ứng viên.
 *
 * ĐO BẰNG ĐỒNG TIỀN NÀO là do mục tiêu quyết định (`valuationModeFor`): mục
 * tiêu "quy điểm ra tiền" đọc cột tiền mặt, mọi mục tiêu khác đọc cột giá trị
 * cao nhất. Không tách thành hai hàm vì đây vẫn là MỘT khái niệm — "thẻ này
 * tích được bao nhiêu mỗi năm" — chỉ khác ở chỗ tính bằng thước nào; hai hàm
 * là hai chỗ để trôi khỏi nhau.
 */
export function earnFitComponent(weight: number, candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent {
  const cash = valuationModeFor(ctx.goal) === "cash";
  const annual = (cash ? candidate.earnCash : candidate.earn).annualValueCents;
  const max = cash ? ctx.scale.maxEarnCashCents : ctx.scale.maxEarnAnnualCents;
  const unit = cash ? " rút ra tiền" : "";
  return component(
    "long_term_earn_fit",
    weight,
    relativeTo(annual, max),
    max <= 0
      ? cash
        ? "không thẻ nào trong tập ứng viên tích ra đồng điểm rút được tiền (hoặc chưa khai chi tiêu)"
        : "chưa tính được giá trị tích điểm của thẻ nào (chưa khai chi tiêu)"
      : `tích${unit} ${dollars(annual)}/năm ÷ cao nhất tập ứng viên ${dollars(max)}`,
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
