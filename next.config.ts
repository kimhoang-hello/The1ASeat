import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
