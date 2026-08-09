import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { t } from "@/lib/t";
import { SITE_URL } from "@/lib/subscriber-email";
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
      sameAs: ["https://youtube.com/@hoangleca"],
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
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
