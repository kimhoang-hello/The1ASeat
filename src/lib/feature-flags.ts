/**
 * Những trang đã có code nhưng chưa muốn công bố.
 *
 * Cách hoạt động: trang vẫn build và vẫn vào được bằng URL trực tiếp — để tác
 * giả xem và sửa trên chính bản deploy thật — nhưng không xuất hiện ở bất cứ
 * chỗ nào người đọc có thể tình cờ bấm vào: menu, footer, sitemap, ô tìm kiếm.
 * Trang cũng tự gắn `noindex` để Google không đưa bản chưa xong lên kết quả
 * tìm kiếm, và tự hiện một dải báo "bản nháp" để không ai nhầm nó là nội dung
 * chính thức.
 *
 * Đổi cờ này thành `true` là công bố — không cần sửa chỗ nào khác.
 */

/**
 * Trang Ngân hàng (`/bank-accounts`). Tắt từ 16/08/2026 theo yêu cầu: dữ liệu
 * mới có BMO® và Scotiabank®, cần rà kỹ số liệu và bổ sung ngân hàng trước
 * khi cho người đọc thấy.
 */
export const BANK_ACCOUNTS_PUBLISHED = false;
