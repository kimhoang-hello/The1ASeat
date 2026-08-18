/**
 * One place decides what `rel` an outbound link carries, because the answer has
 * to be the same whether the link is an apply button, a card image or something
 * an editor dropped into a Contentful rich-text body.
 */

/** Marks the link as the affiliate link it is, wherever an apply link is rendered. */
export const AFFILIATE_REL = "sponsored nofollow noopener noreferrer";

/** The same link when there is no commission behind it — no `sponsored`, because
 *  claiming a paid relationship that does not exist is its own kind of lie. */
export const PLAIN_REL = "nofollow noopener noreferrer";

/** An ordinary outbound link: safe to open, still followable, because linking to
 *  a source is not the kind of thing search engines need warning about. */
export const EDITORIAL_REL = "noopener noreferrer";

/**
 * The hosts the author earns a referral from. Rich text gives an editor nowhere
 * to mark a link as sponsored, so the body renderer looks the host up here
 * instead — the alternative is an unmarked affiliate link, which is the one
 * thing the rest of the site is careful never to ship.
 *
 * Add a host here whenever a new referral arrangement starts.
 */
const REFERRAL_HOSTS = ["finlywealth.com", "chexy.co", "neobanc.com"];

export function isReferralUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return REFERRAL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/** `null` for a same-site link, which needs neither a `rel` nor a new tab. */
export function relForUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  return isReferralUrl(url) ? AFFILIATE_REL : EDITORIAL_REL;
}
