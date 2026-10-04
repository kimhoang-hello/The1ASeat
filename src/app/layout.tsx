import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleAnalytics } from "@next/third-parties/google";
import { FeaturedOfferBanner } from "@/components/layout/featured-offer-banner";
import { SiteHeader } from "@/components/layout/site-header";
import { StickyChrome } from "@/components/layout/sticky-chrome";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { t } from "@/lib/t";
import { SITE_URL } from "@/lib/subscriber-email";
import { ORGANIZATION_SAME_AS } from "@/lib/social-links";
import { alternatesWithFeed } from "@/lib/seo";
import { CSP_META } from "@/lib/content-security-policy";
import "./globals.css";

/**
 * Font TỰ HOST, không dùng `next/font/google`.
 *
 * `next/font/google` tải font từ Google LÚC BUILD. Từ 27/09/2026 máy build của
 * Hostinger nhận về CSS mà Turbopack không đọc được — 8 lượt deploy liền hỏng
 * trong khi build trên máy và CI vẫn xanh. Font nằm trong repo thì build không
 * còn phụ thuộc mạng.
 *
 * MỘT họ font cho cả tiêu đề lẫn thân bài: Be Vietnam Pro (chốt 03/10/2026 sau
 * audit UX/UI, thay cặp Plus Jakarta Sans + Inter). Thiết kế cho tiếng Việt, dấu
 * vẽ theo dạng thích ứng thay vì gắn thêm vào chữ Latin. Bản Google Fonts chỉ có
 * file tĩnh, nên bốn file cho bốn độ đậm site dùng: 400 thân bài, 500
 * (`font-medium`, 48 chỗ), 600 nhãn và nút, 700 tiêu đề. `font-extrabold` không
 * có file riêng và hiện bằng 700 — đừng thêm 800 lại.
 *
 * Mỗi file dựng từ TTF gốc OFL (google/fonts, ofl/bevietnampro) bằng fonttools:
 * `pyftsubset --unicodes=<latin + vietnamese của Google> --layout-features='*'
 * --flavor=woff2 --no-hinting --desubroutinize`. Bốn file 67 KB, so với 87.5 KB
 * của hai file variable trước đây. Mũi tên → không có trong font (cũng không có
 * trong bộ cũ) nên hiện bằng font hệ thống.
 *
 * Hai biến CSS vẫn tồn tại (`--font-heading` cho `font-display`, `--font-body`
 * cho thân bài) và cùng trỏ về một họ — tách lại hai họ sau này chỉ cần đổi ở
 * đây. Xem OFL-BeVietnamPro.txt cùng thư mục cho giấy phép.
 */
const fontSans = localFont({
  src: [
    { path: "./fonts/be-vietnam-pro-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/be-vietnam-pro-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/be-vietnam-pro-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/be-vietnam-pro-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

const site = t("site");
const seo = t("seo");

// Set this in Hostinger's environment variables to the token Google Search
// Console gives you for the "HTML tag" verification method (the content="..."
// value only, not the whole tag).
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${site("name")} — ${seo("homeTitle")}`,
    template: `%s | ${site("name")}`,
  },
  description: seo("homeDescription"),
  alternates: alternatesWithFeed,
  openGraph: {
    siteName: site("name"),
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  ...(googleSiteVerification && { verification: { google: googleSiteVerification } }),
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: site("name"),
      description: seo("homeDescription"),
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/logo.png`,
        width: 477,
        height: 480,
      },
      sameAs: ORGANIZATION_SAME_AS,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: site("name"),
      alternateName: `${site("name")} — ${site("tagline")}`,
      description: seo("homeDescription"),
      url: SITE_URL,
      inLanguage: "vi-VN",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="vi" className={`${fontSans.variable} h-full antialiased`}>
      <head>
        {/* Bản CSP có hiệu lực trên ghe1a.com: edge Hostinger ghi đè header
            CSP của app, còn HTML thì không đụng tới. Xem
            `lib/content-security-policy.ts`. */}
        <meta httpEquiv="Content-Security-Policy" content={CSP_META} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <JsonLd data={siteJsonLd} />
        {/* Hidden until it is tabbed to. Without it a keyboard reader crosses
            the logo, four nav items, three dropdowns and the newsletter button
            before reaching the page itself — on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          {t("common")("skipToContent")}
        </a>
        {/* The strip and the nav bar stick to the top as one block. Sticking
            them separately would mean pinning the bar at a fixed offset, and
            the strip is not a fixed height — it wraps onto a second line on a
            phone, and disappears entirely once it is dismissed.
            `StickyChrome` là chỗ quyết định trang nào KHÔNG dính. */}
        <StickyChrome>
          <FeaturedOfferBanner />
          <SiteHeader />
        </StickyChrome>
        {/* `scroll-mt-chrome`: link "Bỏ qua" nhảy tới đây, và thiếu khoảng chừa
            thì trình duyệt cuộn `main` lên sát mép trên — đúng chỗ khối dính
            đang che, tức nuốt mất eyebrow và nửa H1 của trang. */}
        <main id="main" className="flex-1 scroll-mt-chrome">
          {children}
        </main>
        <SiteFooter />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
