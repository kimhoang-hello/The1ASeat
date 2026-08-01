import { useTranslations } from "next-intl";
import { InstagramLogo, TiktokLogo, YoutubeLogo } from "@phosphor-icons/react/ssr";
import { Link } from "@/i18n/navigation";
import { LogoGlyph } from "@/components/brand/logo";

export function SiteFooter() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const site = useTranslations("site");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-navy-ink text-white/70">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 font-display text-base font-extrabold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10">
              <LogoGlyph className="h-4 w-4" />
            </span>
            {site("name")}
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/credit-cards" className="hover:text-white">
              {nav("creditCards")}
            </Link>
            <Link href="/transfer-bonuses" className="hover:text-white">
              {nav("transferBonuses")}
            </Link>
            <Link href="/#newsletter" className="hover:text-white">
              {nav("newsletter")}
            </Link>
            <Link href="/about" className="hover:text-white">
              {nav("about")}
            </Link>
            <Link href="/privacy" className="hover:text-white">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-white">
              {t("terms")}
            </Link>
          </nav>

          <div className="flex gap-4 text-white/60">
            <a href="#" aria-label="Instagram" className="cursor-pointer hover:text-white">
              <InstagramLogo size={20} />
            </a>
            <a href="#" aria-label="YouTube" className="cursor-pointer hover:text-white">
              <YoutubeLogo size={20} />
            </a>
            <a href="#" aria-label="TikTok" className="cursor-pointer hover:text-white">
              <TiktokLogo size={20} />
            </a>
          </div>
        </div>

        <p className="mt-8 max-w-4xl text-xs leading-relaxed text-white/45">
          {t("disclosure")}
        </p>

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {site("name")}. {t("rights")}
          </span>
        </div>
      </div>
    </footer>
  );
}
