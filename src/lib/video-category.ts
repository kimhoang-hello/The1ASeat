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
