import { getPosts } from "@/lib/content";
import { getYouTubeThumbnailUrl } from "@/lib/video-embed";
import { absoluteUrl, RSS_PATH } from "@/lib/seo";
import { t } from "@/lib/t";

const site = t("site");
const seo = t("seo");

export const revalidate = 60;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * RSS 2.0 feed. Cheap to maintain and it is how aggregators, newsreaders and
 * (still) some discovery surfaces pick up new posts without waiting for a
 * crawl. Linked from every page's <head> via `alternates` in lib/seo.ts.
 */
export async function GET() {
  const posts = await getPosts();
  const latest = posts.slice(0, 30);
  const lastBuildDate = new Date(latest[0]?.publishedAt ?? Date.now()).toUTCString();

  const items = latest
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      const image = post.coverPhoto || getYouTubeThumbnailUrl(post.videoUrl ?? "");

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
      <category>${escapeXml(post.category)}</category>
      <dc:creator>${escapeXml(post.author)}</dc:creator>${
        image ? `\n      <enclosure url="${escapeXml(image)}" type="image/jpeg" />` : ""
      }
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(`${site("name")} — ${site("tagline")}`)}</title>
    <link>${absoluteUrl("/")}</link>
    <description>${escapeXml(seo("homeDescription"))}</description>
    <language>vi</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${absoluteUrl(RSS_PATH)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
    },
  });
}
