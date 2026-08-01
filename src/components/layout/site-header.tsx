"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { List, X, CaretDown } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoMark } from "@/components/brand/logo";

export function SiteHeader() {
  const t = useTranslations("nav");
  const site = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/credit-cards", label: t("creditCards") },
    { href: "/blog", label: t("blog") },
  ];

  const toolsLinks = [
    { href: "/calculator", label: t("calculator") },
    { href: "/transfer-bonuses", label: t("transferBonuses") },
  ];

  const toolsActive = toolsLinks.some((link) => pathname === link.href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-foreground"
        >
          <LogoMark />
          {site("name")}
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  active ? "text-primary" : "text-foreground/80"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <details className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1 text-sm font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden ${
                toolsActive ? "text-primary" : "text-foreground/80"
              }`}
            >
              {t("pointsTools")}
              <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              {toolsLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-lg px-3 py-2 text-sm hover:bg-secondary ${
                    pathname === link.href ? "text-primary" : "text-foreground/90"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>

          <Link
            href="/about"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              pathname === "/about" ? "text-primary" : "text-foreground/80"
            }`}
          >
            {t("about")}
          </Link>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LocaleSwitcher currentLocale={locale} />
          <Link
            href="/#newsletter"
            className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t("newsletter")}
          </Link>
        </div>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-foreground lg:hidden"
        >
          {open ? <X size={22} /> : <List size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}

            <span className="mt-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("pointsTools")}
            </span>
            {toolsLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
            >
              {t("about")}
            </Link>
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <LocaleSwitcher currentLocale={locale} />
            <Link
              href="/#newsletter"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t("newsletter")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
