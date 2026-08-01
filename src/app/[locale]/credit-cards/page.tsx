import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { Link } from "@/i18n/navigation";
import { getCreditCardOffers } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { PageHeader } from "@/components/layout/page-header";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { CardBadges } from "@/components/credit-cards/card-badges";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "offers" });
  return { title: t("title") };
}

export default async function CreditCardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: routeLocale } = await params;
  setRequestLocale(routeLocale);

  const [t, locale, offers] = await Promise.all([
    getTranslations("offers"),
    getLocale(),
    getCreditCardOffers(),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />

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
                  cardType={`${pickLocale(offer.cardType, locale)} · ${offer.issuer}`}
                  elevatedBonusLabel={t("elevatedBonus")}
                />

                <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">
                  {offer.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("annualFee")}: {pickLocale(offer.annualFee, locale)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {pickLocale(offer.headline, locale)}
                </p>

                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-foreground/80 hover:text-primary">
                    <CaretDown size={14} className="transition-transform group-open:rotate-180" />
                    {t("keyBenefits")}
                  </summary>
                  <ul className="ml-5 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
                    {pickLocale(offer.keyBenefits, locale).map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </details>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/credit-cards/${offer.slug}`}
                    className="cursor-pointer text-sm font-semibold text-foreground/80 hover:text-primary hover:underline"
                  >
                    {t("editorsTake")} &rarr;
                  </Link>
                  <a
                    href={offer.applyUrl}
                    className="cursor-pointer text-sm font-bold text-primary underline decoration-2 underline-offset-4 hover:text-primary-hover"
                  >
                    {t("viewOffer")} &rarr;
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
