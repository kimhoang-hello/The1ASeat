/**
 * Lỗi này có phải thứ chạy lại sau 30 giây thì khỏi không?
 *
 * Gắn cờ theo HÌNH DẠNG lỗi chứ không theo "nó ném ra từ khối try nào", vì
 * cùng một khối `catch` nhận cả hai loại: `fetchPage` hết giờ (khỏi) lẫn
 * FinlyWealth trả 404 hay đổi thẻ `<title>` (không bao giờ khỏi), và
 * `updateEntry` trả 401 vì token sai (không bao giờ khỏi).
 *
 * MẶC ĐỊNH LÀ CÓ. Đoán sai theo hướng "chạy lại thừa" thì mất một lượt đọc
 * FinlyWealth; đoán sai theo hướng "bỏ qua" thì mất cả lượt kiểm và chờ 12
 * tiếng — đúng cái mà lượt thứ hai trong ngày sinh ra để chặn. Nên chỉ những
 * hình dạng CHẮC CHẮN vĩnh viễn mới bị loại ra:
 *
 *  - HTTP 4xx, TRỪ 408/429/409: sai đường dẫn, sai token, bị chặn. Chạy lại y
 *    hệt. Ba mã kia là ngoại lệ có thật: 408/429 là "thử lại sau", còn **409
 *    của Contentful là `VersionMismatch`** — entry đổi version giữa lúc
 *    `listEntries` đọc và `updateEntry` PUT. Lượt sau đọc lại version mới nên
 *    có cơ thành công, và đây là hình dạng job này DỄ GẶP nhất khi có người
 *    đang sửa entry trong Contentful cùng lúc job chạy.
 *  - Không đọc được số từ `<title>`: FinlyWealth đổi markup, cần người sửa
 *    `rebateFromTitle`.
 *
 * Mã trạng thái phải đọc từ CHUỖI vì cả `fetchPage` lẫn `updateEntry` đều ném
 * `Error` trần (`"404 Not Found"`, `"Update failed: 401 …"`). Đọc hụt thì rơi
 * về mặc định "chạy lại", tức về đúng hành vi của `curl --retry` cũ.
 */
export function isTransient(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);

  // `no <title> on the page` và `no rebate in title: …` từ `rebateFromTitle`.
  if (/^no (<title>|rebate in title)/.test(message)) return false;

  const status = Number(message.match(/\b(\d{3})\b/)?.[1]);
  const RETRYABLE_4XX = new Set([408, 409, 429]);
  if (status >= 400 && status < 500 && !RETRYABLE_4XX.has(status)) return false;

  return true;
}
