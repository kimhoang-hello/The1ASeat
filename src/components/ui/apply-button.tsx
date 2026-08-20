import { AFFILIATE_REL, PLAIN_REL } from "@/lib/affiliate-links";
import { t as translate } from "@/lib/t";

const offers = translate("offers");

/**
 * The single place the apply link lives: every surface gets the same pill and
 * the same words, so the call to action reads the same on the home page, the
 * card list, a card's own page and the bank-account list.
 *
 * `affiliate` only decides the `rel`. Most bank accounts now go through a
 * FinlyWealth referral link too; the few that have none point straight at the
 * bank and go out as plain `nofollow` — same button either way, because the
 * reader is doing the same thing.
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
