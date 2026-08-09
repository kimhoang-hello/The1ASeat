import type { CreditCardOffer } from "./content";
import { absoluteUrl } from "./seo";
import { SITE_URL } from "./subscriber-email";

/**
 * schema.org/CreditCard for one offer. Shared between the /credit-cards list
 * (nested in the ItemList) and each card's own page, so the two never drift.
 *
 * Deliberately no Review/AggregateRating: there is no rating behind the
 * editor's take, and shipping a rating we do not actually collect would be
 * fabricated markup.
 */
export function creditCardJsonLd(offer: CreditCardOffer) {
  const url = absoluteUrl(`/credit-cards/${offer.slug}`);

  return {
    "@type": "CreditCard",
    "@id": `${url}#product`,
    name: offer.name,
    description: offer.headline,
    url,
    category: offer.cardType,
    ...(offer.cardImage && { image: offer.cardImage }),
    provider: { "@type": "Organization", name: offer.issuer },
    feesAndCommissionsSpecification: offer.annualFee,
    areaServed: offer.country === "CA" ? "CA" : "US",
    offers: {
      "@type": "Offer",
      url: offer.applyUrl,
      category: offer.cardType,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: offer.issuer },
      ...(offer.expiresAt && { availabilityEnds: offer.expiresAt }),
    },
    ...(offer.keyBenefits.length > 0 && {
      // Benefits render as a bulleted list on the page; expose the same list as
      // product properties rather than cramming them into `description`.
      additionalProperty: offer.keyBenefits.map((benefit) => ({
        "@type": "PropertyValue",
        name: "Quyền lợi",
        value: benefit,
      })),
    }),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
