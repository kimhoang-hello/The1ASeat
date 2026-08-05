import type { MetadataRoute } from "next";
import { getCreditCardOffers, getPosts } from "@/lib/content";
import { SITE_URL } from "@/lib/subscriber-email";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  const staticRoutes = [
    "",
    "/credit-cards",
    "/blog",
    "/calculator",
    "/transfer-bonuses",
    "/transfer-partners",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  const postRoutes = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.publishedAt,
  }));

  const offerRoutes = offers.map((offer) => ({
    url: `${SITE_URL}/credit-cards/${offer.slug}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...postRoutes, ...offerRoutes];
}
