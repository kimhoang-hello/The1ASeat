import type { MetadataRoute } from "next";
import { getCreditCardOffers, getPosts } from "@/lib/content";
import { categoryPath, getCategories, lastModified } from "@/lib/blog-categories";
import { absoluteUrl } from "@/lib/seo";

// Keep the sitemap in step with the ISR window on the pages it lists.
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  const categories = getCategories(posts);
  const newestPost = posts[0] ? lastModified(posts[0]) : new Date().toISOString();

  // Previously every entry claimed lastmod = "now" on each rebuild, which tells
  // a crawler the whole site changed every time and makes lastmod worthless.
  // Content-backed URLs now carry the date of the content behind them.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: newestPost, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/credit-cards"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/blog"), lastModified: newestPost, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/transfer-bonuses"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/transfer-partners"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/calculator"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.1 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: absoluteUrl(categoryPath(category.slug)),
    lastModified: category.lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: lastModified(post),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const offerRoutes: MetadataRoute.Sitemap = offers.map((offer) => ({
    url: absoluteUrl(`/credit-cards/${offer.slug}`),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...postRoutes, ...offerRoutes];
}
