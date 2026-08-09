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
