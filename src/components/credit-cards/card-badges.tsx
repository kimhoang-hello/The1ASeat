import type { CreditCardOffer } from "@/lib/content";
import { formatDate } from "@/lib/format-date";

export function CardBadges({
  offer,
  cardType,
  elevatedBonusLabel,
  expiresOnLabel,
}: {
  offer: CreditCardOffer;
  cardType: string;
  elevatedBonusLabel: string;
  expiresOnLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {offer.elevatedBonus && (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          + {elevatedBonusLabel}
        </span>
      )}
      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
        {offer.country}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{cardType}</span>
      {offer.expiresAt && expiresOnLabel && (
        <span className="text-xs font-medium text-amber-700">
          {expiresOnLabel} {formatDate(offer.expiresAt)}
        </span>
      )}
    </div>
  );
}
