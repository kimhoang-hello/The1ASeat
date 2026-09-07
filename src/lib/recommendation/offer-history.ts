// CHỈ import KIỂU. `../offer-history.ts` nạp `data/offer-history.json`, và ESM
// của Node đòi `with { type: "json" }` cho việc đó — nên một import giá trị ở
// đây sẽ làm file này không nạp được bằng `node --test`, tức chính những test
// nó sinh ra để có. Import kiểu bị xoá lúc biên dịch nên không kéo theo gì.
import type { OfferUnit } from "../offer-history.ts";

/**
 * Một lần đọc mức welcome bonus của thẻ, ĐÚNG NHƯ file lịch sử ghi lại.
 *
 * `bonus: null` nghĩa là lần ghi đó thẻ KHÔNG có welcome bonus nào — một
 * trạng thái thật, có thật trên site (National Bank®, Wealthsimple® đang
 * không có mức nào), và mang ngày riêng của nó.
 */
export type OfferHistoryState = {
  /** `YYYY-MM-DD`. */
  at: string;
  bonus: { label: string; amount: number | undefined; unit: OfferUnit } | null;
};

/**
 * Một đợt welcome bonus: mức nào, từ ngày nào tới ngày nào.
 *
 * Đây là primitive cho §12 (percentile lịch sử) và là nửa còn thiếu của §11:
 * "70,000 điểm" một mình không nói được gì, vì câu hỏi quyết định có nên mở
 * thẻ NGAY hay chờ là "70,000 là mức cao hay mức thường của thẻ này".
 *
 * Nguồn là `data/offer-history.json`, do `.github/workflows/offer-history.yml`
 * ghi mỗi ngày và CHỈ ghi thêm khi số đổi — nên nó là nhật ký thay đổi, không
 * phải bản chép hằng ngày. Nó nối được với kho sản phẩm vì cả hai đánh khoá
 * bằng ĐÚNG slug Contentful.
 *
 * `unit` BẮT BUỘC đi kèm `amount`, và Phase 3 chỉ được so hai đợt CÙNG đơn vị.
 * Thẻ cashback đổi từ "Hoàn tiền 15% (tối đa $300)" sang "$250 tiền mặt" là
 * đổi đơn vị: so thẳng 15 với 250 rồi tuyên bố "từng lên tới $250" là một câu
 * về tiền, nói sai thì người đọc mở nhầm thẻ. `lib/offer-history.ts` tồn tại
 * `unitOf` đúng vì lý do đó.
 *
 * `amount` vẫn có thể `undefined` khi nhãn không mở đầu bằng con số đọc được.
 * Bỏ qua những đợt đó, đừng coi là 0.
 */
export interface OfferHistoryPoint {
  /** Ngày mức này BẮT ĐẦU hiện trên site. `YYYY-MM-DD`. */
  at: string;
  /**
   * Ngày mức này THÔI hiện, hoặc `null` nếu nó vẫn đang chạy.
   *
   * Phải nằm trên chính điểm dữ liệu chứ không để người dùng API tự suy từ
   * `at` của điểm kế tiếp — cách suy đó sai đúng lúc nó quan trọng nhất. Thẻ
   * chạy 70,000 từ 01/08, bỏ welcome bonus ngày 10/08, rồi chạy lại 70,000 từ
   * 01/09: hai điểm trả về có `at` là 01/08 và 01/09, và ai đo khoảng cách
   * giữa chúng sẽ kết luận đợt đầu kéo dài suốt tháng 8. Thật ra nó dừng ngày
   * 10/08, và cái khoảng không có offer nào ở giữa chính là thông tin có giá
   * trị nhất trong đoạn đó.
   */
  until: string | null;
  /** Nhãn đúng như nó từng hiện trên site. */
  label: string;
  amount: number | undefined;
  unit: OfferUnit;
}

/**
 * Gộp những lần ghi mà TRẠNG THÁI welcome bonus không đổi, rồi trả về các đợt
 * thẻ CÓ bonus, mỗi đợt kèm ngày bắt đầu và ngày kết thúc.
 *
 * Nhận cả dòng thời gian THÔ, kể cả những lần `bonus: null`. Nhận chúng là bắt
 * buộc chứ không phải tiện tay:
 *
 *   `record-offer-history.mts` ghi thêm một dòng khi welcome bonus HOẶC rebate
 *   đổi. Lọc bỏ những dòng không có bonus TRƯỚC khi gộp thì một thẻ đi từ
 *   70,000 → không có gì → 70,000 mất đúng cái vạch ngăn giữa hai đợt, và hai
 *   mức 70,000 nằm cạnh nhau bị gộp làm một. Hai đợt RIÊNG BIỆT hoá thành một
 *   đợt kéo dài — sai cả percentile lẫn thời lượng, và sai theo hướng làm một
 *   mức trông "thường" hơn thực tế.
 *
 * Lọc bỏ những lần rebate đổi mà bonus đứng yên thì vẫn cần: Scotiabank® Gold
 * ghi 50,000 điểm HAI lần chỉ vì rebate đi từ $150 lên $200, còn Momentum ghi
 * "15%" bốn lần. Percentile dựng trên đó sẽ đánh trọng số theo nhịp đổi
 * rebate — một đại lượng chẳng liên quan gì tới câu hỏi "mức này cao hay
 * thường".
 *
 * So bằng (SỐ, ĐƠN VỊ), không bằng NHÃN. Momentum đã đổi chữ từ "Hoàn tiền
 * 15%" sang "Cashback 15%" mà không đổi ưu đãi; so nhãn thì một lần biên tập
 * lại câu chữ thành một mức mới trong lịch sử. Cùng bài học với
 * `welcomeBonusPeak` trong `lib/offer-history.ts`.
 */
export function dedupeHistory(timeline: readonly OfferHistoryState[]): OfferHistoryPoint[] {
  const states: OfferHistoryState[] = [];
  for (const state of timeline) {
    const previous = states[states.length - 1];
    if (previous !== undefined && sameState(previous, state)) continue;
    states.push(state);
  }

  // Mỗi trạng thái kéo dài tới lúc trạng thái KẾ TIẾP bắt đầu — kể cả khi
  // trạng thái kế tiếp là "không có bonus". Ghi mốc đó lên chính điểm dữ liệu
  // TRƯỚC KHI bỏ vạch ngăn đi; bỏ trước là mất luôn ngày, và `until` của đợt
  // liền trước sẽ nhảy qua cả khoảng trống tới đợt sau.
  const points: OfferHistoryPoint[] = [];
  for (let i = 0; i < states.length; i += 1) {
    const state = states[i];
    if (state.bonus === null) continue;
    const next = states[i + 1];
    points.push({
      at: state.at,
      until: next === undefined ? null : next.at,
      label: state.bonus.label,
      amount: state.bonus.amount,
      unit: state.bonus.unit,
    });
  }
  return points;
}

function sameState(a: OfferHistoryState, b: OfferHistoryState): boolean {
  if (a.bonus === null || b.bonus === null) return a.bonus === b.bonus;
  return a.bonus.amount === b.bonus.amount && a.bonus.unit === b.bonus.unit;
}
