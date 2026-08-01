"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const labels: Record<string, string> = {
  vi: "VI",
  en: "EN",
};

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border p-1 text-xs font-semibold">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          className={`cursor-pointer rounded-full px-2.5 py-1 transition-colors ${
            currentLocale === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[locale]}
        </Link>
      ))}
    </div>
  );
}
