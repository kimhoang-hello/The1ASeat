import { t as translate } from "@/lib/t";

const offers = translate("offers");

/** Marks the link as the affiliate link it is, wherever an apply link is rendered. */
export const AFFILIATE_REL = "sponsored nofollow noopener noreferrer";

/** The same link when there is no commission behind it — no `sponsored`, because
 *  claiming a paid relationship that does not exist is its own kind of lie. */
export const PLAIN_REL = "nofollow noopener noreferrer";

/**
 * The single place the apply link lives: every surface gets the same pill and
 * the same words, so the call to action reads the same on the home page, the
 * card list, a card's own page and the bank-account list.
 *
 * `affiliate` only decides the `rel`. The bank accounts are listed without any
 * referral arrangement, so their links go out as plain `nofollow` — but they
 * are the same button, because the reader is doing the same thing.
 */
export function ApplyButton({
  href,
  className = "",
  affiliate = true,
}: {
  href: string;
  className?: string;
  affiliate?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={affiliate ? AFFILIATE_REL : PLAIN_REL}
      className={`inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover ${className}`}
    >
      {offers("applyNow")} &rarr;
    </a>
  );
}
