/**
 * Đọc chữ Contentful của một thẻ cho `audit:reco-data` — tách khỏi script để
 * có test: khuôn miễn phí năm đầu sai năm lần qua ba vòng Codex (21/10/2026),
 * mỗi lần theo đúng một trong hai chiều — đỏ oan hoặc bỏ lọt. Bảng ca hai chiều
 * ở `audit-text.test.ts`.
 */

/**
 * Chữ trên trang thẻ có nói miễn annual fee năm đầu — VÔ ĐIỀU KIỆN — không.
 *
 * Khuôn CHẶT, đúng các cách site viết ("miễn phí năm đầu", "miễn annual fee $139
 * (trong) năm đầu", "năm đầu được miễn annual fee"): khuôn lỏng đọc "miễn phí
 * giao dịch ngoại tệ trong năm đầu" và "năm đầu không được miễn" thành miễn
 * annual fee (Codex, vòng bác bản vá 21/10/2026). Bỏ câu phủ định đứng trước
 * ("không còn miễn…", "hết miễn…") và câu có điều kiện đứng sau ("… nếu giữ số
 * dư $6,000"): seed `annualFeeFirstYear` là ưu đãi cho MỌI người mở thẻ, còn miễn
 * có điều kiện là một quyền lợi (`annual_fee_waiver_conditional`).
 */
export function mentionsFirstYearWaiver(text: string): boolean {
  const fee = String.raw`(?:annual fee|phí thường niên|phí)`;
  const pattern = new RegExp(
    // Câu đảo phải DỪNG ở phí: "năm đầu được miễn phí giao dịch ngoại tệ" không
    // nói gì về annual fee (Codex, vòng chốt 21/10/2026).
    String.raw`miễn ${fee}(?: \$[\d,]+)?(?: trong| cho)? năm đầu|năm đầu (?:được )?miễn ${fee}(?: \$[\d,]+)?(?=\s*(?:$|[.,;:|()$]|cho |và |kể cả ))`,
    "gi",
  );
  return [...text.matchAll(pattern)].some((match) => {
    const before = text.slice(Math.max(0, match.index - 20), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 20);
    return (
      !/(?:không|hết|bỏ|chưa)(?: còn)?(?: được)?\s*$/i.test(before) &&
      !/^\s*,?\s*(?:nếu|khi|với điều kiện|chỉ khi)\b/i.test(after)
    );
  });
}

/**
 * `welcomeBonusVi` có hứa một welcome bonus nào không. Trống hoặc câu phủ định
 * ("Không có welcome bonus") thì không — đối chiếu với một seed đã hết offer
 * là KHỚP, không phải lệch (Codex, vòng bác bản vá 21/10/2026).
 */
export function promisesBonus(text: string | undefined): boolean {
  const value = text?.trim() ?? "";
  return value !== "" && !/^(?:không|chưa|hết)\b/i.test(value);
}
