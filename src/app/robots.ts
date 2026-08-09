import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/subscriber-email";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Route handlers, not pages: nothing here renders anything a searcher
      // would want, and /api/revalidate & friends are secret-gated anyway.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
