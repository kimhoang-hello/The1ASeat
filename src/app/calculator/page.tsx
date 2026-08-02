import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PointsCalculator } from "@/components/calculator/points-calculator";
import { t } from "@/lib/t";

const calc = t("calculator");

export const metadata: Metadata = { title: calc("title") };

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
