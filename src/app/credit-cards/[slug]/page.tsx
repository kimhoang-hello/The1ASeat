import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreditCardOfferBySlug, getCreditCardOffers } from "@/lib/content";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { RebateBadge } from "@/components/credit-cards/rebate-badge";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { ApplyButton } from "@/components/credit-cards/apply-button";
import { JsonLd } from "@/components/seo/json-ld";
import { creditCardJsonLd } from "@/lib/credit-card-schema";
import { t as translate } from "@/lib/t";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

const offers = translate("offers");
const common = translate("common");
const seo = translate("seo");

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  const offers = await getCreditCardOffers();
  return offers.map((offer) => ({ slug: offer.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const offer = await getCreditCardOfferBySlug(slug);
  if (!offer) return {};

  return pageMetadata({
    title: offer.name,
    description: offer.headline,
    path: `/credit-cards/${offer.slug}`,
    image: offer.cardImage || undefined,
  });
}

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const offer = await getCreditCardOfferBySlug(slug);

  if (!offer) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbCreditCards"), path: "/credit-cards" },
        { name: offer.name, path: `/credit-cards/${offer.slug}` },
      ]),
      creditCardJsonLd(offer),
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />
      <Link href="/credit-cards" className="text-sm font-semibold text-primary hover:underline">
        &larr; {offers("viewAll")}
      </Link>

      <CardImage
        image={offer.cardImage}
        name={offer.name}
        className="mt-6 h-56 w-full rounded-2xl"
        badge={offer.rebate && <RebateBadge amount={offer.rebate} label={offers("rebate")} />}
        applyUrl={offer.applyUrl}
      />

      <div className="mt-6">
        <CardBadges
          offer={offer}
          cardType={`${offer.cardType} · ${offer.issuer}`}
          elevatedBonusLabel={offers("elevatedBonus")}
          expiresOnLabel={offers("expiresOn")}
        />
      </div>

      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">{offer.name}</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {offers("annualFee")}: {offer.annualFee}
      </p>
      <p className="mt-4 text-lg leading-relaxed text-foreground/90">{offer.headline}</p>

      <div className="mt-6 rounded-xl bg-secondary p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {offers("editorsTake")}
        </p>
        <p className="mt-2 leading-relaxed text-foreground/90">{offer.editorsTake}</p>
      </div>

      <h2 className="mt-8 font-display text-xl font-bold text-foreground">{offers("keyBenefits")}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
        {offer.keyBenefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <ApplyButton href={offer.applyUrl} className="mt-8" />

      <OfferDisclosure className="mt-8" />

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href="/" className="underline">
          {common("backHome")}
        </Link>
      </p>
    </article>
  );
}
