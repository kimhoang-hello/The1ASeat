import historyJson from "../../data/offer-history.json";

/**
 * Welcome bonus và rebate của một thẻ đổi liên tục, và cho tới giờ site không
 * giữ lại gì cả: job `check-rebates` ghi đè số mới lên số cũ, `expire-offers`
 * viết lại copy. Người đọc thấy "70,000 điểm" mà không có cách nào biết đó là
 * mức cao hay mức thường của thẻ này — mà đó chính là câu hỏi quyết định có
 * nên mở thẻ ngay hay chờ.
 *
 * File `data/offer-history.json` là chỗ giữ. Nó do
 * `.github/workflows/offer-history.yml` ghi mỗi ngày và CHỈ ghi thêm khi có số
 * đổi, nên nó là nhật ký thay đổi chứ không phải bản chép hằng ngày.
 */

export interface OfferSnapshotCard {
  slug: string;
  name: string;
  welcomeBonus?: string;
  rebate?: string;
}

export interface OfferSnapshot {
  takenAt: string;
  cards: OfferSnapshotCard[];
}

/** Một lần con số của thẻ đổi. `at` là NGÀY (YYYY-MM-DD) — giờ giấc không thêm
 *  thông tin gì cho thứ được đọc mỗi ngày một lần. */
export interface OfferHistoryEntry {
  at: string;
  welcomeBonus?: string;
  rebate?: string;
}

export interface OfferHistoryFile {
  /** Ngày bắt đầu ghi. Có nó thì trang mới nói thật được: "từ khi theo dõi",
   *  chứ không ngầm hứa là biết cả những gì xảy ra trước đó. */
  since: string;
  cards: Record<string, OfferHistoryEntry[]>;
}

const history = historyJson as OfferHistoryFile;

export const TRACKING_SINCE = history.since;

export function historyFor(slug: string): OfferHistoryEntry[] {
  return history.cards[slug] ?? [];
}

/** Số điểm/tiền rút ra từ nhãn ("70,000 điểm Aeroplan®" -> 70000), hoặc
 *  `undefined` nếu nhãn không mở đầu bằng một con số đọc được. Dấu phẩy ngăn
 *  nghìn là quy ước của site (xem AGENTS.md), nên bỏ nó đi trước khi đọc. */
export function amountIn(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const match = label.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * "Đơn vị" của một nhãn welcome bonus, đủ thô để chỉ dùng vào một việc: không
 * so hai con số không so được với nhau.
 *
 * Thẻ cashback có thể đổi từ "Hoàn tiền 15% (tối đa $300)" sang "$250 tiền
 * mặt". So thẳng 15 với 250 rồi tuyên bố "từng lên tới $250" là một câu về
 * tiền, nói sai thì người đọc mở nhầm thẻ. Khác đơn vị thì coi như không so
 * được và không nói gì.
 */
function unitOf(label: string): "percent" | "dollar" | "points" {
  if (label.includes("%")) return "percent";
  if (label.includes("$")) return "dollar";
  return "points";
}

export interface OfferPeak {
  /** Nhãn của lần cao nhất, đúng như nó từng hiện trên site. */
  label: string;
  at: string;
  /** Mức hiện tại có đang bằng mức cao nhất không. */
  isCurrent: boolean;
  /** Ngày ghi nhận đầu tiên CỦA THẺ NÀY, không phải ngày file bắt đầu. Thẻ
   *  thêm vào tháng sau thì `since` của file nói quá thời gian đã theo dõi nó. */
  trackedSince: string;
}

/**
 * Mức welcome bonus cao nhất đã ghi nhận cho thẻ này, hoặc `undefined` khi
 * chưa đủ dữ liệu để nói gì.
 *
 * "Đủ" nghĩa là đã ghi được ít nhất HAI mức khác nhau. Một mức duy nhất thì
 * "cao nhất từng thấy" chỉ là cách nói vòng của "mức hiện tại" — đúng về mặt
 * số học nhưng nói với người đọc một điều họ không học được gì, và tệ hơn: nó
 * trông như một khẳng định có dữ liệu đằng sau trong khi không có.
 */
export function welcomeBonusPeak(slug: string, current: string | undefined): OfferPeak | undefined {
  const currentAmount = amountIn(current);
  if (!current || currentAmount === undefined) return undefined;
  const unit = unitOf(current);

  // Chỉ những mốc so được với mức hiện tại: cùng đơn vị và đọc ra được số.
  const comparable = historyFor(slug).filter(
    (entry) =>
      entry.welcomeBonus !== undefined &&
      unitOf(entry.welcomeBonus) === unit &&
      amountIn(entry.welcomeBonus) !== undefined,
  );

  // Đếm theo CON SỐ, không theo nhãn. Đổi cách viết — "70,000 điểm" thành
  // "Tối đa 70,000 điểm" — là một dòng mới trong lịch sử nhưng vẫn đúng một
  // mức; đếm theo nhãn thì một lần biên tập lại câu chữ đủ để trang bắt đầu
  // tuyên bố "cao nhất từng thấy" mà chưa từng thấy hai mức nào.
  const distinct = new Set([...comparable.map((entry) => amountIn(entry.welcomeBonus)!), currentAmount]);
  if (distinct.size < 2) return undefined;

  let best: { label: string; at: string; amount: number } | undefined;
  for (const entry of comparable) {
    const amount = amountIn(entry.welcomeBonus)!;
    if (!best || amount > best.amount) best = { label: entry.welcomeBonus!, at: entry.at, amount };
  }
  if (!best) return undefined;

  const entries = historyFor(slug);
  return {
    label: best.label,
    at: best.at,
    isCurrent: currentAmount >= best.amount,
    trackedSince: entries[0]?.at ?? TRACKING_SINCE,
  };
}
