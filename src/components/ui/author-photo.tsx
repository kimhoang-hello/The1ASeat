import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

export function AuthorPhoto({
  photo,
  name,
  className = "",
}: {
  photo: string;
  name: string;
  className?: string;
}) {
  const hasRealPhoto = photo.startsWith("/") || photo.startsWith("http");

  if (!hasRealPhoto) {
    return <MediaPlaceholder icon="avatar" tone="navy" className={`rounded-2xl ${className}`} />;
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <Image src={photo} alt={name} fill sizes="224px" className="object-cover" />
    </div>
  );
}
