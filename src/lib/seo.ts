import type { Metadata } from "next";
import { SITE_URL } from "./subscriber-email";
import { t } from "./t";

const site = t("site");

export const RSS_PATH = "/feed.xml";

/** Absolute URL for a site-relative path ("/blog" -> "https://ghe1a.com/blog"). */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * The RSS <link rel="alternate"> that belongs in every page's <head>.
 *
 * Next.js replaces the whole `alternates` object when a page defines one
 * (it does not deep-merge with the layout), so any page that sets a canonical
 * has to re-declare this or it silently loses the feed link. Every page goes
 * through `pageMetadata()` below, which folds both in together.
 */
const rssAlternate = {
  "application/rss+xml": [{ url: absoluteUrl(RSS_PATH), title: `${site("name")} — ${site("tagline")}` }],
};

export const alternatesWithFeed = { types: rssAlternate };

interface PageMetadataInput {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/blog" or "/". Used for canonical + og:url. */
  path: string;
  /** Absolute image URL. Falls back to the site-wide opengraph-image. */
  image?: string;
  /** Set for article-like pages so og:type is "article" instead of "website". */
  article?: { publishedTime?: string; modifiedTime?: string; section?: string };
  /** Skip the "%s | Ghế 1A" title template (used by the homepage). */
  absoluteTitle?: boolean;
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  article,
  absoluteTitle,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  // Every page sets its own `openGraph` object, which replaces (not merges
  // with) the root layout's — including the site-wide opengraph-image file
  // convention, which only applies to the segment it's defined in ("/").
  // So pages need an explicit image or they render no og:image at all.
  const resolvedImage = image || absoluteUrl("/opengraph-image");

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, types: rssAlternate },
    openGraph: {
      title,
      description,
      url,
      type: article ? "article" : "website",
      ...(article?.publishedTime && { publishedTime: article.publishedTime }),
      ...(article?.modifiedTime && { modifiedTime: article.modifiedTime }),
      ...(article?.section && { section: article.section }),
      images: [{ url: resolvedImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolvedImage],
    },
  };
}

/** BreadcrumbList JSON-LD from an ordered list of crumbs (excluding the site root). */
export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: site("name"), path: "/" }, ...crumbs].map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}
