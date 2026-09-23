/**
 * `annualFee` trong Contentful là câu văn: "$120/năm (thẻ phụ: $50/năm)".
 * Con số đứng đầu là thứ so sánh được giữa các thẻ, phần trong ngoặc là điều
 * kiện — nên tách ra, số vào ô lớn còn điều kiện xuống dòng nhỏ bên dưới.
 *
 * Nhận dạng cố ý hẹp: chỉ đúng dạng "$X/năm" hoặc "Miễn phí", có thể kèm một
 * cặp ngoặc. Không khớp thì trả nguyên câu và không bịa ra phần ghi chú —
 * đoán sai một con số phí trên trang tạo doanh thu tệ hơn nhiều so với một ô
 * hơi dài. Nhưng "hơi dài" hoá ra là cả câu chữ to xuống ba dòng: 22/09/2026 có
 * 4 thẻ viết "$139/năm — miễn năm đầu (…)" và cả bốn vỡ ô, gồm hai thẻ đứng đầu
 * `/credit-cards`. Nên `audit:health` gọi đúng hàm này và báo mọi chuỗi phí nó
 * không tách được — đừng nới regex, sửa chuỗi trong Contentful về dạng
 * "$X/năm (miễn phí năm đầu; …)".
 *
 * Tách khỏi `offer-stats.tsx` để script audit import được mà không kéo theo
 * `@/lib/t` và JSX.
 *
 * Phần thập phân được nhận từ 06/09/2026. American Express Cobalt® Card là thẻ
 * đầu tiên trên site có phí lẻ ($191.88/năm), và `[\d,]+` trần dừng ở "191" rồi
 * trượt — cả câu 44 ký tự rơi vào ô số nhỏ bên phải, xuống hai dòng. Cùng dạng
 * số mà `moneyAtStart` bên `credit-card-sort.ts` vẫn luôn đọc được, nên trước
 * bản vá này hai hàm hiểu cùng một chuỗi theo hai kiểu khác nhau.
 *
 * ` USD` được nhận từ 21/09/2026 cho thẻ Mỹ ("$95 USD/năm"): `$` trần trên site
 * là đô Canada, nên phí thẻ Mỹ luôn mang chữ USD — và không nhận nó thì cả câu
 * có ghi chú trong ngoặc lại rơi vào ô số.
 */
const ANNUAL_FEE = /^(\$[\d,]+(?:\.\d+)?(?: USD)?\/năm|Miễn phí)\s*(?:\((.+)\))?$/;

export function splitAnnualFee(annualFee: string): { amount: string; note?: string } {
  const match = ANNUAL_FEE.exec(annualFee.trim());
  if (!match) return { amount: annualFee };
  return { amount: match[1], note: match[2] };
}

/** Chuỗi phí có tách được thành số + ghi chú không (xem `splitAnnualFee`). */
export function annualFeeParses(annualFee: string): boolean {
  return ANNUAL_FEE.test(annualFee.trim());
}
