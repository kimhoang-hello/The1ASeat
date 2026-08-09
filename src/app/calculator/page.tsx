import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PointsCalculator } from "@/components/calculator/points-calculator";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

const calc = t("calculator");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("calculatorTitle"),
  description: seo("calculatorDescription"),
  path: "/calculator",
});

// No data fetching here, so Next would ship `s-maxage=31536000` and let
// Hostinger's CDN hold this HTML for a year — and a deploy does not purge that
// CDN. That is how these pages kept serving their pre-SEO <head> after the SEO
// deploy. An explicit window caps the CDN TTL so a deploy lands on its own.
export const revalidate = 3600;

export default function CalculatorPage() {
  return (
    <>
      <PageHeader eyebrow={calc("eyebrow")} title={calc("title")} subtitle={calc("subtitle")} />
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <PointsCalculator />
      </section>
    </>
  );
}
