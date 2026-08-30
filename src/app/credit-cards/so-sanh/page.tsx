import type { Metadata } from "next";
import Link from "next/link";
import { getCreditCardOffers } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { ComparePicker } from "@/components/ui/compare-picker";
import { CompareTable } from "@/components/credit-cards/compare-table";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";
import {
  COMPARE_PARAM,
  COMPARE_PATH,
  MAX_COMPARE,
  MIN_COMPARE,
  comparePathWithParams,
  parseCompareSlugs,
} from "@/lib/card-compare";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const t = translate("compare");
const next = translate("nextSteps");
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
  // Không chỉ `cards`: cặp gợi ý phải dựng lại URL kèm mọi tham số đang có,
  // nên trang cần thấy hết — `utm_*` của chiến dịch là lý do.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [offers, params] = await Promise.all([getCreditCardOffers(), searchParams]);

  const selected = parseCompareSlugs(params[COMPARE_PARAM], offers);

  // Một thẻ đầu tiên của MỖI nhà phát hành rồi mới ghép cặp — cùng lý do với
  // trang so sánh tài khoản: đặt hai thẻ cùng ngân hàng cạnh nhau là một so
  // sánh nhạt, mà đây lại là thứ đầu tiên người chưa biết chọn gì nhìn thấy.
  // Cắt theo dữ liệu thật chứ không gán slug tay: thẻ trong Contentful bị gỡ
  // hoặc đổi slug thì link gợi ý sẽ chết mà không ai biết.
  const onePerIssuer = offers.filter(
    (offer, i, all) => all.findIndex((other) => other.issuer === offer.issuer) === i,
  );
  const suggestedPairs = [onePerIssuer.slice(0, 2), onePerIssuer.slice(2, 4)].filter(
    (pair) => pair.length === MIN_COMPARE,
  );

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
            path={COMPARE_PATH}
            param={COMPARE_PARAM}
            items={offers.map((offer) => ({ slug: offer.slug, name: offer.name }))}
            selected={selected.map((offer) => offer.slug)}
            labels={{
              title: t("pickerTitle"),
              slots: Array.from({ length: MAX_COMPARE }, (_, i) =>
                t("pickerCard", { index: i + 1 }),
              ),
              empty: t("pickerEmpty"),
            }}
          />

          {selected.length >= MIN_COMPARE ? (
            <>
              <CompareTable cards={selected} />
              {/* Bảng này có nút apply ở hàng cuối, nên công bố affiliate phải
                  đứng cùng trang — cùng luật với trang danh sách và trang chi
                  tiết thẻ. */}
              <OfferDisclosure />

              {/* So xong mà vẫn chưa quyết được là kết cục thường gặp nhất của
                  trang này, và trước khối này nó không dẫn đi đâu. */}
              <NextSteps title={next("title")} className="pt-4">
                {/* Gác sau cờ như mọi lối vào /bat-dau khác (trang chủ, about,
                    sitemap, search): tắt cờ thì trang này cũng thôi mời. */}
                {START_HERE_PUBLISHED && (
                  <StepLink
                    href="/bat-dau"
                    label={next("startHereLabel")}
                    description={next("startHereDescription")}
                  />
                )}
                <StepLink
                  href="/credit-cards"
                  label={next("cardsLabel")}
                  description={next("cardsDescription")}
                />
              </NextSteps>
            </>
          ) : (
            /* Vào trang này từ menu là thấy picker rỗng cộng đúng một dòng chữ.
               Picker là form client-side chứ không phải link, nên với người
               chưa biết chọn gì — và với crawler — trang trắng đường hoàn toàn.
               Cặp gợi ý dựng từ chính `offers` nên không bao giờ trỏ vào thẻ đã
               bị gỡ khỏi Contentful. */
            <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("needMore")}</p>

              {suggestedPairs.length > 0 && (
                <>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("suggestTitle")}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {suggestedPairs.map((pair) => (
                      <Link
                        key={pair.map((card) => card.slug).join("-")}
                        href={comparePathWithParams(
                          pair.map((card) => card.slug),
                          params,
                        )}
                        className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {pair.map((card) => card.name).join(" vs ")}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-6">
                <Link
                  href="/credit-cards"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  &larr; {t("needMoreCta")}
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
