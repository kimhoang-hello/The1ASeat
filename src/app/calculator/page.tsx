import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PointsCalculator } from "@/components/calculator/points-calculator";
import { getCreditCardOffers } from "@/lib/content";
import { getCardPointsPrograms } from "@/lib/card-points-programs";
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

export default async function CalculatorPage() {
  // Hệ điểm nào thật sự lọc ra được thẻ. Khối "đi tiếp" trong calculator là
  // client component nên không với tới Contentful; truyền xuống từ đây để nó
  // không bao giờ hứa một bộ lọc rỗng — `/credit-cards` cố ý cho `?points=` lạ
  // rơi về danh sách KHÔNG lọc, nên một link sai sẽ hỏng lặng chứ không báo.
  const offers = await getCreditCardOffers();
  const cardProgramIds = getCardPointsPrograms(offers).map((program) => program.id);

  return (
    <>
      <PageHeader eyebrow={calc("eyebrow")} title={calc("title")} subtitle={calc("subtitle")} />
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <PointsCalculator cardProgramIds={cardProgramIds} />
      </section>
    </>
  );
}
