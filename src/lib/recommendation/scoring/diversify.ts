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
import { earnFitComponent, offerQualityComponent, spendFitComponent } from "./shared.ts";
import { component, relativeTo } from "./weights.ts";
import { transferDestinationCount, walletReach } from "./context.ts";
import { activeAt } from "../temporal.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

/**
 * Thẻ này mở ra bao nhiêu chỗ MỚI.
 *
 * Đo bằng tỷ trọng GIÁ TRỊ người dùng đang có ở đồng tiền đó, không bằng "có
 * hay không có tài khoản": người giữ 2,000 điểm Avios® và người giữ 200,000
 * điểm Avios® đều "đã có Avios®", mà nhu cầu của họ khác hẳn nhau.
 */
function newExposure(candidate: CandidateFacts, ctx: ScoringContext): { raw: number; note: string } {
  const programId = candidate.product.pointsProgramId;
  if (programId === null) return { raw: 0, note: "thẻ không kiếm đồng tiền nào" };
  const entry = ctx.portfolio.direct.get(programId);
  if (entry === undefined) return { raw: 1, note: `chưa có số dư nào ở ${programId}` };
  // CÓ tài khoản mà không nhớ số dư thì tỷ trọng nằm đâu đó trong [0, 1] —
  // điểm giữa, như mọi chỗ "chưa chắc" khác của engine. Bản trước cho 1, tức
  // đọc "không nhớ" thành "không có": người giữ ba thẻ Membership Rewards®
  // không nhớ số dư được chấm thẻ MR thứ tư là "chương trình mới" trọn vẹn
  // (vòng Codex 09/10/2026). Hai phép kiểm này đứng TRƯỚC phép kiểm "danh mục
  // chưa có giá trị đã biết": ví chỉ có MỘT dòng MR không rõ số dư có giá trị
  // đã biết bằng 0, và đi qua nhánh đó là về lại đúng con số 1 vừa vá.
  if (entry.kind !== "known") {
    return { raw: 0.5, note: `có tài khoản ${programId} nhưng chưa biết số dư — điểm giữa` };
  }
  const cpp = centsPerPoint(ctx.ix, programId, ctx.asOf);
  if (cpp === null) return { raw: 0.5, note: `${programId} chưa có định giá — điểm giữa` };
  // Số dư đã biết của chương trình này có định giá mà tổng vẫn 0: nó bằng 0 điểm.
  if (ctx.portfolio.knownValueCents <= 0) return { raw: 1, note: "danh mục chưa có giá trị đã biết nào" };
  const share = (entry.points * cpp) / ctx.portfolio.knownValueCents;
  return { raw: Math.max(0, 1 - share), note: `1 − tỷ trọng ${programId} đã có ${share.toFixed(2)}` };
}

export function scoreDiversify(
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  const exposure = newExposure(candidate, ctx);
  // Chỉ đếm đích MỚI — đích ví hiện tại chưa chạm tới. Người đang cân lại danh
  // mục không cần thêm một đường tới nơi họ đã tới được: bản trước chấm trọn
  // 1.0 cho Amex® Green với người đang giữ 410,000 điểm và ba thẻ Membership
  // Rewards®, và dòng này một mình đưa thẻ MR thứ tư lên hạng nhất của mục
  // tiêu "đa dạng hơn" (vòng Codex 09/10/2026). Ví trống thì không trừ gì —
  // y như cũ.
  const reached = walletReach(ctx);
  const programId = candidate.product.pointsProgramId;
  const allDestinations = transferDestinationCount(ctx.ix, programId, ctx.asOf);
  const destinations =
    programId === null || allDestinations === 0
      ? 0
      : new Set(
          activeAt(ctx.ix.pathsBySource.get(programId) ?? [], ctx.asOf)
            .filter((path) => path.requiresTier === null)
            .map((path) => path.destinationProgramId as string)
            .filter((destination) => !reached.has(destination)),
        ).size;
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
    component("new_currency_exposure", 0.35, exposure.raw, exposure.note),
    component(
      "transfer_flexibility",
      0.25,
      relativeTo(destinations, maxDestinations),
      destinations === allDestinations
        ? `chuyển thẳng tới ${destinations} chương trình ÷ nhiều nhất bộ dữ liệu ${maxDestinations}`
        : `chuyển thẳng tới ${allDestinations} chương trình, ${destinations} trong đó ví hiện tại chưa với tới ÷ nhiều nhất bộ dữ liệu ${maxDestinations}`,
    ),
    // §10.3 gọi nó "Earn Fit", §10.1 gọi "Long-term Earn Fit" — CÙNG một phép
    // đo. Một khái niệm, một khoá: hai tên khác nhau cho cùng một dòng sẽ làm
    // bảng giải thích của §19 trông như hai thứ khác nhau.
    earnFitComponent(0.15, candidate, ctx),
    offerQualityComponent(0.1, candidate, ctx),
    spendFitComponent(0.1, candidate, ctx),
  ];
}
