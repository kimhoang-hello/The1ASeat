import { t as translate } from "@/lib/t";

const offers = translate("offers");

/** Marks the link as the affiliate link it is, wherever an apply link is rendered. */
export const AFFILIATE_REL = "sponsored nofollow noopener noreferrer";

/**
 * The single place the apply link lives: `sponsored nofollow` marks it as the
 * affiliate link it is, and every surface gets the same pill so the call to
 * action reads the same on the home page, the list and a card's own page.
 */
export function ApplyButton({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel={AFFILIATE_REL}
      className={`inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover ${className}`}
    >
      {offers("applyNow")} &rarr;
    </a>
  );
}
