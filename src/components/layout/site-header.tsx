"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { List, X, CaretDown, PaperPlaneTilt } from "@phosphor-icons/react";
import { t } from "@/lib/t";

/** A dropdown entry for a page that filters itself with `?type=`. `type` is
 *  null for the entry that lives at the bare path, with no param. */
type TypeLink = { href: string; type: string | null; label: string };

function dropdownLinkClassName(active: boolean) {
  return `block rounded-lg px-3 py-2 text-base hover:bg-secondary ${
    active ? "text-primary" : "text-foreground/90"
  }`;
}

// Reads the ?type= search param to highlight the active dropdown item. Isolated
// in its own component so only this leaf needs a Suspense boundary
// (useSearchParams() requires one during static prerendering) instead of the
// whole header, avoiding a flash of unstyled header on first paint.
function TypeDropdownLinks({
  links,
  basePath,
  pathname,
  onNavigate,
}: {
  links: TypeLink[];
  basePath: string;
  pathname: string;
  onNavigate: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get("type");

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className={dropdownLinkClassName(pathname === basePath && activeType === link.type)}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

/** The dropdown panel itself, so the Blog and credit-card menus stay identical. */
function TypeDropdown({
  label,
  basePath,
  links,
  active,
  width,
  pathname,
  onNavigate,
}: {
  label: string;
  basePath: string;
  links: TypeLink[];
  active: boolean;
  width: string;
  pathname: string;
  onNavigate: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <details name="nav-dropdown" className="group relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 text-base font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden ${
          active ? "text-primary" : "text-foreground/80"
        }`}
      >
        {label}
        <CaretDown size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <div
        className={`absolute left-0 top-full z-10 mt-2 ${width} rounded-xl border border-border bg-card p-2 shadow-lg`}
      >
        <Suspense
          fallback={links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={dropdownLinkClassName(false)}
            >
              {link.label}
            </Link>
          ))}
        >
          <TypeDropdownLinks
            links={links}
            basePath={basePath}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </Suspense>
      </div>
    </details>
  );
}

const nav = t("nav");
const tPosts = t("posts");
const tOffers = t("offers");
const site = t("site");

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // "Tất cả offers" is the bare path, so its type is null — same shape as the
  // blog's own all/post/video split.
  const cardLinks: TypeLink[] = [
    { href: "/credit-cards", type: null, label: tOffers("tabAll") },
    { href: "/credit-cards?type=noi-bat", type: "noi-bat", label: tOffers("tabElevated") },
    { href: "/credit-cards?type=khac", type: "khac", label: tOffers("tabOther") },
  ];

  const blogLinks: TypeLink[] = [
    { href: "/blog?type=post", type: "post", label: tPosts("tabPosts") },
    { href: "/blog?type=video", type: "video", label: tPosts("tabVideos") },
  ];

  const toolsLinks = [
    { href: "/award-flight-finder", label: nav("awardCharts") },
    { href: "/calculator", label: nav("calculator") },
    { href: "/transfer-bonuses", label: nav("transferBonuses") },
    { href: "/transfer-partners", label: nav("transferPartners") },
  ];

  const cardsActive = pathname === "/credit-cards" || pathname.startsWith("/credit-cards/");
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
      {/* Full-bleed on purpose: the header is chrome, not reading matter, so it
          runs the width of the window and only keeps a gutter. Capping it left
          the logo and the newsletter button floating in the middle of a large
          display with a third of the bar empty on either side. */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10 2xl:h-20 2xl:px-16">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-primary xl:text-xl"
        >
          <Image
            src="/images/logo.png"
            alt=""
            width={477}
            height={480}
            sizes="40px"
            className="h-9 w-9 xl:h-10 xl:w-10"
            priority
          />
          {site("name")}
        </Link>

        <nav ref={navRef} className="hidden items-center gap-7 lg:flex">
          <TypeDropdown
            label={nav("creditCards")}
            basePath="/credit-cards"
            links={cardLinks}
            active={cardsActive}
            width="w-52"
            pathname={pathname}
            onNavigate={closeParentDropdown}
          />

          <TypeDropdown
            label={nav("blog")}
            basePath="/blog"
            links={blogLinks}
            active={blogActive}
            width="w-44"
            pathname={pathname}
            onNavigate={closeParentDropdown}
          />

          <details name="nav-dropdown" className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1 text-base font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden ${
                toolsActive ? "text-primary" : "text-foreground/80"
              }`}
            >
              {nav("pointsTools")}
              <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              {toolsLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeParentDropdown}
                  className={`block rounded-lg px-3 py-2 text-base hover:bg-secondary ${
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
            className={`text-base font-medium transition-colors hover:text-primary ${
              pathname === "/about" ? "text-primary" : "text-foreground/80"
            }`}
          >
            {nav("about")}
          </Link>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/#newsletter"
            className="flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {nav("newsletter")}
            <PaperPlaneTilt size={16} weight="bold" />
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
            <Link
              href="/credit-cards"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
            >
              {nav("creditCards")}
            </Link>
            {cardLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/blog"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
            >
              {nav("blog")}
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

            <span className="mt-2 rounded-md px-2 py-3 text-base font-medium text-foreground/90">
              {nav("pointsTools")}
            </span>
            {toolsLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
            >
              {nav("about")}
            </Link>
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <Link
              href="/#newsletter"
              onClick={() => setOpen(false)}
              className="ml-auto flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground"
            >
              {nav("newsletter")}
              <PaperPlaneTilt size={16} weight="bold" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
