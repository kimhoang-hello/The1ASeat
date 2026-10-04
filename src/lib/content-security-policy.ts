/**
 * Content-Security-Policy. Thêm 26/09/2026 — trước đó chỉ có
 * `upgrade-insecure-requests` do Hostinger tự gắn.
 *
 * PHÁT HAI ĐƯỜNG, và đường có hiệu lực trên production là thẻ `<meta>`:
 * edge của Hostinger GHI ĐÈ header `Content-Security-Policy` của app bằng bản
 * `upgrade-insecure-requests` của nó, trên mọi response (tĩnh, động, 404 —
 * kiểm 27/09/2026 ngay sau deploy). HTML thì nó không đụng tới. Header vẫn
 * giữ (`next.config.ts`) cho local và cho ngày Hostinger thôi ghi đè.
 *
 * `frame-ancestors` KHÔNG có hiệu lực trong `<meta>` (trình duyệt bỏ qua và
 * cảnh báo), nên bản meta không mang nó. Chiều "không cho site khác nhúng
 * trang này" vẫn do header `X-Frame-Options` lo — header đó Hostinger để
 * nguyên.
 *
 * `'unsafe-inline'` trong `script-src` là CỐ Ý: Next chèn script inline để
 * hydrate, và cách duy nhất bỏ được nó là nonce theo từng request — thứ biến
 * mọi trang tĩnh/ISR thành render động (và nonce thì không đi được qua thẻ
 * meta của một trang dựng sẵn). CSP này vẫn làm được việc: chặn script tải từ
 * host lạ, chặn `<object>`/`<embed>`, chặn đổi `<base>` (cách bẻ mọi đường
 * dẫn tương đối), chặn form gửi ra ngoài.
 *
 * Danh sách host lấy từ chính những gì site tải, kiểm 26/09/2026:
 *  - GA4 qua `@next/third-parties` (gtag): googletagmanager.com, gửi hit tới
 *    *.google-analytics.com / *.analytics.google.com; Google Signals thêm
 *    *.g.doubleclick.net và www.google.com.
 *  - Cusdis (bình luận) ĐÃ GỠ 03/10/2026: iframe.umd.js của họ trả 521 từ
 *    trước 26/09 và khung bình luận trống ở mọi bài. Thêm lại một dịch vụ
 *    bình luận thì nhớ khung `srcdoc` THỪA KẾ CSP của trang cha.
 *  - Video: iframe YouTube / Vimeo (`lib/video-embed.ts`).
 *  - Ảnh: Contentful và YouTube đi qua `/_next/image` (tức `'self'`); `https:`
 *    để lại cho ảnh bên thứ ba ít ỏi (pixel GA).
 *
 * Thêm một dịch vụ nhúng mới mà quên sửa ở đây thì nó GÃY TRONG IM LẶNG trên
 * production (chỉ có một dòng lỗi CSP trong console) — kiểm console sau mỗi
 * lần thêm.
 */

const isDev = process.env.NODE_ENV === "development";

const DIRECTIVES = [
  "default-src 'self'",
  // `'unsafe-eval'` chỉ ở dev: React dùng eval để dựng lại call stack.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** Bản đầy đủ cho header HTTP. */
export const CSP_HEADER = [...DIRECTIVES, "frame-ancestors 'self'"].join("; ");

/** Bản cho `<meta http-equiv>` — không có `frame-ancestors` (xem trên). */
export const CSP_META = DIRECTIVES.join("; ");
