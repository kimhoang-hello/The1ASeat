import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

export function CardImage({
  image,
  name,
  className = "",
  badge,
}: {
  image: string;
  name: string;
  className?: string;
  badge?: React.ReactNode;
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
    </div>
  );
}
