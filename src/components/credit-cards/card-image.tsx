import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { AFFILIATE_REL } from "@/components/credit-cards/apply-button";

export function CardImage({
  image,
  name,
  className = "",
  badge,
  applyUrl,
  aspect,
}: {
  image: string;
  name: string;
  className?: string;
  badge?: React.ReactNode;
  applyUrl?: string;
  aspect?: number;
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
      {applyUrl && aspect && (
        // The artwork is `object-contain`, so it paints a shape of its own
        // aspect ratio centred in a box that is usually much wider. Match that
        // shape here instead of covering the box, so the empty background
        // beside the card stays inert and only the card itself is clickable.
        // Hidden from keyboard and screen readers on purpose: it duplicates the
        // labelled apply button next to it, and an extra unlabelled link in the
        // tab order would only get in the way.
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-3">
          <a
            href={applyUrl}
            target="_blank"
            rel={AFFILIATE_REL}
            aria-hidden="true"
            tabIndex={-1}
            style={{ aspectRatio: aspect }}
            className="pointer-events-auto h-full max-w-full cursor-pointer"
          />
        </span>
      )}
    </div>
  );
}
