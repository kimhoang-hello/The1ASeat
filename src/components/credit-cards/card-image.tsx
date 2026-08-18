import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { AFFILIATE_REL } from "@/lib/affiliate-links";

export function CardImage({
  image,
  name,
  className = "",
  badge,
  applyUrl,
  // The artwork is object-contain, so it paints a shape narrower than the box
  // it sits in — `sizes` has to describe the painted width, not the box, or
  // the browser fetches a variant several times larger than it can show. The
  // default is the width a card's own page paints.
  sizes = "320px",
  priority = false,
}: {
  image: string;
  name: string;
  className?: string;
  badge?: React.ReactNode;
  applyUrl?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      {image ? (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-secondary">
          <Image
            src={image}
            alt={name}
            fill
            sizes={sizes}
            priority={priority}
            className="object-contain p-3"
          />
        </div>
      ) : (
        <MediaPlaceholder icon="credit-card" tone="tan" className="absolute inset-0 rounded-[inherit]" />
      )}
      {badge}
      {applyUrl && (
        // Sits above the artwork and the ribbon so the whole box is one hit
        // target. Hidden from keyboard and screen readers on purpose: it
        // duplicates the labelled apply button next to it, and an extra
        // unlabelled link in the tab order would only get in the way.
        <a
          href={applyUrl}
          target="_blank"
          rel={AFFILIATE_REL}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 z-10 cursor-pointer rounded-[inherit]"
        />
      )}
    </div>
  );
}
