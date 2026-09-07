import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
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
import "./globals.css";

/**
 * `subsets` là danh sách PRELOAD, không phải danh sách glyph được phát hành.
 * Next chỉ dùng nó để quyết định chèn `<link rel=preload>` nào vào `<head>`;
 * mọi @font-face vẫn được sinh ra đủ, và trình duyệt vẫn tự tải file còn lại
 * theo `unicode-range` khi thật sự gặp ký tự thuộc về nó — xem
 * `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`,
 * mục `subsets`.
 *
 * VÌ SAO BỎ "latin-ext": đo ngày 07/09/2026, hai file latin-ext chiếm
 * 104.5/196.5 KB — 53% toàn bộ font payload — mà cả sáu file đều được preload
 * ở mức ưu tiên cao nhất trên MỌI trang, tranh băng thông với CSS và JS ngay
 * từ byte đầu. Riêng Inter latin-ext nặng 83.3 KB, là file font lớn nhất trên
 * critical path.
 *
 * Site này viết tiếng Việt, mà tiếng Việt nằm trong subset `vietnamese`;
 * tiếng Pháp/Đức thông dụng nằm trong latin cơ bản. Chữ Séc/Ba Lan/Đông Âu
 * chỉ xuất hiện lác đác trong tên khách sạn ở vài bài review — những trang đó
 * vẫn nhận đúng font, chỉ là tải file latin-ext theo nhu cầu thay vì bắt cả
 * site trả trước.
 */
const fontHeading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

const fontBody = Inter({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
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
