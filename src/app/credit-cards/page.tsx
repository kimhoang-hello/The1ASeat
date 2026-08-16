import type { Metadata } from "next";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { getCreditCardOffers } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { ApplyButton } from "@/components/ui/apply-button";
import { JsonLd } from "@/components/seo/json-ld";
import { creditCardJsonLd } from "@/lib/credit-card-schema";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const offers_t = t("offers");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("creditCardsTitle"),
  description: seo("creditCardsDescription"),
  path: "/credit-cards",
});

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

const TABS = [
  { value: "all", labelKey: "tabAll", emptyKey: "emptyAll" },
  { value: "noi-bat", labelKey: "tabElevated", emptyKey: "emptyElevated" },
  { value: "khac", labelKey: "tabOther", emptyKey: "emptyOther" },
] as const;

export default async function CreditCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [allOffers, { type }] = await Promise.all([getCreditCardOffers(), searchParams]);

  const activeTab = type === "khac" || type === "noi-bat" ? type : "all";
  const offers = allOffers.filter(
    (offer) =>
      activeTab === "all" ||
      (activeTab === "noi-bat" ? offer.elevatedBonus : !offer.elevatedBonus),
  );

  // The ?type= views are filtered slices of the same list and both canonicalise
  // back to /credit-cards, so the ItemList describes every card, not the slice.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbCreditCards"), path: "/credit-cards" }]),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/credit-cards")}#collection`,
        name: seo("creditCardsTitle"),
        description: seo("creditCardsDescription"),
        url: absoluteUrl("/credit-cards"),
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: allOffers.length,
          itemListElement: allOffers.map((offer, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(`/credit-cards/${offer.slug}`),
            item: creditCardJsonLd(offer),
          })),
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={offers_t("eyebrow")} title={offers_t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto mb-6 flex max-w-page gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/credit-cards" : `/credit-cards?type=${tab.value}`}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground/70 hover:text-foreground"
              }`}
            >
              {offers_t(tab.labelKey)}
            </Link>
          ))}
        </div>

        {/* Two across once the page is wide enough, so the extra room goes into
            a second card rather than into 110-character lines of text. */}
        <div className="mx-auto grid max-w-page gap-5 xl:grid-cols-2">
          {offers.map((offer) => (
            <article
              key={offer.slug}
              className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row"
            >
              <CardImage
                image={offer.cardImage}
                name={offer.name}
                className="h-32 w-full shrink-0 self-start rounded-xl sm:h-32 sm:w-40 xl:h-36 xl:w-44"
                applyUrl={offer.applyUrl}
                sizes="176px"
              />

              {/* A column so the actions can sit on the bottom edge — side by
                  side, cards whose copy runs to different lengths would
                  otherwise put their Apply buttons at different heights. */}
              <div className="flex flex-1 flex-col">
                <CardBadges
                  offer={offer}
                  cardType={offer.cardType}
                  elevatedBonusLabel={offers_t("elevatedBonus")}
                  expiresOnLabel={offers_t("expiresOn")}
          rebateLabel={offers_t("rebate")}
                />

                <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">
                  <Link href={`/credit-cards/${offer.slug}`} className="cursor-pointer hover:text-primary">
                    {offer.name}
                  </Link>
                </h2>
                {/* Dòng "Phí thường niên: $120/năm (thẻ phụ...)" cũ nói đúng
                    một nửa câu chuyện và nói nhỏ. Dải số liệu nói cả hai nửa:
                    bonus nhận được và phí phải trả. */}
                <OfferStats offer={offer} className="mt-3" />

                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{offer.headline}</p>

                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-foreground/80 hover:text-primary">
                    <CaretDown size={14} className="transition-transform group-open:rotate-180" />
                    {offers_t("keyBenefits")}
                  </summary>
                  <ul className="ml-5 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
                    {offer.keyBenefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </details>

                <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    href={`/credit-cards/${offer.slug}`}
                    className="cursor-pointer text-sm font-semibold text-foreground/80 hover:text-primary hover:underline"
                  >
                    {offers_t("editorsTake")} &rarr;
                  </Link>
                  <ApplyButton href={offer.applyUrl} />
                </div>
              </div>
            </article>
          ))}

          {offers.length === 0 && (
            <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground xl:col-span-2">
              {offers_t(TABS.find((tab) => tab.value === activeTab)!.emptyKey)}
            </p>
          )}

          <OfferDisclosure className="mt-3 xl:col-span-2" />
        </div>
      </section>
    </>
  );
}
