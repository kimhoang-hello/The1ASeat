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
 * Trang Ngân hàng (`/bank-accounts`). Tắt sáng 16/08/2026 để rà lại số liệu,
 * bật lại chiều cùng ngày: 10 tài khoản của Scotiabank® và BMO®, số liệu đối
 * chiếu từ chính trang FinlyWealth mà nút "Apply ngay" dẫn tới.
 */
export const BANK_ACCOUNTS_PUBLISHED = true;

/**
 * Trang "Bắt đầu ở đây" (`/bat-dau`). Dựng 30/08/2026 làm bản demo để duyệt —
 * nội dung và thứ tự bốn bước còn chờ tác giả xem. Bật cờ là công bố: nó hiện
 * dải "Chưa biết bắt đầu từ đâu?" trên trang chủ, vào sitemap, vào ô tìm kiếm,
 * bỏ `noindex` và bỏ dải báo nháp cùng một lúc.
 *
 * KHÔNG vào menu trên cùng và KHÔNG vào footer: tác giả chốt 30/08/2026 rằng
 * trang này chỉ cần đúng một cửa — dải trên trang chủ, ngay dưới ô đăng ký bản
 * tin. Hai chỗ điều hướng cố định kia dành cho những mục người ta quay lại
 * nhiều lần, mà "Bắt đầu ở đây" theo định nghĩa là trang đọc một lần.
 */
export const START_HERE_PUBLISHED = false;
