/**
 * Lịch sử rebate FinlyWealth của một thẻ, dựng từ `data/offer-history.json`
 * cho section "Lịch sử rebate" trên trang thẻ (23/11/2026).
 *
 * File này KHÔNG import gì: `offer-history.ts` nạp JSON lúc import, còn
 * `node --test` thì không nạp được JSON không khai `with { type: "json" }`.
 * Tách ra để test được bằng dữ liệu dựng tay.
 */

/** Một dòng của nhật ký — chỉ hai trường file này cần. */
export interface RebateHistoryEntry {
  at: string;
  rebate?: string;
}

/** Một đoạn thời gian rebate đứng yên ở một mức. `amount` null = không có rebate. */
export interface RebateSegment {
  amount: number | null;
  from: string;
  /** Ngày cuối cùng còn ở mức này (tính cả ngày đó). */
  to: string;
  days: number;
  current: boolean;
  /** Đoạn đầu tiên: ngày bắt đầu là ngày bắt đầu GHI NHẬN, không phải ngày rebate bắt đầu. */
  first: boolean;
  /** Đoạn dựng từ rebate đang hiện trên trang vì file lịch sử chưa kịp ghi. */
  live: boolean;
}

export interface RebateHistory {
  segments: RebateSegment[];
  current: number;
  max: number;
  min: number;
  /** Số mức khác nhau đã thấy. Dưới 2 thì không có gì để vẽ. */
  distinct: number;
  /** Một đoạn duy nhất, có trong file: mới được nói "chưa đổi lần nào". Một mức
   *  nhưng từng bị ngắt, hay chỉ có đoạn dựng từ trang, thì không. */
  unchanged: boolean;
  changes: number;
  trackedSince: string;
}

export const DAY_MS = 86_400_000;

/** Mili-giây UTC của một ngày YYYY-MM-DD. Ngày trong file là ngày Toronto, nhưng
 *  chỉ dùng để đếm ngày và đặt vị trí, nên neo UTC cho khỏi lệch giờ mùa hè. */
export function dayMs(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * "$150" -> 150, "$1,500" -> 1500. Khớp NGUYÊN chuỗi theo đúng dạng
 * `formatRebate` (finly-api.ts) ghi vào `rebateVi`; dạng khác ("$2 000",
 * "$150–$300", "150 CAD") là `undefined` chứ không đọc nửa vời ra một số sai.
 */
export function dollarsIn(label: string | undefined): number | undefined {
  const match = label?.trim().match(/^\$(\d{1,3}(?:,\d{3})*|\d+)$/);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  return value > 0 ? value : undefined;
}

/**
 * Dồn nhật ký thành các đoạn liền nhau, hoặc `undefined` khi thẻ đang không có
 * rebate (không có gì để nói về một con số không hiện trên trang).
 *
 * - Bỏ các dòng đầu không có rebate. Thẻ Amex® chỉ có rebate trên site từ khi
 *   link apply chuyển sang trang /rebates/ (13/11/2026); trước đó KHÔNG có nghĩa
 *   là FinlyWealth không trả, nên vẽ thành "không có rebate" là nói sai.
 * - Hai dòng liền nhau cùng mức rebate (dòng mới chỉ vì welcome bonus đổi) là
 *   MỘT đoạn.
 * - File chỉ cập nhật mỗi sáng, còn chip rebate đọc Contentful. Lệch nhau thì
 *   nối một đoạn từ hôm nay theo số trên trang, để chip và biểu đồ không nói
 *   hai con số khác nhau. Sáng hôm sau job ghi đúng mức đó với ngày đó.
 */
export function buildRebateHistory(
  entries: readonly RebateHistoryEntry[],
  currentRebate: string | undefined,
  today: string,
): RebateHistory | undefined {
  const current = dollarsIn(currentRebate);
  if (current === undefined) return undefined;

  // Dòng không có `rebate` (hay chuỗi rỗng — chip trên trang cũng không hiện) =
  // thẻ không có rebate hôm đó. Dòng CÓ mà không đọc được thì cả section im
  // lặng: bỏ qua dòng đó là kéo dài đoạn trước sai số ngày, có khi mất luôn một
  // lần đổi thật; vẽ nó thành "không có rebate" là nói sai (Codex, 23/11/2026).
  // Job chỉ ghi dạng `formatRebate`, nên nhánh này chỉ mở khi có người sửa tay.
  const known = entries.filter((entry) => entry.at <= today);
  if (known.some((entry) => entry.rebate && dollarsIn(entry.rebate) === undefined)) return undefined;
  const points = known.map((entry) => ({ at: entry.at, amount: dollarsIn(entry.rebate) ?? null }));
  while (points.length && points[0].amount === null) points.shift();

  const raw: { from: string; amount: number | null; live: boolean }[] = [];
  for (const point of points) {
    if (raw.length && raw[raw.length - 1].amount === point.amount) continue;
    raw.push({ from: point.at, amount: point.amount, live: false });
  }

  // Số trên trang đè lên dòng của chính hôm nay: lịch sử trong file không còn
  // nguyên vẹn, nên không được nói "chưa đổi lần nào" dù chỉ còn một đoạn.
  let overwrote = false;
  const last = raw[raw.length - 1];
  if (!last || last.amount !== current) {
    if (last && last.from === today) {
      last.amount = current;
      last.live = true;
      overwrote = true;
    } else {
      raw.push({ from: today, amount: current, live: true });
    }
  }
  // Thay số của dòng hôm nay có thể làm nó trùng mức với đoạn ngay trước.
  for (let i = raw.length - 1; i > 0; i--) {
    if (raw[i].amount === raw[i - 1].amount) raw.splice(i, 1);
  }

  const segments: RebateSegment[] = raw.map((segment, i) => {
    const next = raw[i + 1];
    const to = next ? isoOf(dayMs(next.from) - DAY_MS) : today;
    return {
      ...segment,
      to,
      days: Math.round((dayMs(to) - dayMs(segment.from)) / DAY_MS) + 1,
      current: !next,
      first: i === 0,
    };
  });

  const amounts = segments.flatMap((segment) => (segment.amount === null ? [] : [segment.amount]));
  return {
    segments,
    current,
    max: Math.max(...amounts),
    min: Math.min(...amounts),
    distinct: new Set(amounts).size,
    unchanged: segments.length === 1 && !segments[0].live && !overwrote,
    changes: segments.length - 1,
    trackedSince: segments[0].from,
  };
}
