/**
 * §10.3 — "danh mục của tôi lệch, cân lại giúp".
 *
 * ```
 * 35% New Currency Exposure
 * 25% Transfer Flexibility
 * 15% Earn Fit
 * 10% Offer Quality
 * 10% Spend Fit
 *  5% Editorial Adjustment   ← §15 chưa làm, áp ở `rules.ts`
 * ```
 *
 * Offer chỉ còn 10% — thấp nhất trong bốn bảng. Đúng như vậy: người đang cân
 * lại danh mục không đi tìm một khoản bonus, họ đi tìm một chỗ đứng khác. Một
 * hàm vạn năng sẽ lại đưa họ về đúng thẻ Aeroplan® thứ tư vì offer của nó đang
 * đẹp.
 */

import { centsPerPoint } from "../portfolio.ts";
import { offerQualityScore } from "../offer-quality.ts";
import { component, relativeTo } from "./weights.ts";
import { transferDestinationCount } from "./context.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

/**
 * Thẻ này mở ra bao nhiêu chỗ MỚI.
 *
 * Đo bằng tỷ trọng GIÁ TRỊ người dùng đang có ở đồng tiền đó, không bằng "có
 * hay không có tài khoản": người giữ 2,000 điểm Avios® và người giữ 200,000
 * điểm Avios® đều "đã có Avios®", mà nhu cầu của họ khác hẳn nhau.
 */
function newExposure(candidate: CandidateFacts, ctx: ScoringContext): number {
  const programId = candidate.product.pointsProgramId;
  if (programId === null) return 0;
  if (ctx.portfolio.knownValueCents <= 0) return 1;
  const entry = ctx.portfolio.direct.get(programId);
  if (entry === undefined || entry.kind !== "known") return 1;
  const cpp = centsPerPoint(ctx.ix, programId, ctx.asOf);
  if (cpp === null) return 1;
  return Math.max(0, 1 - (entry.points * cpp) / ctx.portfolio.knownValueCents);
}

export function scoreDiversify(
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  const destinations = transferDestinationCount(
    ctx.ix,
    candidate.product.pointsProgramId,
    ctx.asOf,
  );
  // Chuẩn hoá theo số chặng nhiều nhất mà một chương trình trong bộ dữ liệu
  // có. Đọc từ dữ liệu chứ không chôn một hằng: thêm một chặng chuyển vào
  // `transfer-paths.ts` phải tự động đổi thang, không phải đổi code.
  let maxDestinations = 1;
  for (const program of ctx.ix.programById.values()) {
    maxDestinations = Math.max(
      maxDestinations,
      transferDestinationCount(ctx.ix, program.id, ctx.asOf),
    );
  }

  return [
    component("new_currency_exposure", 0.35, newExposure(candidate, ctx), "đồng tiền người dùng chưa có nhiều"),
    component(
      "transfer_flexibility",
      0.25,
      relativeTo(destinations, maxDestinations),
      "số chương trình đồng tiền này chuyển thẳng tới được",
    ),
    // §10.3 gọi nó "Earn Fit", §10.1 gọi "Long-term Earn Fit" — CÙNG một phép
    // đo. Một khái niệm, một khoá: hai tên khác nhau cho cùng một dòng sẽ làm
    // bảng giải thích của §19 trông như hai thứ khác nhau.
    component(
      "long_term_earn_fit",
      0.15,
      relativeTo(candidate.earn.annualValueCents, ctx.scale.maxEarnAnnualCents),
      "giá trị tích điểm một năm",
    ),
    component("offer_quality", 0.1, offerQualityScore(candidate.offer, ctx.climate), "§11"),
    component("spend_fit", 0.1, candidate.suitability.minSpendFit ?? 0.5, "§13"),
  ];
}
