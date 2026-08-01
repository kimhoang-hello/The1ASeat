import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCreditCardOfferBySlug, getCreditCardOffers } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

export async function generateStaticParams() {
  const offers = await getCreditCardOffers();
  return offers.map((offer) => ({ slug: offer.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const offer = await getCreditCardOfferBySlug(slug);
  if (!offer) return {};
  return { title: offer.name, description: pickLocale(offer.headline, locale) };
}

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale: routeLocale } = await params;
  setRequestLocale(routeLocale);

  const [t, common, locale, offer] = await Promise.all([
    getTranslations("offers"),
    getTranslations("common"),
    getLocale(),
    getCreditCardOfferBySlug(slug),
  ]);

  if (!offer) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/credit-cards" className="text-sm font-semibold text-primary hover:underline">
        &larr; {t("viewAll")}
      </Link>

      <MediaPlaceholder icon="credit-card" tone="tan" className="mt-6 h-56 w-full rounded-2xl" />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {offer.elevatedBonus && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            + {t("elevatedBonus")}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {pickLocale(offer.cardType, locale)} &middot; {offer.issuer}
        </span>
      </div>

      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">{offer.name}</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {t("annualFee")}: {pickLocale(offer.annualFee, locale)}
      </p>
      <p className="mt-4 text-lg leading-relaxed text-foreground/90">
        {pickLocale(offer.headline, locale)}
      </p>

      <div className="mt-6 rounded-xl bg-secondary p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("editorsTake")}
        </p>
        <p className="mt-2 leading-relaxed text-foreground/90">
          {pickLocale(offer.editorsTake, locale)}
        </p>
      </div>

      <h2 className="mt-8 font-display text-xl font-bold text-foreground">{t("keyBenefits")}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
        {pickLocale(offer.keyBenefits, locale).map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <a
        href={offer.applyUrl}
        className="mt-8 inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {t("viewOffer")} &rarr;
      </a>

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href="/" className="underline">
          {common("backHome")}
        </Link>
      </p>
    </article>
  );
}
