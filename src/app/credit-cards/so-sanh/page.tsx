import type { Metadata } from "next";
import { getCreditCardOffers } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { ComparePicker } from "@/components/credit-cards/compare-picker";
import { CompareTable } from "@/components/credit-cards/compare-table";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import {
  COMPARE_PARAM,
  COMPARE_PATH,
  MIN_COMPARE,
  parseCompareSlugs,
} from "@/lib/card-compare";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const t = translate("compare");
const seo = translate("seo");

// Cùng cửa sổ ISR với các trang thẻ khác: bảng này đọc thẳng từ Contentful,
// nên thiếu dòng này thì nó đứng yên tới lần deploy sau.
export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: t("metaTitle"),
  description: t("metaDescription"),
  // Canonical trỏ về trang trần, không kèm `?cards=`. Mọi tổ hợp thẻ là cùng
  // một công cụ; để mỗi tổ hợp tự canonical thì Google phải chọn giữa hàng trăm
  // URL gần như giống nhau — đúng cách `/credit-cards` xử lý `?type=`.
  path: COMPARE_PATH,
});

export default async function CompareCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ [COMPARE_PARAM]?: string | string[] }>;
}) {
  const [offers, params] = await Promise.all([getCreditCardOffers(), searchParams]);

  const selected = parseCompareSlugs(params[COMPARE_PARAM], offers);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbCreditCards"), path: "/credit-cards" },
        { name: seo("breadcrumbCompare"), path: COMPARE_PATH },
      ]),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page space-y-6">
          <ComparePicker
            cards={offers.map((offer) => ({ slug: offer.slug, name: offer.name }))}
            selected={selected.map((offer) => offer.slug)}
          />

          {selected.length >= MIN_COMPARE ? (
            <>
              <CompareTable cards={selected} />
              {/* Bảng này có nút apply ở hàng cuối, nên công bố affiliate phải
                  đứng cùng trang — cùng luật với trang danh sách và trang chi
                  tiết thẻ. */}
              <OfferDisclosure />
            </>
          ) : (
            <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              {t("needMore")}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
