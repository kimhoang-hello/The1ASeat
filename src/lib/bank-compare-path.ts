/**
 * Đường dẫn và tên tham số của trang so sánh tài khoản — và KHÔNG GÌ KHÁC.
 *
 * Tách khỏi `bank-compare.ts` vì một lý do đo được: `SiteHeader` là Client
 * Component nằm trong layout gốc, nên nó có mặt trên MỌI trang. Nó chỉ cần
 * đúng một chuỗi (`BANK_COMPARE_PATH`) để dựng dòng menu, nhưng
 * `bank-compare.ts` lại import `BANK_ACCOUNTS` — 1,156 dòng dữ liệu tài khoản
 * ngân hàng — cho các hàm khác của nó. Import một hằng số là kéo cả file dữ
 * liệu vào chunk dùng chung: `/about`, `/terms`, `/calculator` đều tải khoảng
 * 19 KB gzip mà không trang nào trong số đó hiện một tài khoản ngân hàng nào.
 *
 * Nên module này không được import bất cứ thứ gì. Thêm một import vào đây là
 * mở lại đúng đường rò đó, và nó sẽ không đỏ ở đâu cả — chỉ nặng thêm.
 */

/** Trang so sánh tài khoản. Route tĩnh nằm cạnh `/bank-accounts/[slug]`. */
export const BANK_COMPARE_PATH = "/bank-accounts/so-sanh";

/** Tên tham số trên URL, khớp với `?bank=`/`?filter=`/`?sort=` của trang danh
 *  sách: tiếng Anh, số nhiều. */
export const BANK_COMPARE_PARAM = "accounts";

/** Đoạn đường dẫn mà không tài khoản nào được phép mang làm slug. */
export const BANK_RESERVED_SLUG = BANK_COMPARE_PATH.slice("/bank-accounts/".length);
