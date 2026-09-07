// CHỈ import KIỂU. `../offer-history.ts` nạp `data/offer-history.json`, và ESM
// của Node đòi `with { type: "json" }` cho việc đó — nên một import giá trị ở
// đây sẽ làm file này không nạp được bằng `node --test`, tức chính những test
// nó sinh ra để có. Import kiểu bị xoá lúc biên dịch nên không kéo theo gì.
import type { OfferUnit } from "../offer-history.ts";

/**
 * Một lần mức welcome bonus của thẻ này đổi.
 *
 * Đây là primitive cho §12 (percentile lịch sử của offer) và là nửa còn thiếu
 * của §11: "70,000 điểm" một mình không nói được gì, vì câu hỏi quyết định có
 * nên mở thẻ NGAY hay chờ là "70,000 là mức cao hay mức thường của thẻ này".
 *
 * Nguồn là `data/offer-history.json`, do `.github/workflows/offer-history.yml`
 * ghi mỗi ngày và CHỈ ghi thêm khi số đổi — nên nó là nhật ký thay đổi, không
 * phải bản chép hằng ngày. Nó nối được với kho này vì cả hai đánh khoá bằng
 * ĐÚNG slug Contentful.
 *
 * `unit` BẮT BUỘC đi kèm `amount`, và Phase 3 chỉ được so hai điểm CÙNG đơn
 * vị. Thẻ cashback đổi từ "Hoàn tiền 15% (tối đa $300)" sang "$250 tiền mặt"
 * là đổi đơn vị: so thẳng 15 với 250 rồi tuyên bố "từng lên tới $250" là một
 * câu về tiền, nói sai thì người đọc mở nhầm thẻ. `lib/offer-history.ts` tồn
 * tại `unitOf` đúng vì lý do đó, và API này phơi nó ra thay vì lặng lẽ trả về
 * một con số trần đã mất đơn vị.
 */
export interface OfferHistoryPoint {
  /** `YYYY-MM-DD`. */
  at: string;
  /** Nhãn đúng như nó từng hiện trên site. */
  label: string;
  amount: number | undefined;
  unit: OfferUnit;
}

/**
 * Bỏ những lần ghi mà TRẠNG THÁI welcome bonus không đổi, rồi trả về những
 * lần thẻ CÓ bonus.
 *
 * Nhận cả dòng thời gian THÔ, trong đó `null` nghĩa là lần ghi đó thẻ không có
 * welcome bonus nào. Nhận `null` là bắt buộc chứ không phải tiện tay:
 *
 *   `record-offer-history.mts` ghi thêm một dòng khi welcome bonus HOẶC rebate
 *   đổi. Lọc bỏ những dòng không có bonus TRƯỚC khi gộp thì một thẻ đi từ
 *   70,000 → không có gì → 70,000 mất đúng cái vạch ngăn giữa hai lần, và hai
 *   mức 70,000 nằm cạnh nhau bị gộp làm một. Kết quả là hai đợt offer RIÊNG
 *   BIỆT hoá thành một đợt kéo dài — sai cả percentile lẫn thời lượng, và sai
 *   theo hướng làm một mức trông "thường" hơn thực tế. Thẻ mất rồi có lại
 *   welcome bonus là chuyện có thật trên site (National Bank®, Wealthsimple®
 *   đang không có mức nào).
 *
 * Lọc bỏ những lần rebate đổi mà bonus đứng yên thì vẫn cần: Scotiabank® Gold
 * trả về 50,000 điểm HAI lần chỉ vì rebate đi từ $150 lên $200, còn Momentum
 * trả về "15%" bốn lần. Percentile dựng trên đó sẽ đánh trọng số theo nhịp đổi
 * rebate — một đại lượng chẳng liên quan gì tới câu hỏi "mức này cao hay
 * thường".
 *
 * So bằng (SỐ, ĐƠN VỊ), không bằng NHÃN. Momentum đã đổi chữ từ "Hoàn tiền
 * 15%" sang "Cashback 15%" mà không đổi ưu đãi; so nhãn thì một lần biên tập
 * lại câu chữ thành một mức mới trong lịch sử. Cùng bài học với
 * `welcomeBonusPeak` trong `lib/offer-history.ts`.
 */
export function dedupeHistory(
  timeline: readonly (OfferHistoryPoint | null)[],
): OfferHistoryPoint[] {
  const kept: (OfferHistoryPoint | null)[] = [];
  for (const point of timeline) {
    const previous = kept.length > 0 ? kept[kept.length - 1] : undefined;
    if (previous !== undefined && sameState(previous, point)) continue;
    kept.push(point);
  }
  // Vạch ngăn `null` đã làm xong việc của nó — nó không phải một mức bonus nên
  // không thuộc về kết quả.
  return kept.filter((point): point is OfferHistoryPoint => point !== null);
}

function sameState(a: OfferHistoryPoint | null, b: OfferHistoryPoint | null): boolean {
  if (a === null || b === null) return a === b;
  return a.amount === b.amount && a.unit === b.unit;
}
