import {
  Airplane,
  Armchair,
  Buildings,
  CreditCard,
  Globe,
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
}: {
  icon: PlaceholderIcon;
  tone?: keyof typeof tones;
  className?: string;
}) {
  const Icon = icons[icon];
  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${tones[tone]} ${className}`}
    >
      <Icon size={40} weight="light" />
    </div>
  );
}
