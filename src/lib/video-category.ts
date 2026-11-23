/**
 * Chuyên mục cho bài video mà `api/sync-videos` tự tạo, đoán từ tiêu đề YouTube.
 *
 * Video về CHUYẾN BAY được xét trước. Trước 03/11/2026 hàm chỉ dò từ khoá khách
 * sạn, mà "suite" là một trong số đó — nên "I Flew ANA's Incredible First Class
 * THE Suite" (01/11) rơi vào "Khách sạn", hiện icon toà nhà và nằm trong trang
 * chuyên mục khách sạn. "First Class Suite" của JAL hay "Qsuite" của Qatar cũng
 * chứa đúng chuỗi đó.
 *
 * Mẫu bay cố ý HẸP (hạng ghế, "flew", tên hãng): nó chỉ quyết định khi tiêu đề
 * có từ khoá khách sạn, vì video không khớp bên nào đã rơi về "Đánh giá".
 * "fly", "flying", "flight" bị bỏ vì đứng được trong tiêu đề khách sạn
 * ("Flying Blue", "Flight Attendants") — Codex nêu 03/11.
 */
const FLIGHT_PATTERN = /\b(first|business|premium economy|economy) class\b|\bflew\b|\bairlines?\b|\bairways\b|\bqsuite\b/;

const HOTEL_KEYWORDS = [
  "hotel",
  "resort",
  "suite",
  "hyatt",
  "marriott",
  "andaz",
  "regency",
  "kimpton",
  "moxy",
  "element",
  "courtyard",
  "bonvoy",
  "caption",
];

export function categorizeVideo(title: string): {
  categoryVi: string;
  categoryEn: string;
  icon: "airplane" | "building";
} {
  const lower = title.toLowerCase();
  if (!FLIGHT_PATTERN.test(lower) && HOTEL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { categoryVi: "Khách sạn", categoryEn: "Hotel", icon: "building" };
  }
  return { categoryVi: "Đánh giá", categoryEn: "Review", icon: "airplane" };
}

/**
 * Entry trong feed Atom của YouTube có phải Shorts không — đọc ĐÚNG link
 * `rel="alternate"` của entry, không quét cả khối.
 *
 * Feed của @HoangLeCA (cả `channel_id` lẫn `playlist_id=UU…`, đo 31/08 và
 * 23/11/2026) đánh dấu Shorts bằng `href="https://www.youtube.com/shorts/…"`
 * ở link đó. Trước 23/11 route tìm "/shorts/" trong CẢ khối `<entry>`, tức cả
 * `<media:description>` — video thường mà phần mô tả trỏ sang một Short bị lọc
 * như Short, không bao giờ lên site, và job vẫn xanh (Codex 23/11/2026).
 */
export function isShortsEntry(entryXml: string): boolean {
  for (const tag of entryXml.match(/<link\b[^>]*>/g) ?? []) {
    if (!/\brel="alternate"/.test(tag)) continue;
    const href = tag.match(/\bhref="([^"]*)"/)?.[1] ?? "";
    return /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\//.test(href);
  }
  return false;
}
