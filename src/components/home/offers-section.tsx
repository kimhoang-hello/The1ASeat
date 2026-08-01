import { getLocale, getTranslations } from "next-intl/server";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { Link } from "@/i18n/navigation";
import { getCreditCardOffers } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { CardBadges } from "@/components/credit-cards/card-badges";

export async function OffersSection() {
  const [t, locale, offersAll] = await Promise.all([
    getTranslations("offers"),
    getLocale(),
    getCreditCardOffers(),
  ]);
  const offers = offersAll.slice(0, 4);

  return (
    <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              {t("title")}
            </h2>
          </div>
          <Link href="/credit-cards" className="cursor-pointer text-sm font-semibold text-primary hover:underline">
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <div className="flex flex-col gap-5">
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
                  cardType={pickLocale(offer.cardType, locale)}
                  elevatedBonusLabel={t("elevatedBonus")}
                />

                <h3 className="mt-1.5 font-display text-lg font-bold text-foreground">
                  {offer.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("annualFee")}: {pickLocale(offer.annualFee, locale)}
                </p>

                <div className="mt-3 rounded-lg bg-secondary p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {t("editorsTake")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {pickLocale(offer.editorsTake, locale)}
                  </p>
                </div>

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

                <a
                  href={offer.applyUrl}
                  className="mt-4 inline-block cursor-pointer text-sm font-bold text-primary underline decoration-2 underline-offset-4 hover:text-primary-hover"
                >
                  {t("viewOffer")} &rarr;
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
