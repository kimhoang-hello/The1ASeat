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
import { activeAt } from "./temporal.ts";
import type { PointsProgramId } from "./types.ts";
import type { CandidateFacts, ScoringContext } from "./scoring/context.ts";
import type { Candidate, ScoreComponent } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/** Nhu cầu đồng tiền lớn nhất, và phần nhu cầu đó đã được phục vụ sẵn. */
function topCurrencyNeed(ctx: ScoringContext): { programId: PointsProgramId | null; need: number } {
  let programId: PointsProgramId | null = null;
  let need = 0;
  // Sắp theo id trước khi so: `Map` giữ thứ tự chèn, tức thứ tự mảng
  // `pointsPrograms`, và hai chương trình cùng nhu cầu sẽ đổi người thắng khi
  // ai đó sắp lại file seed.
  for (const [candidateId, value] of [...ctx.needs.currency].sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  )) {
    if (value > need) {
      need = value;
      programId = candidateId;
    }
  }
  return { programId, need };
}

export function buildNoNewCardCandidate(
  candidates: readonly CandidateFacts[],
  ctx: ScoringContext,
): Candidate {
  const reasonCodes: ReasonCode[] = [];
  const warnings: WarningCode[] = [];
  const need = ctx.goal.tripNeed;

  /* ---- Đã đủ điểm ------------------------------------------------- */
  let sufficiency = 0;
  let sufficiencyNote = "chưa tính được";
  if (need !== null && need.high !== null) {
    const { coverage } = tripCoverage(ctx.state, ctx.ix, ctx.asOf, need.programs, need.high);
    sufficiency = coverage ?? 0;
    sufficiencyNote = `${Math.round(sufficiency * 100)}% cận trên của khoảng điểm chuyến đi`;
    if (sufficiency >= 1) {
      reasonCodes.push("POINTS_ALREADY_SUFFICIENT");
      // Cảnh báo này PHẢI nằm trên chính ứng viên này, không chỉ trên các thẻ
      // mà `rules.ts` Rule 1 phạt. Lượt chạy chỉ giữ cảnh báo của ứng viên
      // THẮNG — nên đặt nó ở đâu khác thì đúng vào lúc engine tuyên bố "bạn
      // đã đủ điểm rồi", câu cảnh báo đi kèm biến mất. Hạn điểm không nằm
      // trong mô hình V1: Aeroplan® hết hạn sau 18 tháng không hoạt động.
      warnings.push("POINTS_EXPIRY_NOT_MODELLED");
    }
  } else {
    // Không có mục tiêu chuyến đi (hoặc chưa tra được giá) thì vế tương đương
    // là: người này đã có sẵn bao nhiêu ở đúng chỗ họ đang cần. KHÔNG dùng
    // `accessible` — cộng điểm tiếp cận được của nhiều chương trình là đúng
    // phép đếm trùng §7 cấm.
    const { programId } = topCurrencyNeed(ctx);
    const entry = programId === null ? undefined : ctx.portfolio.direct.get(programId);
    const has = entry !== undefined && entry.kind === "known" && entry.points > 0;
    sufficiency = has ? 0.5 : 0;
    sufficiencyNote = has
      ? "đã có số dư ở đúng chương trình đang cần (không có chuyến đi để đo chính xác)"
      : "chưa có số dư ở chương trình đang cần";
  }

  /* ---- Thẻ đang giữ đã phục vụ nhu cầu chưa ----------------------- */
  const { programId: neededProgram } = topCurrencyNeed(ctx);
  let covers = 0;
  if (neededProgram !== null && ctx.portfolio.heldProducts.length > 0) {
    const servesDirectly = ctx.portfolio.earnedPrograms.has(neededProgram);
    const servesViaTransfer = [...ctx.portfolio.earnedPrograms].some((earned) =>
      activeAt(ctx.ix.pathsBySource.get(earned) ?? [], ctx.asOf).some(
        (path) => path.requiresTier === null && path.destinationProgramId === neededProgram,
      ),
    );
    covers = servesDirectly ? 1 : servesViaTransfer ? 0.8 : 0.2;
  }

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

  const components: ScoreComponent[] = [
    component("points_already_sufficient", 0.3, sufficiency, sufficiencyNote),
    component("portfolio_already_covers", 0.25, covers, "thẻ đang giữ có kiếm đúng đồng tiền đang cần không"),
    component(
      "no_reachable_candidate",
      0.2,
      blockedShare,
      `${Math.round(blockedShare * 100)}% ứng viên bị điều kiện hoặc mốc chi chặn`,
    ),
    component("offer_climate_weak", 0.25, climateWeak, "percentile trung vị của các offer đang chạy"),
  ];

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
