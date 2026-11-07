// Đọc bảng "Current Transfer Bonuses" của Daily Drop
// (dailydrop.com/transfer-partners-cheat-sheet#current-offers) — nguồn transfer
// bonus MỸ do tác giả chọn ngày 06/11/2026. Job hằng tuần
// `scripts/sync-us-transfer-bonuses.mts` gọi hàm này rồi ghi kết quả vào
// `data/us-transfer-bonuses.json`.
//
// Trang là Webflow dựng sẵn HTML: mỗi bonus là một
// `div.transfer-bonus-item` trong `section#current-offers`, bốn ô chữ theo thứ
// tự TRANSFER FROM / TRANSFER TO / BONUS / EXPIRES. `fetch` trần đọc được đủ
// (đo 06/11/2026: 11 bonus, khớp bản browser) — không cần browser như phần lớn
// trang ngân hàng Mỹ.
//
// HỎNG THÌ NÉM, KHÔNG ĐOÁN. Mọi chỗ lệch hình dạng — mất mục, mất hàng tiêu đề,
// hàng nào thiếu ô, phần trăm hay ngày không đọc được — đều làm cả lượt thất
// bại, và job không ghi gì. Ghi một nửa danh sách là xoá im lặng những bonus
// đang chạy khỏi site; job đỏ thì người còn thấy để sửa parser.
//
// Hàm thuần, không import gì: test chạy bằng `node --test` trên HTML mẫu.

export type DailyDropBonus = {
  /** Tên hệ điểm nguồn, đúng chữ Daily Drop ("Chase Ultimate Rewards"). */
  from: string;
  /** Tên chương trình nhận, đúng chữ Daily Drop ("IHG One Rewards"). */
  to: string;
  bonusPercent: number;
  /** Ngày cuối còn hiệu lực, `YYYY-MM-DD`. */
  expiresOn: string;
};

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&#x27;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#\w]+;/g, (entity) => ENTITIES[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "December 10, 2026" / "Dec 10, 2026" → "2026-12-10". */
export function parseUsDate(raw: string): string {
  const match = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(raw.trim());
  if (!match) throw new Error(`Daily Drop: ngày hết hạn không đọc được: "${raw}"`);
  const [, monthName, day, year] = match;
  const month =
    MONTHS[monthName.toLowerCase()] ??
    Object.entries(MONTHS).find(([name]) => name.startsWith(monthName.toLowerCase()) && monthName.length >= 3)?.[1];
  if (!month) throw new Error(`Daily Drop: tháng không đọc được: "${raw}"`);
  const iso = `${year}-${month}-${day.padStart(2, "0")}`;
  // `Date.parse` nhận cả "2026-02-31" rồi lặng lẽ cuộn sang tháng 3 — so lại
  // ngược chiều để chặn ngày không có thật.
  if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) {
    throw new Error(`Daily Drop: ngày không có thật: "${raw}"`);
  }
  return iso;
}

export function parseDailyDropBonuses(html: string): DailyDropBonus[] {
  const start = html.indexOf('id="current-offers"');
  if (start === -1) throw new Error("Daily Drop: không thấy mục #current-offers — trang đổi cấu trúc?");

  // Mục kết thúc ở thẻ <section> kế tiếp; không có thì đọc tới cuối trang.
  const next = html.indexOf("<section", start + 1);
  const section = html.slice(start, next === -1 ? undefined : next);

  if (!/transfer-bonus-header/.test(section) || !/TRANSFER FROM/i.test(section)) {
    throw new Error("Daily Drop: mục #current-offers không còn hàng tiêu đề TRANSFER FROM — trang đổi cấu trúc?");
  }

  const items = section.split(/<div[^>]*class="[^"]*\btransfer-bonus-item\b[^"]*"[^>]*>/).slice(1);
  if (items.length === 0) {
    // Daily Drop gần như lúc nào cũng có bonus; danh sách rỗng giống markup đổi
    // tên class hơn là thật sự hết bonus. Thà đỏ một tuần còn hơn xoá sạch.
    throw new Error("Daily Drop: không đọc được bonus nào trong #current-offers");
  }

  return items.map((item, index) => {
    // Bốn ô chữ là bốn `<div>` lá đầu tiên; link "Read more" (đang ẩn) đứng sau.
    const cells = [...item.matchAll(/<div(?:\s[^>]*)?>([^<]*)<\/div>/g)]
      .map((match) => cleanText(match[1]))
      .filter((text) => text.length > 0)
      .slice(0, 4);
    if (cells.length < 4) {
      throw new Error(`Daily Drop: hàng bonus #${index + 1} thiếu ô (${JSON.stringify(cells)})`);
    }

    const [from, to, percentRaw, dateRaw] = cells;
    const percent = /^(\d{1,3})\s*%$/.exec(percentRaw);
    if (!percent) throw new Error(`Daily Drop: hàng #${index + 1} có bonus không đọc được: "${percentRaw}"`);
    const bonusPercent = Number(percent[1]);
    if (bonusPercent <= 0 || bonusPercent > 300) {
      throw new Error(`Daily Drop: hàng #${index + 1} có bonus vô lý: ${bonusPercent}%`);
    }

    return { from, to, bonusPercent, expiresOn: parseUsDate(dateRaw) };
  });
}
