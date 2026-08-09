import type { BlogPost } from "./content";
import { t } from "./t";

const seo = t("seo");

/**
 * Vietnamese-safe slug: "Khách sạn" -> "khach-san", "Đánh giá" -> "danh-gia".
 *
 * NFD splits the accented vowels into a base letter plus a combining mark
 * (including the horn on ư/ơ and the breve on ă), which the range strip below
 * removes. "đ" has no decomposition, so it is mapped by hand.
 */
export function slugifyVi(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The later of Contentful's sys.updatedAt and the hand-set publishedAt — used
 * for dateModified and sitemap lastmod. The two fields arrive in different ISO
 * shapes ("2026-06-28T00:00-04:00" vs "2026-08-02T16:55:43.826Z"), so they have
 * to be compared as Dates, not as strings.
 */
export function lastModified(post: BlogPost): string {
  if (!post.updatedAt) return post.publishedAt;
  return new Date(post.updatedAt) > new Date(post.publishedAt) ? post.updatedAt : post.publishedAt;
}

export interface BlogCategory {
  /** The category exactly as written in Contentful, e.g. "Khách sạn". */
  name: string;
  slug: string;
  count: number;
  /** Most recent lastModified() across the category's posts, for sitemap lastmod. */
  lastModified: string;
}

/**
 * Hand-written meta descriptions for the categories that exist today. Anything
 * new the user adds in Contentful falls back to the generic template in
 * messages/vi.json, so adding a category never ships a page with no description.
 */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Khách sạn":
    "Review khách sạn đổi điểm ở châu Á và châu Âu: cần bao nhiêu điểm cho một đêm, phòng và tiện ích thế nào, có đáng để đổi không.",
  "Đánh giá":
    "Review hạng thương gia và hạng nhất của các hãng hàng không: ghế, suất ăn, dịch vụ và số điểm cần có để đổi được vé.",
  "Kiến thức":
    "Kiến thức nền tảng về Miles & Points cho người mới: bắt đầu từ đâu, chọn thẻ nào, tích điểm ra sao và tránh các sai lầm phổ biến.",
  Deals:
    "Các deal điểm thưởng đang chạy: transfer bonus, khuyến mãi mua điểm và welcome offer được nâng — kèm hạn chót từng chương trình.",
};

export function categoryDescription(category: BlogCategory): string {
  return (
    CATEGORY_DESCRIPTIONS[category.name] ??
    seo("categoryDescription", { category: category.name.toLowerCase(), count: category.count })
  );
}

export function categoryPath(slug: string): string {
  return `/blog/chuyen-muc/${slug}`;
}

/** Every category that has at least one post, most posts first. */
export function getCategories(posts: BlogPost[]): BlogCategory[] {
  const byName = new Map<string, BlogCategory>();

  for (const post of posts) {
    if (!post.category) continue;
    const touched = lastModified(post);
    const existing = byName.get(post.category);
    if (existing) {
      existing.count += 1;
      if (new Date(touched) > new Date(existing.lastModified)) existing.lastModified = touched;
    } else {
      byName.set(post.category, {
        name: post.category,
        slug: slugifyVi(post.category),
        count: 1,
        lastModified: touched,
      });
    }
  }

  return [...byName.values()].sort((a, b) => b.count - a.count);
}

export function findCategory(posts: BlogPost[], slug: string): BlogCategory | undefined {
  return getCategories(posts).find((category) => category.slug === slug);
}

export function postsInCategory(posts: BlogPost[], category: BlogCategory): BlogPost[] {
  return posts.filter((post) => post.category === category.name);
}

/**
 * Same-category posts first, then the most recent of everything else, so a post
 * always has somewhere to send a reader even in a category of one.
 * `posts` is expected newest-first, which is how getPosts() returns them.
 */
export function getRelatedPosts(posts: BlogPost[], current: BlogPost, limit = 3): BlogPost[] {
  const others = posts.filter((post) => post.slug !== current.slug);
  return [
    ...others.filter((post) => post.category === current.category),
    ...others.filter((post) => post.category !== current.category),
  ].slice(0, limit);
}
