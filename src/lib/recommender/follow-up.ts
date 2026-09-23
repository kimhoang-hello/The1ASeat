/**
 * Câu hỏi tiếp theo khi người dùng đã BỎ QUA vài câu.
 *
 * Engine trả về đúng một câu (`run.followUp`) và không biết gì về việc bỏ qua —
 * đúng như vậy: "đã bỏ qua" là trạng thái của một phiên trên một trình duyệt,
 * không phải một dữ kiện về con người. Nhưng nếu trang cứ hỏi lại câu vừa bỏ
 * qua thì nút "Bỏ qua" là nút giả.
 *
 * Nên chỗ này gọi CHÍNH `nextQuestion` của engine với danh sách chỗ trống đã
 * lọc, thay vì tự xếp lại thứ tự. Một bảng ưu tiên thứ hai ở tầng trang sẽ lệch
 * với bảng của §30 ngay lần sau ai đó sửa một trong hai (bài học "hai phép kiểm
 * cùng một khái niệm phải là một hàm", Phase 2).
 *
 * Giá trị đo được (§30) không tính lại: nó đã nằm trong `derived.followUpProbes`
 * của chính lượt chạy đó. Tính lại là chạy engine thêm ~30 lần cho mỗi lần bấm
 * "Bỏ qua".
 */

import { nextQuestion } from "../recommendation/explain.ts";
import type { FollowUpQuestion } from "../recommendation/engine-types.ts";
import type { RecommendationRunRecord } from "../recommendation/runs.ts";
import type { RecommendationDataset } from "../recommendation/types.ts";
import type { CreditCardOffer } from "../content/types.ts";
import { presentRun, routeNotPricedOf, type ResultView } from "./present.ts";
import { questionKey } from "./questions.ts";
import type { UserDataGap } from "../recommendation/user-types.ts";

/**
 * Câu hỏi tiếp theo còn lại sau khi bỏ những câu người dùng đã bỏ qua.
 *
 * `null` = không còn câu nào đáng hỏi. Trang khi đó chỉ hiện kết quả.
 */
export function followUpAfterSkips(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
  skippedByUser: ReadonlySet<string>,
  /**
   * Chặng bay chưa có giá (`AWARD_ROUTE_NOT_IN_DATASET`). Hạng ghế, số người,
   * khứ hồi chỉ là thừa số của số điểm chuyến bay cần — không có giá thì trả
   * lời gì cũng không ra con số, và trang đã nói đúng câu đó ngay trên câu hỏi.
   * Coi chúng như đã bỏ qua. Ngày bay và độ linh hoạt thì KHÔNG: luật "đặt
   * ngay" (`rules.ts`) vẫn đọc chúng.
   */
  routeNotPriced = false,
): FollowUpQuestion | null {
  const skipped = routeNotPriced
    ? new Set([
        ...skippedByUser,
        ...record.outputSnapshot.userGaps
          .filter((gap) => PRICE_FACTORS.has(gap.kind))
          .map((gap) => questionKey(gap.kind, gap.subject)),
      ])
    : skippedByUser;
  const original = record.outputSnapshot.followUp;
  if (original === null) return null;
  if (!skipped.has(questionKey(original.gapKind, original.subject))) return original;

  const probes = new Map(
    record.derivedState.followUpProbes.map((probe) => [
      questionKey(probe.gapKind, probe.subject),
      probe.valid === 0 ? null : probe.flips / probe.valid,
    ]),
  );
  const rankings = record.derivedState.goals.map((goal) =>
    goal.ranking.map((row) => row.candidate),
  );
  const businessProductIds = new Set(
    dataset.products
      .filter((product) => product.personalOrBusiness === "business")
      .map((product) => product.id as string),
  );

  return nextQuestion({
    gaps: record.outputSnapshot.userGaps.filter(
      (gap) => !skipped.has(questionKey(gap.kind, gap.subject)),
    ),
    ranked: rankings[0] ?? [],
    rankings,
    businessProductIds,
    // Chỉ những câu ĐÃ được đo trong lượt chạy này. Câu chưa đo trả `null` —
    // `nextQuestion` hiểu đó là "không đo được" và xếp nó theo bảng ưu tiên,
    // đúng hành vi khi engine chạy không có phép đo.
    measure: (gap) => probes.get(questionKey(gap.kind, gap.subject)) ?? null,
  });
}

/**
 * Câu hỏi này có đáng CHẶN sự chú ý của người đọc không?
 *
 * `basis` của engine nói ra chính điều đó (§30):
 *
 *  - `gatekeeper` — đổi được cả tập ứng viên (bạn đang giữ thẻ nào, có điểm ở
 *    đâu). Hỏi trước, luôn.
 *  - `measured` / `urgent` — đã ĐO được là đổi được người thắng, hoặc người
 *    thắng đang dựa vào đúng dữ kiện đó.
 *  - `priority` — KHÔNG phép đo nào nói nó đổi được gì; nó chỉ nằm cao trong
 *    bảng ưu tiên tĩnh. Đo trên 15 nhân vật mẫu: 8 người bị hỏi một câu như
 *    vậy, 6 trong đó là thu nhập hộ gia đình.
 *
 * Câu `priority` vẫn có giá trị — nó nâng độ đầy đủ dữ liệu của §29 — nhưng nó
 * không được chiếm chỗ của một câu hỏi thật. Trang đẩy nó xuống khối "muốn
 * chắc hơn", gập lại.
 *
 * NGOẠI LỆ: dữ kiện của chuyến đi (hạng ghế, số người, khứ hồi, ngày bay). Kể
 * cả khi chúng không đổi THỨ HẠNG, chúng đổi thứ người dùng tới đây để xem —
 * số điểm chuyến bay cần. Thiếu một thừa số là cả ba con số kia không tính
 * được.
 */
const TRIP_FACTS = new Set<UserDataGap["kind"]>([
  "trip_cabin_unknown",
  "trip_passengers_unknown",
  "trip_round_trip_unknown",
  "trip_dates_unknown",
]);

/**
 * Kết quả + câu hỏi tiếp theo, đúng như trang hiện ra.
 *
 * Một hàm, không phải hai lời gọi ở trang: độ chắc chắn nói "trả lời thêm vài
 * câu" chỉ khi trang CÒN câu để hỏi sau khi trừ những câu đã bỏ qua — và nối
 * sai hai lời gọi đó ở trang là lỗi không test nào thấy (Codex, rà 22/09/2026).
 */
export function presentForPage(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
  offers: readonly CreditCardOffer[],
  skipped: ReadonlySet<string>,
): { view: ResultView | null; followUp: FollowUpQuestion | null } {
  const followUp = followUpAfterSkips(record, dataset, skipped, routeNotPricedOf(record));
  return { followUp, view: presentRun(record, dataset, offers, 0, followUp !== null) };
}

/** Thừa số của số điểm chuyến bay cần — xem `routeNotPriced` ở trên. */
const PRICE_FACTORS = new Set<UserDataGap["kind"]>([
  "trip_cabin_unknown",
  "trip_passengers_unknown",
  "trip_round_trip_unknown",
]);

export function asksForAttention(question: FollowUpQuestion): boolean {
  return question.basis !== "priority" || TRIP_FACTS.has(question.gapKind);
}
