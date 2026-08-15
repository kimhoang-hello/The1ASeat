import Image from "next/image";
import Link from "next/link";
import { YoutubeLogo } from "@phosphor-icons/react/ssr";
import { DisclosureText } from "@/components/layout/disclosure-text";
import { t as translate } from "@/lib/t";

const t = translate("footer");
const nav = translate("nav");
const site = translate("site");

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-navy-ink text-white/70">
      {/* Full-bleed to match the header — see the note there. */}
      <div className="px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-lg font-extrabold text-white xl:text-xl"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-background xl:h-9 xl:w-9">
              <Image
                src="/images/logo.png"
                alt=""
                width={477}
                height={480}
                sizes="24px"
                className="h-5 w-5 xl:h-6 xl:w-6"
              />
            </span>
            {site("name")}
          </Link>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-base">
            <Link href="/" className="hover:text-white">
              {nav("home")}
            </Link>
            <Link href="/credit-cards" className="hover:text-white">
              {nav("creditCards")}
            </Link>
            <Link href="/blog" className="hover:text-white">
              {nav("blog")}
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
            <Link href="/contact" className="hover:text-white">
              {t("contact")}
            </Link>
          </nav>

          {/* The channel is the whole reason most of this content exists, so the
              icon is sized to be seen rather than tucked into the corner —
              brighter than the links beside it, and a comfortable tap target. */}
          <div className="flex gap-4 text-white/75">
            <a
              href="https://youtube.com/@hoangleca"
              aria-label="YouTube"
              target="_blank"
              rel="noopener noreferrer"
              className="-m-2 cursor-pointer p-2 transition-colors hover:text-white"
            >
              <YoutubeLogo size={32} weight="fill" className="xl:h-9 xl:w-9" />
            </a>
          </div>
        </div>

        <p className="mt-8 max-w-4xl text-sm leading-relaxed text-white/50">
          <DisclosureText />
        </p>

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {site("name")}. {t("rights")}
          </span>
        </div>
      </div>
    </footer>
  );
}
