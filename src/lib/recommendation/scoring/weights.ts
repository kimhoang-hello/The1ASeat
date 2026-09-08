/**
 * Bộ khung dùng chung của bốn hàm chấm điểm §10.
 *
 * §10 nói thẳng: **đừng làm một hàm chấm điểm vạn năng.** Bốn ý định dùng bốn
 * bộ thành phần và bốn bộ trọng số khác nhau, và điều đó không phải chi tiết
 * cài đặt — nó là lý do engine phân biệt được "thẻ tốt" với "thẻ tốt CHO VIỆC
 * NÀY". File này chỉ giữ phần chung: cách một thành phần được ghi lại, và cách
 * chúng cộng thành một số.
 *
 * PHÉP CHUẨN HOÁ. Bốn bảng của §10 cộng lại đúng 100% KỂ CẢ 5% "Editorial
 * Adjustment", mà §15 (`editorial_rules`) cố ý chưa làm — nên các thành phần
 * thực sự tính được chỉ cộng tới 0.95. Chia cho tổng trọng số THẬT có mặt đưa
 * điểm về lại thang 0..1, giữ nguyên TỶ LỆ giữa các thành phần (25 : 20 : 15
 * không đổi), và quan trọng nhất là giữ điểm của thẻ so sánh được với ứng viên
 * `NO_NEW_CARD` — thứ được chấm trên một bảng khác hẳn.
 *
 * Chia cho tổng THẬT chứ không cho hằng 0.95: một hàm chấm điểm quên mất một
 * thành phần sẽ tự chuẩn hoá lại thay vì lặng lẽ trả điểm thấp cho mọi thẻ
 * trong ý định đó. Test khoá tổng trọng số của từng bảng bằng đúng 0.95, nên
 * "tự chuẩn hoá" không thành cái cớ để bảng đi lệch spec.
 */

import type { ScoreComponent, ScoreComponentKey } from "../engine-types.ts";

/** §10 dành 5% cho editorial ở mọi bảng; §17 giới hạn nó ở ±10%. */
export const EDITORIAL_WEIGHT = 0.05;

/** Tổng trọng số các thành phần TÍNH ĐƯỢC của mỗi bảng §10. */
export const SCORABLE_WEIGHT = 1 - EDITORIAL_WEIGHT;

export function component(
  key: ScoreComponentKey,
  weight: number,
  raw: number,
  note: string,
): ScoreComponent {
  const safe = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  return { key, weight, raw: safe, contribution: weight * safe, note };
}

/** Điểm nền 0..1 — xem phép chuẩn hoá ở đầu file. */
export function assembleScore(components: readonly ScoreComponent[]): number {
  const totalWeight = components.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return 0;
  const total = components.reduce((sum, row) => sum + row.contribution, 0);
  return Math.min(1, Math.max(0, total / totalWeight));
}

/** Chia `value` cho mức cao nhất trong tập ứng viên. Tập rỗng hoặc toàn số 0
 *  thì trả 0 — KHÔNG trả 1: "cao nhất trong một tập không ai có gì" là 0. */
export function relativeTo(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}
