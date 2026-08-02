import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

export function CardImage({
  image,
  name,
  className = "",
}: {
  image: string;
  name: string;
  className?: string;
}) {
  if (!image) {
    return <MediaPlaceholder icon="credit-card" tone="tan" className={className} />;
  }

  return (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      <Image src={image} alt={name} fill sizes="320px" className="object-contain p-3" />
    </div>
  );
}
