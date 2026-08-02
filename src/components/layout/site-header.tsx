"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { List, X, CaretDown } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { routing } from "@/i18n/routing";

const showLocaleSwitcher = routing.locales.length > 1;

type BlogLink = { href: string; type: string; label: string };

function blogLinkClassName(active: boolean) {
  return `block rounded-lg px-3 py-2 text-sm hover:bg-secondary ${
    active ? "text-primary" : "text-foreground/90"
  }`;
}

// Reads the ?type= search param to highlight the active Blog dropdown item.
// Isolated in its own component so only this leaf needs a Suspense boundary
// (useSearchParams() requires one during static prerendering) instead of the
// whole header, avoiding a flash of unstyled header on first paint.
function BlogDropdownLinks({
  blogLinks,
  pathname,
  onNavigate,
}: {
  blogLinks: BlogLink[];
  pathname: string;
  onNavigate: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get("type");

  return (
    <>
      {blogLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className={blogLinkClassName(pathname === "/blog" && activeType === link.type)}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const tPosts = useTranslations("posts");
  const site = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [{ href: "/credit-cards", label: t("creditCards") }];

  const blogLinks = [
    { href: "/blog?type=post", type: "post", label: tPosts("tabPosts") },
    { href: "/blog?type=video", type: "video", label: tPosts("tabVideos") },
  ];

  const toolsLinks = [
    { href: "/calculator", label: t("calculator") },
    { href: "/transfer-bonuses", label: t("transferBonuses") },
  ];

  const blogActive = pathname === "/blog" || pathname.startsWith("/blog/");
  const toolsActive = toolsLinks.some((link) => pathname === link.href);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        navRef.current
          ?.querySelectorAll("details[open]")
          .forEach((details) => details.removeAttribute("open"));
      }
    }
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, []);

  function closeParentDropdown(event: React.MouseEvent<HTMLElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-foreground"
        >
          <Image src="/images/logo.png" alt="" width={477} height={480} className="h-9 w-9" priority />
          {site("name")}
        </Link>

        <nav ref={navRef} className="hidden items-center gap-7 lg:flex">
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

          <details name="nav-dropdown" className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1 text-sm font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden ${
                blogActive ? "text-primary" : "text-foreground/80"
              }`}
            >
              {t("blog")}
              <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 w-44 rounded-xl border border-border bg-card p-2 shadow-lg">
              <Suspense
                fallback={blogLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeParentDropdown}
                    className={blogLinkClassName(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              >
                <BlogDropdownLinks
                  blogLinks={blogLinks}
                  pathname={pathname}
                  onNavigate={closeParentDropdown}
                />
              </Suspense>
            </div>
          </details>

          <details name="nav-dropdown" className="group relative">
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
                  onClick={closeParentDropdown}
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
          {showLocaleSwitcher && <LocaleSwitcher currentLocale={locale} />}
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

            <Link
              href="/blog"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
            >
              {t("blog")}
            </Link>
            {blogLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-secondary"
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
            {showLocaleSwitcher && <LocaleSwitcher currentLocale={locale} />}
            <Link
              href="/#newsletter"
              onClick={() => setOpen(false)}
              className={`cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground ${
                showLocaleSwitcher ? "" : "ml-auto"
              }`}
            >
              {t("newsletter")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
