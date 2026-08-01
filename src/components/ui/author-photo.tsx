import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

export function AuthorPhoto({
  photo,
  name,
  className = "",
  rounded = "rounded-2xl",
}: {
  photo: string;
  name: string;
  className?: string;
  rounded?: string;
}) {
  const hasRealPhoto = photo.startsWith("/") || photo.startsWith("http");

  if (!hasRealPhoto) {
    return <MediaPlaceholder icon="avatar" tone="navy" className={`${rounded} ${className}`} />;
  }

  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`}>
      <Image src={photo} alt={name} fill sizes="224px" className="object-cover object-top" />
    </div>
  );
}
