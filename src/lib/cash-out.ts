/**
 * Phép tính và cách viết số của trang Refundable Hotel Trick.
 *
 * Tách khỏi `refundable-hotel-trick.ts` vì calculator là Client Component: nó
 * cần mấy hàm này, nhưng không cần cả nội dung bốn workflow lẫn
 * `card-points-programs` (kéo theo dữ liệu recommendation engine) đi vào
 * bundle của trình duyệt. Server và trình duyệt dùng CÙNG các hàm này, nên ví
 * dụ in sẵn trên trang và kết quả calculator không lệch nhau được.
 */

/** `1` → "1¢", `0.5` → "0.5¢". */
export function centsLabel(centsPerPoint: number): string {
  return `${centsPerPoint}¢`;
}

/** "1 point = 1¢" — dòng tỷ lệ trên thẻ chọn và trong các bước. */
export function rateLabel(centsPerPoint: number): string {
  return `1 point = ${centsLabel(centsPerPoint)}`;
}

/** "1 point = $0.01" — cùng tỷ lệ, viết bằng đô la, dưới kết quả calculator. */
export function dollarRateLabel(centsPerPoint: number): string {
  return `1 point = $${centsPerPoint / 100}`;
}

const POINTS_FORMAT = new Intl.NumberFormat("en-US");

/** 100000 → "100,000" — dấu phẩy ngăn nghìn kiểu Anh, quy ước của site. */
export function formatPoints(points: number): string {
  return POINTS_FORMAT.format(points);
}

/**
 * Số tiền nhận được, tính bằng CENT thay vì đô la: tỷ lệ 1¢ và 0.5¢ nhân ra
 * số cent nguyên hoặc lẻ đúng nửa — biểu diễn chính xác được — còn tỷ lệ đô la
 * $0.005 thì không. Làm tròn XUỐNG: lẻ nửa cent ở TD® thì trang thà nói thiếu
 * một cent còn hơn hứa dư.
 */
export function cashOutCents(points: number, centsPerPoint: number): number {
  return Math.floor(points * centsPerPoint);
}

/** 100000 cent → "$1,000"; 6172 cent → "$61.72". `$` trần là CAD. */
export function formatDollars(totalCents: number): string {
  const whole = totalCents % 100 === 0;
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(totalCents / 100)}`;
}
