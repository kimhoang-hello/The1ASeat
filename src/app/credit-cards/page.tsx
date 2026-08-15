import type { Metadata } from "next";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { getCreditCardOffers } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { RebateBadge } from "@/components/credit-cards/rebate-badge";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { ApplyButton } from "@/components/credit-cards/apply-button";
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

export default async function CreditCardsPage() {
  const offers = await getCreditCardOffers();

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
          numberOfItems: offers.length,
          itemListElement: offers.map((offer, index) => ({
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
        {/* Two across once the page is wide enough, so the extra room goes into
            a second card rather than into 110-character lines of text. */}
        <div className="mx-auto grid max-w-page gap-5 2xl:grid-cols-2">
          {offers.map((offer) => (
            <article
              key={offer.slug}
              className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row"
            >
              <CardImage
                image={offer.cardImage}
                name={offer.name}
                className="h-32 w-full shrink-0 self-start rounded-xl sm:h-32 sm:w-40 2xl:h-36 2xl:w-44"
                badge={offer.rebate && <RebateBadge amount={offer.rebate} label={offers_t("rebate")} />}
                applyUrl={offer.applyUrl}
              />

              <div className="flex-1">
                <CardBadges
                  offer={offer}
                  cardType={`${offer.cardType} · ${offer.issuer}`}
                  elevatedBonusLabel={offers_t("elevatedBonus")}
                  expiresOnLabel={offers_t("expiresOn")}
                />

                <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">
                  <Link href={`/credit-cards/${offer.slug}`} className="cursor-pointer hover:text-primary">
                    {offer.name}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {offers_t("annualFee")}: {offer.annualFee}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{offer.headline}</p>

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

                <div className="mt-4 flex flex-wrap items-center gap-4">
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

          <OfferDisclosure className="mt-3 2xl:col-span-2" />
        </div>
      </section>
    </>
  );
}
