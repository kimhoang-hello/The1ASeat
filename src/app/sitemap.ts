import type { MetadataRoute } from "next";
import { getCreditCardOffers, getPosts } from "@/lib/content";
import {
  categoryPath,
  getCategories,
  lastModified,
  latestModified,
} from "@/lib/blog-categories";
import { absoluteUrl } from "@/lib/seo";
import { COMPARE_PATH } from "@/lib/card-compare";
import { BANK_COMPARE_PATH } from "@/lib/bank-compare";
import { BANK_ACCOUNTS, bankAccountPath } from "@/lib/bank-accounts";
import { BANK_ACCOUNTS_PUBLISHED, START_HERE_PUBLISHED } from "@/lib/feature-flags";

// Keep the sitemap in step with the ISR window on the pages it lists.
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  const categories = getCategories(posts);
  // Lần SỬA gần nhất, không phải bài ĐĂNG gần nhất. `posts[0]` là bài có
  // `publishedAt` mới nhất; sửa một bài cũ sau khi đã đăng bài mới thì nội dung
  // của `/blog` đổi mà `lastmod` vẫn đứng yên, và crawler không có lý do quay
  // lại. `latestModified` so bằng `Date` — so chuỗi ở đây là sai, hai trường
  // nguồn mang hai dạng ISO khác nhau (xem chú thích của nó).
  const newestPost = latestModified(posts) ?? new Date().toISOString();

  // Previously every entry claimed lastmod = "now" on each rebuild, which tells
  // a crawler the whole site changed every time and makes lastmod worthless.
  // Content-backed URLs now carry the date of the content behind them.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: newestPost, changeFrequency: "daily", priority: 1 },
    ...(START_HERE_PUBLISHED
      ? ([
          { url: absoluteUrl("/bat-dau"), changeFrequency: "monthly" as const, priority: 0.8 },
        ] satisfies MetadataRoute.Sitemap)
      : []),
    { url: absoluteUrl("/credit-cards"), changeFrequency: "weekly", priority: 0.9 },
    // Chỉ trang trần. Mọi tổ hợp `?cards=` là cùng một công cụ và đều canonical
    // về đây, nên liệt kê từng tổ hợp là tự nộp cho Google hàng trăm URL trùng
    // nội dung.
    { url: absoluteUrl(COMPARE_PATH), changeFrequency: "weekly", priority: 0.6 },
    ...(BANK_ACCOUNTS_PUBLISHED
      ? ([
          { url: absoluteUrl("/bank-accounts"), changeFrequency: "weekly", priority: 0.8 },
          // Chỉ trang trần, cùng lý do với trang so sánh thẻ: mọi tổ hợp
          // `?accounts=` canonical về đây.
          { url: absoluteUrl(BANK_COMPARE_PATH), changeFrequency: "weekly", priority: 0.6 },
          ...BANK_ACCOUNTS.map((account) => ({
            url: absoluteUrl(bankAccountPath(account.slug)),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          })),
        ] as const)
      : []),
    { url: absoluteUrl("/blog"), lastModified: newestPost, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/transfer-bonuses"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/transfer-partners"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/award-flight-finder"), changeFrequency: "weekly", priority: 0.8 },
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
