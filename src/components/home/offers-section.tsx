import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { t as translate } from "@/lib/t";
import { getCreditCardOffers } from "@/lib/content";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { RebateBadge } from "@/components/credit-cards/rebate-badge";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { EditorsTake } from "@/components/credit-cards/editors-take";
import { ApplyButton } from "@/components/ui/apply-button";

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
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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

        {/* Two across once the section is wide enough, so the extra room goes
            into a second card rather than into 110-character lines of text. */}
        <div className="grid gap-5 xl:grid-cols-2">
          {offers.map((offer) => (
            <article
              key={offer.slug}
              className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row"
            >
              <CardImage
                image={offer.cardImage}
                name={offer.name}
                className="h-32 w-full shrink-0 self-start rounded-xl sm:h-32 sm:w-40 xl:h-36 xl:w-44"
                badge={offer.rebate && <RebateBadge amount={offer.rebate} label={t("rebate")} />}
                applyUrl={offer.applyUrl}
                sizes="176px"
              />

              {/* A column so the apply button can sit on the bottom edge — see
                  the note on the credit-cards list. */}
              <div className="flex flex-1 flex-col">
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

                <EditorsTake editorsTake={offer.editorsTake} className="mt-3" compact />

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

                <div className="mt-auto pt-4">
                  <ApplyButton href={offer.applyUrl} />
                </div>
              </div>
            </article>
          ))}

          <OfferDisclosure className="mt-3 xl:col-span-2" />
        </div>
      </div>
    </section>
  );
}
