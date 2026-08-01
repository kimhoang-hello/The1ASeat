import { useTranslations } from "next-intl";
import { EnvelopeSimple, InstagramLogo, YoutubeLogo, TiktokLogo } from "@phosphor-icons/react/ssr";
import stats from "../../../content/sample/stats.json";

export function StatsBar() {
  const t = useTranslations("stats");

  const items = [
    { icon: EnvelopeSimple, label: t("newsletter"), value: stats.newsletter },
    { icon: InstagramLogo, label: t("instagram"), value: stats.instagram },
    { icon: YoutubeLogo, label: t("youtube"), value: stats.youtube },
    { icon: TiktokLogo, label: t("tiktok"), value: stats.tiktok },
  ];

  return (
    <section className="border-b border-border bg-secondary">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon size={14} />
              {label}
            </div>
            <span className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
