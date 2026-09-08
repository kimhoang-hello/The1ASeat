/**
 * §18 Recommendation Output + §16 Rule 8.
 *
 * `NO_NEW_CARD` là một ỨNG VIÊN THẬT, được chấm trên bảng của riêng nó và xếp
 * chung một danh sách với các thẻ. Đó là khác biệt giữa "engine không tìm được
 * thẻ nào" và "engine kết luận bạn chưa cần thẻ nào" — hai câu nghe giống nhau
 * mà chỉ câu thứ hai là một khuyến nghị.
 *
 * BẢNG ĐIỂM CỦA `NO_NEW_CARD` (trọng số là lựa chọn của engine — spec đòi ứng
 * viên này tồn tại nhưng không cho bảng):
 *
 * ```
 * 30% Points Already Sufficient   — đã đủ điểm cho việc đang muốn làm
 * 25% Portfolio Already Covers    — thẻ đang giữ đã phục vụ nhu cầu đó
 * 20% No Reachable Candidate      — phần lớn ứng viên bị điều kiện hoặc mốc chi loại
 * 25% Offer Climate Weak          — cả thị trường đang ở vùng thấp, chờ thì hơn
 * ```
 *
 * BA CHỖ SO SÁNH ĐƯỢC. Điểm thẻ và điểm `NO_NEW_CARD` đều nằm trên thang 0..1
 * sau khi chia cho tổng trọng số, nên chúng đứng chung bảng được. Nhưng chúng
 * ĐO HAI THỨ KHÁC NHAU, và không có phép chuẩn hoá nào xoá được điều đó — mọi
 * cách chấm `NO_NEW_CARD` đều là một lựa chọn mô hình. Nói ra ở đây thay vì để
 * nó trông như một sự thật rút ra từ spec.
 */

import { clamp01 } from "./offer-quality.ts";
import { tripCoverage } from "./strategies.ts";
import { component, assembleScore } from "./scoring/weights.ts";
import { earnFitFor } from "./earn-fit.ts";
import { activeAt } from "./temporal.ts";
import type { PointsProgramId } from "./types.ts";
import type { CandidateFacts, ScoringContext } from "./scoring/context.ts";
import type { Candidate, ScoreComponent } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/**
 * Phần giá trị tích điểm hằng năm mà VÍ HIỆN TẠI đã lo được.
 *
 * Đây là câu hỏi "bạn có cần thêm thẻ không" ở dạng đo được: nếu những thẻ
 * đang giữ đã kiếm gần bằng thẻ tốt nhất còn lại, thì thẻ mới thêm rất ít.
 *
 * Nó THAY cho phép đo cũ, thứ hỏi "người này có điểm ở chương trình cần nhất
 * không" — một câu hỏi tự mâu thuẫn với mọi mục tiêu không phải chuyến đi:
 * `needs.currency` tỷ lệ NGHỊCH với những gì người dùng đang có, nên "chương
 * trình cần nhất" theo định nghĩa là chương trình họ KHÔNG có, và phép đo
 * luôn trả về ~0. Tệ hơn, hàng chục chương trình hoà nhau ở cùng một mức nhu
 * cầu, và phép phá hoà theo `id` chọn ra `a-la-carte` — một đồng tiền cố định
 * chẳng liên quan — rồi để nó quyết định 55% điểm của `NO_NEW_CARD`.
 */
function walletEarnCoverage(
  candidates: readonly CandidateFacts[],
  ctx: ScoringContext,
): { raw: number; note: string } {
  let bestHeld = 0;
  for (const product of ctx.portfolio.heldProducts) {
    bestHeld = Math.max(bestHeld, earnFitFor(product.id, ctx.state.spend, ctx.ix, ctx.asOf).annualValueCents);
  }
  let bestNew = 0;
  for (const candidate of candidates) bestNew = Math.max(bestNew, candidate.earn.annualValueCents);

  if (ctx.portfolio.heldProducts.length === 0) {
    return { raw: 0, note: "chưa giữ thẻ nào, nên ví hiện tại không lo được gì" };
  }
  if (bestNew <= 0) {
    // Không tính được giá trị tích điểm của bất kỳ thẻ nào (người dùng chưa
    // khai chi tiêu). Chưa biết, không phải bằng không.
    return { raw: 0.5, note: "chưa khai chi tiêu nên không so được ví hiện tại với thẻ mới" };
  }
  const raw = Math.min(1, bestHeld / bestNew);
  return {
    raw,
    note: `thẻ đang giữ kiếm được ${Math.round(raw * 100)}% so với thẻ tốt nhất còn lại`,
  };
}

/** Ví hiện tại đã phục vụ đồng tiền của CHUYẾN ĐI chưa. */
function tripCurrencyCoverage(
  neededPrograms: readonly PointsProgramId[],
  ctx: ScoringContext,
): { raw: number; note: string } {
  if (ctx.portfolio.heldProducts.length === 0) {
    return { raw: 0, note: "chưa giữ thẻ nào" };
  }
  const servesDirectly = neededPrograms.some((programId) =>
    ctx.portfolio.earnedPrograms.has(programId),
  );
  if (servesDirectly) return { raw: 1, note: "thẻ đang giữ kiếm thẳng đồng tiền đặt được chặng này" };
  const servesViaTransfer = [...ctx.portfolio.earnedPrograms].some((earned) =>
    activeAt(ctx.ix.pathsBySource.get(earned) ?? [], ctx.asOf).some(
      (path) =>
        path.requiresTier === null &&
        neededPrograms.includes(path.destinationProgramId as PointsProgramId),
    ),
  );
  return servesViaTransfer
    ? { raw: 0.8, note: "thẻ đang giữ kiếm đồng tiền chuyển được sang chương trình đặt chặng" }
    : { raw: 0.2, note: "thẻ đang giữ không phục vụ chặng này" };
}

export function buildNoNewCardCandidate(
  candidates: readonly CandidateFacts[],
  ctx: ScoringContext,
): Candidate {
  const reasonCodes: ReasonCode[] = [];
  const warnings: WarningCode[] = [];
  const need = ctx.goal.tripNeed;

  /* ---- Đã đủ điểm ------------------------------------------------- */
  const components: ScoreComponent[] = [];
  const tripCovered = need === null ? null : tripCoverage(ctx.state, ctx.ix, ctx.asOf, need);
  const pricedTrip = tripCovered !== null && tripCovered.coverage !== null;

  if (pricedTrip) {
    const sufficiency = tripCovered.coverage as number;
    components.push(
      component(
        "points_already_sufficient",
        0.3,
        sufficiency,
        `${Math.round(sufficiency * 100)}% cận trên của khoảng điểm chuyến đi`,
      ),
    );
    if (sufficiency >= 1) {
      reasonCodes.push("POINTS_ALREADY_SUFFICIENT");
      // Cảnh báo này PHẢI nằm trên chính ứng viên này, không chỉ trên các thẻ
      // mà `rules.ts` Rule 1 phạt. Lượt chạy chỉ giữ cảnh báo của ứng viên
      // THẮNG — nên đặt nó ở đâu khác thì đúng vào lúc engine tuyên bố "bạn
      // đã đủ điểm rồi", câu cảnh báo đi kèm biến mất. Hạn điểm không nằm
      // trong mô hình V1: Aeroplan® hết hạn sau 18 tháng không hoạt động.
      warnings.push("POINTS_EXPIRY_NOT_MODELLED");
    }
  }
  /*
   * KHÔNG có chuyến đi định giá được thì "đã đủ điểm" là một câu KHÔNG ĐẶT RA
   * ĐƯỢC — và cách đúng để xử lý một thành phần không áp dụng là BỎ HẲN dòng
   * đó, không phải điền một con số. `assembleScore` chia cho tổng trọng số
   * thật có mặt, nên ba thành phần còn lại tự chuẩn hoá lại; bảng §19 in ra ba
   * dòng, và không ai phải giải thích một số 0 vô nghĩa.
   */
  if (false) {
    // Không có mục tiêu chuyến đi (hoặc chưa tra được giá) thì vế tương đương
    // là: người này đã có sẵn bao nhiêu ở đúng chỗ họ đang cần. KHÔNG dùng
    // `accessible` — cộng điểm tiếp cận được của nhiều chương trình là đúng
    // phép đếm trùng §7 cấm.
    /* không dùng nữa — xem chú thích trên */
  }

  /* ---- Ví hiện tại đã lo được đến đâu ------------------------------ */
  //
  // Hai câu hỏi khác nhau cho hai tình huống khác nhau — và trước đây cả hai
  // đều đi qua `topCurrencyNeed`, thứ chỉ có nghĩa khi chuyến đi định giá được.
  const covers = pricedTrip
    ? tripCurrencyCoverage(need?.programs ?? [], ctx)
    : walletEarnCoverage(candidates, ctx);

  /* ---- Còn ứng viên nào với tới được không ------------------------ */
  const usable = candidates.filter(
    (row) =>
      !row.suitability.excluded &&
      row.eligibility.status !== "ineligible" &&
      (row.suitability.minSpendFit === null || row.suitability.minSpendFit > 0.2),
  );
  const blockedShare =
    candidates.length === 0 ? 1 : 1 - usable.length / candidates.length;

  /* ---- Thị trường offer ------------------------------------------- */
  const climateWeak =
    ctx.climate.medianPercentile === null ? 0.5 : clamp01(1 - ctx.climate.medianPercentile / 100);
  if (climateWeak >= 0.7) reasonCodes.push("WAIT_FOR_BETTER_OFFER");

  components.push(
    component("portfolio_already_covers", 0.25, covers.raw, covers.note),
    component(
      "no_reachable_candidate",
      0.2,
      blockedShare,
      `${Math.round(blockedShare * 100)}% ứng viên bị điều kiện hoặc mốc chi chặn`,
    ),
    component("offer_climate_weak", 0.25, climateWeak, "percentile trung vị của các offer đang chạy"),
  );

  const score = assembleScore(components);
  if (score >= 0.5) reasonCodes.push("NO_NEW_CARD_NEEDED");

  return {
    kind: "no_new_card",
    productId: null,
    productSlug: null,
    productName: null,
    score,
    baseScore: score,
    components,
    adjustments: [],
    reasonCodes,
    warnings,
    eligibility: null,
    suitability: null,
  };
}

/**
 * Xếp hạng cuối.
 *
 * Phá hoà bằng `productId` chứ không giữ nguyên thứ tự mảng: mảng ứng viên đến
 * từ `datasetAt`, và hai thẻ bằng điểm nhau tới từng phần nghìn là chuyện có
 * thật khi chúng cùng một họ. `NO_NEW_CARD` không có `productId`, và khi nó
 * hoà với một thẻ thì nó THUA — "không làm gì" chỉ nên thắng khi nó thắng
 * thật.
 */
export function rankCandidates(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.kind !== b.kind) return a.kind === "no_new_card" ? 1 : -1;
    const aid = a.productId ?? "";
    const bid = b.productId ?? "";
    return aid < bid ? -1 : aid > bid ? 1 : 0;
  });
}

/** Điểm cuối = điểm nền + mọi điều chỉnh, kẹp về [0,1]. */
export function finalScore(baseScore: number, adjustments: readonly { delta: number }[]): number {
  return clamp01(baseScore + adjustments.reduce((sum, row) => sum + row.delta, 0));
}
