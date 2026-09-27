import type { NextConfig } from "next";

/**
 * Content-Security-Policy. Thêm 26/09/2026 — trước đó chỉ có
 * `upgrade-insecure-requests` do Hostinger tự gắn (header đó vẫn còn; hai
 * header CSP cùng có hiệu lực, trình duyệt áp CẢ HAI).
 *
 * `'unsafe-inline'` trong `script-src` là CỐ Ý: Next chèn script inline để
 * hydrate, và cách duy nhất bỏ được nó là nonce theo từng request — thứ biến
 * mọi trang tĩnh/ISR thành render động. Cái CSP này vẫn làm được việc: chặn
 * script tải từ host lạ, chặn `<object>`/`<embed>`, chặn đổi `<base>` (cách
 * bẻ mọi đường dẫn tương đối), chặn form gửi ra ngoài, chặn bị nhúng iframe.
 *
 * Danh sách host lấy từ chính những gì site tải, kiểm 26/09/2026:
 *  - GA4 qua `@next/third-parties` (gtag): googletagmanager.com, gửi hit tới
 *    *.google-analytics.com / *.analytics.google.com; Google Signals thêm
 *    *.g.doubleclick.net và www.google.com.
 *  - Cusdis (bình luận): script + style từ cusdis.com, và khung bình luận là
 *    iframe `srcdoc` — `srcdoc` THỪA KẾ CSP của trang cha, nên script, style
 *    và lượt gọi API bên trong nó cũng phải qua được danh sách này.
 *  - Video: iframe YouTube / Vimeo (`lib/video-embed.ts`).
 *  - Ảnh: Contentful và YouTube đi qua `/_next/image` (tức `'self'`); `https:`
 *    để lại cho ảnh bên thứ ba ít ỏi (pixel GA, ảnh trong bình luận).
 *
 * Thêm một dịch vụ nhúng mới mà quên sửa ở đây thì nó GÃY TRONG IM LẶNG trên
 * production (chỉ có một dòng lỗi CSP trong console) — kiểm console sau mỗi
 * lần thêm.
 */
const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  // `'unsafe-eval'` chỉ ở dev: React dùng eval để dựng lại call stack.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.googletagmanager.com https://cusdis.com`,
  "style-src 'self' 'unsafe-inline' https://cusdis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://cusdis.com${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // `X-Powered-By: Next.js` chỉ kể cho người dò quét biết nên thử lỗ nào.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.ctfassets.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },

  // Hostinger chỉ gắn sẵn `content-security-policy: upgrade-insecure-requests`,
  // ngoài ra không có header bảo mật nào — kiểm bằng `curl -I` ngày 29/08/2026.
  // Bốn cái dưới đây là loại "đặt xong quên đi": chúng không đổi cách trang
  // render, chỉ đóng bớt những thứ trình duyệt cho phép theo mặc định.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Một năm, chỉ cho chính host trả header này. CỐ Ý KHÔNG có
          // `includeSubDomains` và KHÔNG có `preload`: cả hai đều rất khó rút
          // lại — `includeSubDomains` khoá luôn mọi subdomain sau này (kể cả
          // thứ Hostinger tự dựng cho webmail hay staging) vào HTTPS, còn
          // `preload` thì phải xin gỡ khỏi danh sách nhúng sẵn trong trình
          // duyệt và chờ vài phiên bản. Site hiện chỉ chạy trên apex + www,
          // cả hai đều đã HTTPS, nên bản gọn này đủ.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          // Trình duyệt thôi đoán lại kiểu file. Quan trọng nhất với ảnh và
          // JSON do người khác gửi lên (asset Contentful, feed) — một file được
          // đoán thành HTML là một file chạy được script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sang site khác thì chỉ gửi origin, không gửi đường dẫn đầy đủ. Site
          // trỏ ra ngoài rất nhiều (FinlyWealth, ngân hàng), không có lý do gì
          // để kể cho họ người đọc vừa ở trang nào.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Không cho site khác nhét trang này vào iframe của họ. Không ảnh
          // hưởng iframe YouTube TRONG trang — header này nói về chiều ngược
          // lại.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Không trang nào ở đây cần camera/mic/vị trí, nên đóng sẵn: thứ
          // không bật thì không hỏng được.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // www.ghe1a.com used to serve the whole site at 200 alongside the apex
      // domain, so every page existed at two URLs and Google had to guess
      // which one to index. Send www to the apex permanently.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ghe1a.com" }],
        destination: "https://ghe1a.com/:path*",
        permanent: true,
      },
      // /blog/chuyen-muc is only a container for the category archives below
      // it; on its own it would fall through to /blog/[slug] and 404.
      {
        source: "/blog/chuyen-muc",
        destination: "/blog",
        permanent: true,
      },
      // The award tool shipped at /award-charts before it was named. It was in
      // the sitemap under that path, so the old URL has to keep resolving.
      {
        source: "/award-charts",
        destination: "/award-flight-finder",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
