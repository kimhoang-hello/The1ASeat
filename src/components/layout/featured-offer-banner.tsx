import { getCreditCardOffers } from "@/lib/content";
import { isElevatedLive } from "@/lib/credit-card-state";
import { FeaturedOfferRotator, type FeaturedOffer } from "./featured-offer-rotator";

/** A backstop only — the split below is what does the shortening. */
const MAX_TEASER = 60;

/**
 * Where the offer stops being the offer. The first group is punctuation: the
 * comma has to be followed by a space or "70,000" would be the cut, and the
 * plus needs a space on both sides so "Scene+™" survives intact. The second is
 * the Vietnamese words that open the conditions — "sau khi đạt hạn mức chi
 * tiêu $6,000 trong 6 tháng đầu", "khi mở thẻ mới" — which are what the card's
 * own page is for.
 */
const TEASER_END = /,\s|\s[—–-]\s|\s\(|\s\+\s|;\s|\s(?:sau|khi|nếu|kèm|cộng|trong)\s/;

/**
 * The strip gets the number and nothing else: "Welcome bonus lên đến 70,000
 * điểm Avion®" out of "Welcome bonus lên đến 70,000 điểm Avion® (giá trị du
 * lịch tối đa $1,500) — elevated offer đến 25/11/2026."
 */
function offerTeaser(headline: string): string {
  const clause = headline
    .replace(/^elevated offer:\s*/i, "")
    .split(TEASER_END)[0]
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

  const featured: FeaturedOffer[] = shuffle(offers.filter(isElevatedLive))
    .map((offer) => ({
      slug: offer.slug,
      name: offer.name,
      teaser: offerTeaser(offer.headline),
      cardImage: offer.cardImage,
    }));

  if (featured.length === 0) return null;

  return <FeaturedOfferRotator offers={featured} />;
}
