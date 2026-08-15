import { t as translate } from "@/lib/t";

const footer = translate("footer");

/** Same affiliate disclosure as the site footer, repeated on the pages that carry apply links. */
export function OfferDisclosure({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`rounded-xl border border-border bg-secondary px-5 py-4 text-xs leading-relaxed text-muted-foreground ${className}`}
    >
      {footer("disclosure")}
    </aside>
  );
}
