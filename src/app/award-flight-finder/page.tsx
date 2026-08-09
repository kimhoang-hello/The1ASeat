import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AwardChartFinder } from "@/components/award-charts/award-chart-finder";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

const ac = t("awardCharts");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("awardChartsTitle"),
  description: seo("awardChartsDescription"),
  path: "/award-flight-finder",
});

// Same reasoning as /calculator: with no data fetching Next would hand the CDN
// a one-year s-maxage for this HTML, and a deploy does not purge that cache.
export const revalidate = 3600;

export default function AwardChartsPage() {
  return (
    <>
      <PageHeader eyebrow={ac("eyebrow")} title={ac("title")} subtitle={ac("subtitle")} />
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <AwardChartFinder />
      </section>
    </>
  );
}
