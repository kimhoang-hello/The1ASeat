import type { Metadata } from "next";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { getCreditCardOffers } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { t } from "@/lib/t";

const offers_t = t("offers");

export const metadata: Metadata = { title: offers_t("title") };

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export default async function CreditCardsPage() {
  const offers = await getCreditCardOffers();

  return (
    <>
      <PageHeader eyebrow={offers_t("eyebrow")} title={offers_t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          {offers.map((offer) => (
            <article
              key={offer.slug}
              className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row"
            >
              <MediaPlaceholder
                icon="credit-card"
                tone="tan"
                className="h-32 w-full shrink-0 rounded-xl sm:h-auto sm:w-40"
              />

              <div className="flex-1">
                <CardBadges
                  offer={offer}
                  cardType={`${offer.cardType} · ${offer.issuer}`}
                  elevatedBonusLabel={offers_t("elevatedBonus")}
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
                  <a
                    href={offer.applyUrl}
                    className="cursor-pointer text-sm font-bold text-primary underline decoration-2 underline-offset-4 hover:text-primary-hover"
                  >
                    {offers_t("viewOffer")} &rarr;
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
