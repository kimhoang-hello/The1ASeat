import type { BlogPost } from "@/lib/content";
import { latestModified } from "@/lib/blog-categories";

/**
 * Lộ trình đọc của Bước 1 trên `/bat-dau`, viết cứng theo slug và theo đúng
 * thứ tự nên đọc.
 *
 * TRƯỚC ĐÂY trang lấy cả chuyên mục "Kiến thức" rồi đảo ngược thứ tự xuất bản.
 * Hai chỗ hỏng: (1) mọi bài Kiến thức đăng về sau TỰ ĐỘNG thành bước kế tiếp
 * của lộ trình cho người mới, kể cả bài nâng cao, và không có trần — tới bài
 * thứ 15 thì "lộ trình 15 bài" không còn là lộ trình; (2) đổi tên chuyên mục
 * trong Contentful, hay lệch một khoảng trắng, là lộ trình rỗng mà không build
 * nào đỏ để báo.
 *
 * Thứ tự dưới đây GIỮ NGUYÊN thứ tự xuất bản cũ — tác giả chốt 30/08/2026.
 * Sắp lại là quyết định biên tập của tác giả, không phải việc suy ra từ tiêu
 * đề. Thêm bài vào lộ trình cũng vậy: thêm slug vào đây, có chủ ý.
 *
 * Nằm ở `lib/` chứ không nằm trong chính trang, vì `sitemap.ts` cũng cần nó:
 * ngày `lastModified` của `/bat-dau` phải là ngày của những bài THẬT SỰ trong
 * lộ trình, không phải bài mới nhất của cả site.
 */
export const FOUNDATION_SLUGS = [
  "bat-dau-choi-miles-points-dieu-co-ban-nhat",
  "3-dieu-uoc-gi-biet-truoc-mile-points",
  "cashback-hay-points-vi-sao-ngan-hang-hao-phong-voi-points",
  "canadian-credit-card-points-101-nen-tich-diem-nao",
  "know-your-minimum-deal-nao-dang-de-toi-uu",
  "tai-sao-nen-co-nhieu-point-currencies",
] as const;

/**
 * Các bài của lộ trình, theo đúng thứ tự trong `FOUNDATION_SLUGS`.
 *
 * Slug nào không tìm thấy thì bị bỏ qua — bài bị đổi slug, unpublish hay xoá
 * không được làm gãy cả trang. Người gọi tự so `length` với
 * `FOUNDATION_SLUGS.length` nếu muốn báo động.
 */
export function foundationPosts(posts: BlogPost[]): BlogPost[] {
  return FOUNDATION_SLUGS.map((slug) => posts.find((post) => post.slug === slug)).filter(
    (post): post is BlogPost => post !== undefined,
  );
}

/** Slug khai trong lộ trình nhưng không có bài nào mang slug đó. */
export function missingFoundationSlugs(posts: BlogPost[]): string[] {
  return FOUNDATION_SLUGS.filter((slug) => !posts.some((post) => post.slug === slug));
}

/**
 * Ngày dùng cho `lastModified` của `/bat-dau` trong sitemap.
 *
 * Lấy ngày mới nhất trong CHÍNH các bài của lộ trình, không phải bài mới nhất
 * của cả site: nội dung đứng sau trang này là sáu bài đó, nên một bài Deals
 * đăng hôm nay không làm trang Bắt đầu mới đi. Lộ trình rỗng thì trả
 * `undefined` và entry sitemap không mang ngày, còn hơn mang một ngày bịa.
 */
export function foundationLastModified(posts: BlogPost[]): string | undefined {
  // Dùng thẳng `latestModified` chứ đừng tự so lại: nó đã bỏ qua ngày không
  // đọc được. Tự viết vòng `reduce` thì một `publishedAt` hỏng lọt vào làm mốc
  // đầu tiên sẽ chặn mọi ngày hợp lệ đứng sau (`NaN > NaN` là false), và
  // `/bat-dau` nhận đúng chuỗi hỏng đó làm `lastmod`.
  return latestModified(foundationPosts(posts));
}
