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
  /** Skip the "%s | Ghế 1A" title template (used by the homepage). Also
   *  skipped automatically when the suffix would push the title past
   *  `TITLE_MAX`. */
  absoluteTitle?: boolean;
}

/** Đuôi mà template `%s | Ghế 1A` của layout gắn vào mọi tiêu đề. */
const TITLE_SUFFIX = ` | ${site("name")}`;

/**
 * Google cắt `<title>` ở khoảng 600px, xấp xỉ 60 ký tự. Tiêu đề đã dài thì
 * gắn thêm đuôi tên site chỉ đẩy phần có nghĩa — tên khách sạn, tên thẻ — ra
 * sau dấu "…", để giữ một cái tên thương hiệu mà Google vốn đã hiện riêng
 * phía trên kết quả. Đo 22/09/2026: 12 bài vượt 65 ký tự chỉ vì cái đuôi này.
 */
const TITLE_MAX = 60;

export function pageMetadata({
  title,
  description,
  path,
  image,
  article,
  absoluteTitle,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const skipSuffix = absoluteTitle || title.length + TITLE_SUFFIX.length > TITLE_MAX;
  // Every page sets its own `openGraph` object, which replaces (not merges
  // with) the root layout's — including the site-wide opengraph-image file
  // convention, which only applies to the segment it's defined in ("/").
  // So pages need an explicit image or they render no og:image at all.
  const resolvedImage = image || absoluteUrl("/opengraph-image");

  return {
    title: skipSuffix ? { absolute: title } : title,
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
