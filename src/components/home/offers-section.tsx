import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { t as translate } from "@/lib/t";
import { getCreditCardOffers } from "@/lib/content";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { RebateBadge } from "@/components/credit-cards/rebate-badge";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { ApplyButton } from "@/components/credit-cards/apply-button";

const t = translate("offers");

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function OffersSection() {
  const offersAll = await getCreditCardOffers();
  const notable = offersAll.filter((offer) => offer.elevatedBonus);
  const rest = offersAll.filter((offer) => !offer.elevatedBonus);
  const offers = [...shuffle(notable), ...shuffle(rest)].slice(0, 4);

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
              <CardImage
                image={offer.cardImage}
                name={offer.name}
                className="h-32 w-full shrink-0 rounded-xl sm:h-auto sm:w-40"
                badge={offer.rebate && <RebateBadge amount={offer.rebate} label={t("rebate")} />}
                applyUrl={offer.applyUrl}
                aspect={offer.cardImageAspect}
              />

              <div className="flex-1">
                <CardBadges
                  offer={offer}
                  cardType={offer.cardType}
                  elevatedBonusLabel={t("elevatedBonus")}
                  expiresOnLabel={t("expiresOn")}
                />

                <h3 className="mt-1.5 font-display text-lg font-bold text-foreground">
                  <Link href={`/credit-cards/${offer.slug}`} className="cursor-pointer hover:text-primary">
                    {offer.name}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("annualFee")}: {offer.annualFee}
                </p>

                <div className="mt-3 rounded-lg bg-secondary p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {t("editorsTake")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {offer.editorsTake}
                  </p>
                </div>

                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-foreground/80 hover:text-primary">
                    <CaretDown size={14} className="transition-transform group-open:rotate-180" />
                    {t("keyBenefits")}
                  </summary>
                  <ul className="ml-5 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
                    {offer.keyBenefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </details>

                <ApplyButton href={offer.applyUrl} className="mt-4" />
              </div>
            </article>
          ))}

          <OfferDisclosure className="mt-3" />
        </div>
      </div>
    </section>
  );
}
