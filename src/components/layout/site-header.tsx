"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  AirplaneTilt,
  ArrowsLeftRight,
  Article,
  CaretDown,
  Calculator,
  CreditCard,
  List,
  Newspaper,
  PaperPlaneTilt,
  Percent,
  Sparkle,
  Stack,
  X,
  YoutubeLogo,
  type Icon,
} from "@phosphor-icons/react";
import { SiteSearch } from "@/components/layout/site-search";
import { t } from "@/lib/t";

/** A menu entry: an icon, what it is, and what is behind it in one line. */
type NavLink = { href: string; label: string; description: string; icon: Icon };

/** A menu entry for a page that filters itself with `?type=`. `type` is null
 *  for the entry that lives at the bare path, with no param. */
type TypeLink = NavLink & { type: string | null };

/**
 * A top-level nav item. The active page marks itself three ways at once — navy,
 * bolder, and underlined — because no single one of them carried on its own:
 * navy against near-black text is two dark colours a reader cannot separate,
 * and weight alone is easy to miss. The idle items are dimmed so the live one
 * is the brightest thing in the row, and every item carries a transparent
 * underline so nothing shifts when the highlight moves.
 */
function navItemClassName(active: boolean) {
  return `border-b-2 pb-1 text-base transition-colors hover:text-primary ${
    active
      ? "border-primary font-bold text-primary"
      : "border-transparent font-medium text-foreground/55"
  }`;
}

/** The mobile menu has no room for an underline — it fills the row instead. */
function mobileItemClassName(active: boolean) {
  return `rounded-md px-2 py-3 text-base font-medium hover:bg-secondary ${
    active ? "bg-secondary font-semibold text-primary" : "text-foreground/90"
  }`;
}

/**
 * One row of a menu: an icon in its own tile, the label, and a line saying
 * what is behind it — a menu of six words on their own asks the reader to
 * guess what "Các offers khác" holds.
 *
 * The tile is a navy tint rather than the cream the row highlights with, so it
 * stays visible against the row's own hover and active fills; on the active row
 * it inverts to solid navy and becomes the brightest thing in the panel.
 *
 * `compact` is the mobile menu, where ten rows have to fit on a phone: the
 * icons stay, the descriptions go.
 */
function MenuItem({
  link,
  active,
  onNavigate,
  compact = false,
}: {
  link: NavLink;
  active: boolean;
  onNavigate: (event: React.MouseEvent<HTMLElement>) => void;
  compact?: boolean;
}) {
  const LinkIcon = link.icon;

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={`flex cursor-pointer items-center gap-3 rounded-lg transition-colors hover:bg-secondary ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2.5"
      } ${active ? "bg-secondary" : ""}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg transition-colors ${
          compact ? "h-8 w-8" : "h-9 w-9"
        } ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}
      >
        <LinkIcon size={compact ? 16 : 18} weight="bold" />
      </span>
      <span className="min-w-0">
        <span
          className={`block font-semibold ${compact ? "text-sm" : "text-[0.9375rem]"} ${
            active ? "text-primary" : "text-foreground"
          }`}
        >
          {link.label}
        </span>
        {!compact && (
          <span className="block text-xs text-muted-foreground">{link.description}</span>
        )}
      </span>
    </Link>
  );
}

// Reads the ?type= search param to highlight the active entry. Isolated in its
// own component so only this leaf needs a Suspense boundary (useSearchParams()
// requires one during static prerendering) instead of the whole header,
// avoiding a flash of unstyled header on first paint.
//
// `pathname` alone cannot decide this: it never carries the query string, so
// comparing it against a href like "/credit-cards?type=noi-bat" is false on the
// very page that link points at, and the bare "/credit-cards" entry lights up
// instead. Both the desktop dropdown and the mobile menu go through here so
// they cannot drift apart again.
function TypeLinks({
  links,
  basePath,
  pathname,
  onNavigate,
  compact,
}: {
  links: TypeLink[];
  basePath: string;
  pathname: string;
  onNavigate: (event: React.MouseEvent<HTMLElement>) => void;
  compact?: boolean;
}) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get("type");

  return (
    <>
      {links.map((link) => (
        <MenuItem
          key={link.href}
          link={link}
          active={pathname === basePath && activeType === link.type}
          onNavigate={onNavigate}
          compact={compact}
        />
      ))}
    </>
  );
}

/** The same list with nothing marked active — the prerender/Suspense fallback. */
function TypeLinksFallback({
  links,
  onNavigate,
  compact,
}: {
  links: TypeLink[];
  onNavigate: (event: React.MouseEvent<HTMLElement>) => void;
  compact?: boolean;
}) {
  return (
    <>
      {links.map((link) => (
        <MenuItem
          key={link.href}
          link={link}
          active={false}
          onNavigate={onNavigate}
          compact={compact}
        />
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
        className={`flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${navItemClassName(
          active,
        )}`}
      >
        {label}
        <CaretDown size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <div
        className={`absolute left-0 top-full z-10 mt-2 ${width} rounded-xl border border-border bg-card p-2 shadow-lg`}
      >
        <Suspense fallback={<TypeLinksFallback links={links} onNavigate={onNavigate} />}>
          <TypeLinks
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
const tMenu = t("navMenu");
const tPosts = t("posts");
const tOffers = t("offers");
const site = t("site");

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // "Tất cả offers" is the bare path, so its type is null — same shape as the
  // blog's own all/post/video split.
  const cardLinks: TypeLink[] = [
    {
      href: "/credit-cards",
      type: null,
      label: tOffers("tabAll"),
      description: tMenu("cardsAll"),
      icon: CreditCard,
    },
    {
      href: "/credit-cards?type=noi-bat",
      type: "noi-bat",
      label: tOffers("tabElevated"),
      description: tMenu("cardsElevated"),
      icon: Sparkle,
    },
    {
      href: "/credit-cards?type=khac",
      type: "khac",
      label: tOffers("tabOther"),
      description: tMenu("cardsOther"),
      icon: Stack,
    },
  ];

  // "Blog" is a <summary>, not a link, so without this first entry the full
  // archive at /blog had no route in from the desktop nav at all — only the
  // footer reached it. Same shape as the card menu above.
  const blogLinks: TypeLink[] = [
    {
      href: "/blog",
      type: null,
      label: tPosts("tabAll"),
      description: tMenu("postsAll"),
      icon: Newspaper,
    },
    {
      href: "/blog?type=post",
      type: "post",
      label: tPosts("tabPosts"),
      description: tMenu("postsPosts"),
      icon: Article,
    },
    {
      href: "/blog?type=video",
      type: "video",
      label: tPosts("tabVideos"),
      description: tMenu("postsVideos"),
      icon: YoutubeLogo,
    },
  ];

  const toolsLinks: NavLink[] = [
    {
      href: "/award-flight-finder",
      label: nav("awardCharts"),
      description: tMenu("awardCharts"),
      icon: AirplaneTilt,
    },
    {
      href: "/calculator",
      label: nav("calculator"),
      description: tMenu("calculator"),
      icon: Calculator,
    },
    {
      href: "/transfer-bonuses",
      label: nav("transferBonuses"),
      description: tMenu("transferBonuses"),
      icon: Percent,
    },
    {
      href: "/transfer-partners",
      label: nav("transferPartners"),
      description: tMenu("transferPartners"),
      icon: ArrowsLeftRight,
    },
  ];

  const cardsActive = pathname === "/credit-cards" || pathname.startsWith("/credit-cards/");
  const blogActive = pathname === "/blog" || pathname.startsWith("/blog/");
  const toolsActive = toolsLinks.some((link) => pathname === link.href);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeDropdowns() {
      navRef.current
        ?.querySelectorAll("details[open]")
        .forEach((details) => details.removeAttribute("open"));
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) closeDropdowns();
    }

    // Escape is how every other menu on the web closes; <details> gives us the
    // open/close and the outside-click above, but not this.
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeDropdowns();
      setOpen(false);
    }

    document.addEventListener("click", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeParentDropdown(event: React.MouseEvent<HTMLElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  function closeMobileMenu() {
    setOpen(false);
  }

  return (
    // Sticking is done by the wrapper in the root layout, which carries the
    // offer strip along with it. `relative` stays behind because it is what
    // the search panel hangs off — the panel spans the full width under the
    // bar rather than dangling from the icon that opened it.
    <header className="relative border-b border-border bg-background/95 backdrop-blur">
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
          {/* The logo already goes home, but that is a convention rather than a
              label — the nav says so in words. */}
          <Link href="/" className={navItemClassName(pathname === "/")}>
            {nav("home")}
          </Link>

          <TypeDropdown
            label={nav("creditCards")}
            basePath="/credit-cards"
            links={cardLinks}
            active={cardsActive}
            width="w-80"
            pathname={pathname}
            onNavigate={closeParentDropdown}
          />

          <TypeDropdown
            label={nav("blog")}
            basePath="/blog"
            links={blogLinks}
            active={blogActive}
            width="w-80"
            pathname={pathname}
            onNavigate={closeParentDropdown}
          />

          <details name="nav-dropdown" className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${navItemClassName(
                toolsActive,
              )}`}
            >
              {nav("pointsTools")}
              <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 w-80 rounded-xl border border-border bg-card p-2 shadow-lg">
              {toolsLinks.map((link) => (
                <MenuItem
                  key={link.href}
                  link={link}
                  active={pathname === link.href}
                  onNavigate={closeParentDropdown}
                />
              ))}
            </div>
          </details>

          <Link href="/about" className={navItemClassName(pathname === "/about")}>
            {nav("about")}
          </Link>
        </nav>

        {/* One cluster for both breakpoints so search keeps a single instance —
            two copies behind `hidden` would each carry their own open state and
            their own copy of the index. */}
        <div className="flex items-center gap-1 lg:gap-3">
          <SiteSearch onOpen={() => setOpen(false)} />

          <Link
            href="/#newsletter"
            className="hidden cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover lg:flex"
          >
            {nav("newsletter")}
            <PaperPlaneTilt size={16} weight="bold" />
          </Link>

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
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className={mobileItemClassName(pathname === "/")}
            >
              {nav("home")}
            </Link>

            <Link
              href="/credit-cards"
              onClick={() => setOpen(false)}
              className={mobileItemClassName(cardsActive)}
            >
              {nav("creditCards")}
            </Link>
            <Suspense
              fallback={
                <TypeLinksFallback links={cardLinks} onNavigate={closeMobileMenu} compact />
              }
            >
              <TypeLinks
                links={cardLinks}
                basePath="/credit-cards"
                pathname={pathname}
                onNavigate={closeMobileMenu}
                compact
              />
            </Suspense>

            <Link
              href="/blog"
              onClick={() => setOpen(false)}
              className={mobileItemClassName(blogActive)}
            >
              {nav("blog")}
            </Link>
            <Suspense
              fallback={
                <TypeLinksFallback links={blogLinks} onNavigate={closeMobileMenu} compact />
              }
            >
              <TypeLinks
                links={blogLinks}
                basePath="/blog"
                pathname={pathname}
                onNavigate={closeMobileMenu}
                compact
              />
            </Suspense>

            <span className="mt-2 rounded-md px-2 py-3 text-base font-medium text-foreground/90">
              {nav("pointsTools")}
            </span>
            {toolsLinks.map((link) => (
              <MenuItem
                key={link.href}
                link={link}
                active={pathname === link.href}
                onNavigate={closeMobileMenu}
                compact
              />
            ))}

            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className={`mt-2 ${mobileItemClassName(pathname === "/about")}`}
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
