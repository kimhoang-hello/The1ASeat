import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreditCardOfferBySlug, getCreditCardOffers } from "@/lib/content";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { EditorsTake } from "@/components/credit-cards/editors-take";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import { isReferralUrl } from "@/lib/affiliate-links";
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
        placeholderIcon={offer.image}
        badge={
          offer.rebate && (
            <RebateChip
              amount={offer.rebate}
              label={offers("rebate")}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 shadow-sm"
            />
          )
        }
        className="mt-6 h-56 w-full rounded-2xl"
        applyUrl={offer.applyUrl}
        priority
      />

      <div className="mt-6">
        <CardBadges
          offer={offer}
          cardType={offer.cardType}
          elevatedBonusLabel={offers("elevatedBonus")}
          expiresOnLabel={offers("expiresOn")}
        />
      </div>

      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">{offer.name}</h1>
      <OfferStats offer={offer} className="mt-4" />

      <p className="mt-4 text-lg leading-relaxed text-foreground/90">{offer.headline}</p>

      <EditorsTake editorsTake={offer.editorsTake} className="mt-6" />

      <h2 className="mt-8 font-display text-xl font-bold text-foreground">{offers("keyBenefits")}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
        {offer.keyBenefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <ApplyButton href={offer.applyUrl} affiliate={isReferralUrl(offer.applyUrl)} className="mt-8" />

      <OfferDisclosure className="mt-8" />

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href="/" className="underline">
          {common("backHome")}
        </Link>
      </p>
    </article>
  );
}
