import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AwardChartFinder } from "@/components/award-charts/award-chart-finder";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { t } from "@/lib/t";
import { VIETNAM_ROUTES_BASE } from "@/lib/award-routes";
import { VIETNAM_ROUTES_PUBLISHED } from "@/lib/feature-flags";
import { pageMetadata } from "@/lib/seo";

const ac = t("awardCharts");
const next = t("nextSteps");
const routes = t("awardRoutes");
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

        {/* Khối này ở TRANG chứ không nằm trong `AwardChartFinder`: công cụ đó
            đọc `useSearchParams` nên cả cây con của nó nằm sau một
            `<Suspense>` và chỉ dựng ở client. Đặt link vào trong đó thì HTML
            server trả về vẫn không có một đường nội bộ nào — người dùng có JS
            thì thấy, còn crawler thì vẫn gặp đúng cái ngõ cụt cũ. */}
        <div className="mx-auto mt-10 max-w-3xl">
          <NextSteps title={next("title")}>
            {/* Đứng đầu: "Canada đi Việt Nam" là tổ hợp được tra nhiều nhất
                trên chính công cụ này, và mười hai trang chặng trả lời sẵn câu
                đó — kèm phần chữ mà công cụ không có chỗ để nói. */}
            {VIETNAM_ROUTES_PUBLISHED && (
              <StepLink
                href={VIETNAM_ROUTES_BASE}
                label={routes("hubLabel")}
                description={routes("hubDescription")}
              />
            )}
            <StepLink
              href="/credit-cards"
              label={next("cardsLabel")}
              description={next("cardsDescription")}
            />
            <StepLink
              href="/transfer-partners"
              label={next("transferLabel")}
              description={next("transferDescription")}
            />
            <StepLink
              href="/calculator"
              label={next("calculatorLabel")}
              description={next("calculatorDescription")}
            />
          </NextSteps>
        </div>
      </section>
    </>
  );
}
