import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { t } from "@/lib/t";
import { SITE_URL } from "@/lib/subscriber-email";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${site("name")} — ${site("tagline")}`,
    template: `%s | ${site("name")}`,
  },
  description: site("tagline"),
  openGraph: {
    siteName: site("name"),
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="vi" className={`${fontHeading.variable} ${fontBody.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
