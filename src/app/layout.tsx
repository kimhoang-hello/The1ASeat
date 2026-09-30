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
 * Hostinger nhận về CSS mà Turbopack không đọc được ("next/font/google queries
 * have exactly one entry" ở Plus Jakarta Sans) — 8 lượt deploy liền hỏng trong
 * khi build trên máy và CI vẫn xanh, vì chỉ Hostinger nhận phản hồi khác. Font
 * nằm trong repo thì build không còn phụ thuộc mạng.
 *
 * Mỗi họ là MỘT file variable woff2, dựng từ font gốc OFL (google/fonts) bằng
 * fonttools: cắt trục wght về đúng dải site dùng (Inter còn ghim opsz=14), rồi
 * subset về đúng hai subset `latin` + `vietnamese` của Google — cùng
 * unicode-range với CSS Google phục vụ. Gộp hai subset không làm nặng thêm:
 * mọi trang đều viết tiếng Việt nên trước đây cả hai file vốn đã tải hết.
 * Đo 29/09/2026: 87.5 KB so với 94.3 KB của Google, và 2 request thay vì 4.
 *
 * `latin-ext` vẫn bỏ như quyết định 07/09/2026 (53% payload font lúc đó). Chữ
 * Đông Âu lác đác trong tên khách sạn sẽ hiện bằng font fallback đã chỉnh
 * metric thay vì tải file latin-ext theo nhu cầu.
 *
 * Đổi dải weight thì phải dựng lại file — xem OFL-*.txt cùng thư mục cho giấy
 * phép.
 */
const fontHeading = localFont({
  src: [{ path: "./fonts/plus-jakarta-sans-600-800.woff2", weight: "600 800", style: "normal" }],
  variable: "--font-heading",
  display: "swap",
});

const fontBody = localFont({
  src: [{ path: "./fonts/inter-400-700.woff2", weight: "400 700", style: "normal" }],
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
    <html lang="vi" className={`${fontHeading.variable} ${fontBody.variable} h-full antialiased`}>
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
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
