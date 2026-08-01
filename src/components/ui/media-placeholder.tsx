import {
  Airplane,
  Armchair,
  Buildings,
  CreditCard,
  Globe,
  Play,
  UserCircle,
} from "@phosphor-icons/react/ssr";

const icons = {
  airplane: Airplane,
  globe: Globe,
  building: Buildings,
  armchair: Armchair,
  "credit-card": CreditCard,
  avatar: UserCircle,
} as const;

export type PlaceholderIcon = keyof typeof icons;

const tones = {
  navy: "bg-primary text-primary-foreground/40",
  tan: "bg-secondary text-foreground/25",
  card: "bg-muted text-foreground/20",
} as const;

export function MediaPlaceholder({
  icon,
  tone = "tan",
  className = "",
  isVideo = false,
}: {
  icon: PlaceholderIcon;
  tone?: keyof typeof tones;
  className?: string;
  isVideo?: boolean;
}) {
  const Icon = icons[icon];
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${tones[tone]} ${className}`}
    >
      <Icon size={40} weight="light" />
      {isVideo && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-navy-ink shadow-md">
            <Play size={20} weight="fill" />
          </span>
        </span>
      )}
    </div>
  );
}
