import { getCreditCardOffers } from "@/lib/content";
import { FeaturedOfferRotator, type FeaturedOffer } from "./featured-offer-rotator";

/**
 * A backstop, not the usual case — the clause split below is what does the
 * shortening. It is set past the longest clause any card currently has so a
 * phone, where the strip wraps and shows the line in full, is not left reading
 * an ellipsis; the one-line desktop strip trims its own overflow in CSS.
 */
const MAX_TEASER = 100;

/**
 * The banner has a single line to work with and `headlineVi` is a whole
 * sentence: "Welcome bonus lên đến 70,000 điểm Avion® (giá trị du lịch tối đa
 * $1,500) — elevated offer đến 25/11/2026." Everything after the opening
 * clause is detail the card's own page already carries, so the strip keeps the
 * clause and stops at the first separator.
 *
 * The comma has to be followed by a space or "70,000" would be the cut, and
 * the plus needs a space on both sides so "Scene+™" survives intact.
 */
function offerTeaser(headline: string): string {
  const clause = headline
    .replace(/^elevated offer:\s*/i, "")
    .split(/,\s|\s[—–-]\s|\s\(|\s\+\s|;\s/)[0]
    .trim()
    .replace(/\.$/, "");
  const teaser = clause.charAt(0).toUpperCase() + clause.slice(1);
  if (teaser.length <= MAX_TEASER) return teaser;
  const cut = teaser.slice(0, MAX_TEASER);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The strip above the header, carrying the cards that are running an elevated
 * offer right now. It sits outside the sticky header on purpose: the offer is
 * worth the top of the first screen, not a permanent tenth of every screen.
 *
 * The order is drawn here rather than in the browser so that the card the
 * server rendered is the card hydration finds. Pages are revalidated on a
 * timer, so the draw is fixed for one revalidation window and every visitor
 * inside it opens on the same card — the rotation in the browser is what makes
 * sure the others are seen regardless.
 */
export async function FeaturedOfferBanner() {
  const offers = await getCreditCardOffers();

  const featured: FeaturedOffer[] = shuffle(offers.filter((offer) => offer.elevatedBonus))
    .map((offer) => ({
      slug: offer.slug,
      name: offer.name,
      teaser: offerTeaser(offer.headline),
      cardImage: offer.cardImage,
    }));

  if (featured.length === 0) return null;

  return <FeaturedOfferRotator offers={featured} />;
}
