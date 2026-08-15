import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { AFFILIATE_REL } from "@/components/credit-cards/apply-button";

export function CardImage({
  image,
  name,
  className = "",
  badge,
  applyUrl,
}: {
  image: string;
  name: string;
  className?: string;
  badge?: React.ReactNode;
  applyUrl?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {image ? (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-secondary">
          <Image src={image} alt={name} fill sizes="320px" className="object-contain p-3" />
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
