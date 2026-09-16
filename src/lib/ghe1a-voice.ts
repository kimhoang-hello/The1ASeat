/**
 * Luật viết của Ghế 1A khi nhờ Claude viết chữ — MỘT bản cho mọi prompt.
 *
 * Có hai chỗ gọi Claude viết tiếng Việt cho người đọc: viết lại offer thẻ
 * (`rewrite-offer.ts`) và lời giải thích của trang gợi ý
 * (`recommender/explain-llm.ts`). Hai prompt tự viết luật riêng thì sớm muộn
 * một bên ghi "35.000" còn bên kia ghi "35,000" — đúng loại lệch mà memory của
 * dự án đã phải sửa một lần bằng tay.
 *
 * Chuỗi này phải giữ NGUYÊN từng byte như khi nó còn nằm trong
 * `rewrite-offer.ts`: đổi nó là đổi prompt của job `expire-offers` đang chạy
 * trên production.
 */
export const GHE1A_VOICE_RULES = `- Viết bằng tiếng Việt, xưng hô với người đọc là "bạn".
- Số dùng dấu phẩy ngăn cách hàng nghìn kiểu tiếng Anh: 35,000 — không phải 35.000.
- Ngoài danh sách trên thì viết tiếng Việt: hạng ghế là "hạng phổ thông" / "hạng phổ thông
  đặc biệt" / "hạng thương gia" (KHÔNG phải economy/business class), "đăng ký" chứ không
  phải "register", "đánh giá" chứ không phải "review", "thẻ tín dụng" chứ không phải
  "credit card", "đặt vé" chứ không phải "booking".
- Dấu $ trần nghĩa là đô la Canada. Chỉ dùng "US$" cho số tiền đô la Mỹ thật sự.
- Giữ nguyên tiếng Anh các thuật ngữ: welcome bonus, elevated offer, annual fee, monthly fee, rebate, transfer bonus, cashback, deal, companion pass, lounge, chequing, savings, direct deposit, dynamic pricing, award chart.
- Giữ ký hiệu ® và ™ ở tên ngân hàng và chương trình (Scene+™, American Express®, Aeroplan®, Star Alliance™...).`;
