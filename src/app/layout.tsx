import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { FeaturedOfferBanner } from "@/components/layout/featured-offer-banner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { t } from "@/lib/t";
import { SITE_URL } from "@/lib/subscriber-email";
import { SOCIAL_SAME_AS } from "@/lib/social-links";
import { alternatesWithFeed } from "@/lib/seo";
import "./globals.css";

const fontHeading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["600", "700", "800"],
});

const fontBody = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext", "vietnamese"],
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
      sameAs: SOCIAL_SAME_AS,
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
            phone, and disappears entirely once it is dismissed. */}
        <div className="sticky top-0 z-50">
          <FeaturedOfferBanner />
          <SiteHeader />
        </div>
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
