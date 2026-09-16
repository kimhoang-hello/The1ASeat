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
import { questionKey } from "./questions.ts";

/**
 * Câu hỏi tiếp theo còn lại sau khi bỏ những câu người dùng đã bỏ qua.
 *
 * `null` = không còn câu nào đáng hỏi. Trang khi đó chỉ hiện kết quả.
 */
export function followUpAfterSkips(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
  skipped: ReadonlySet<string>,
): FollowUpQuestion | null {
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
