import { getPosts } from "./content";
import { US_CARDS_BEGINNER_SLUG, US_CARDS_GUIDE_SLUGS } from "./us-credit-cards";

export type UsCardsGuide = { slug: string; href: string; title: string; excerpt: string };

/**
 * Các bài hướng dẫn thẻ Mỹ đang PHỤC VỤ, theo đúng thứ tự trong
 * `US_CARDS_GUIDE_SLUGS`. Tiêu đề lấy thẳng từ Contentful nên đổi tên bài là
 * trang đổi theo, không có chỗ nào chép tay tiêu đề.
 *
 * Bài chưa publish thì rơi khỏi danh sách: nút "Xem hướng dẫn" tự ẩn thay vì
 * dẫn người đọc vào 404. Trong lúc mục còn là bản nháp thì cũng vậy — hồi bài
 * chưa có, nút cố ý vẫn hiện, nhưng nay cả hai bài đã lên nên không còn cần
 * cửa hậu đó nữa.
 *
 * File riêng, không nằm trong `us-credit-cards.ts`: hàm này đọc Contentful,
 * còn file dữ liệu phải import được trần trong test (`node --test`).
 */
export async function usCardsGuides(): Promise<UsCardsGuide[]> {
  const posts = await getPosts();
  return US_CARDS_GUIDE_SLUGS.flatMap((slug) => {
    const post = posts.find((item) => item.slug === slug);
    if (!post) return [];
    return [{ slug, href: `/blog/${slug}`, title: post.title, excerpt: post.excerpt }];
  });
}

/**
 * Bài cho NGƯỜI MỚI — `US_CARDS_BEGINNER_SLUG`, và chỉ bài đó.
 *
 * Mọi nút "Xem hướng dẫn" đều đứng cạnh chữ nói về ITIN, thẻ US đầu tiên và US
 * credit history, nên chúng phải trỏ đúng bài ấy. Lấy `guides[0]` sau khi lọc
 * thì bài đó bị unpublish — hoặc chỉ cần đổi thứ tự đọc — là các nút lặng lẽ
 * trỏ sang bài khác, không trả lời câu hỏi người đọc vừa đọc. Không có bài này
 * thì nút ẩn, còn danh sách nhiều bài vẫn hiện những bài còn lại.
 */
export function beginnerGuideHref(guides: UsCardsGuide[]): string | undefined {
  return guides.find((guide) => guide.slug === US_CARDS_BEGINNER_SLUG)?.href;
}

/** Cùng bài, cho chỗ chỉ cần một link và không cần cả danh sách. */
export async function usCardsGuideHref(): Promise<string | undefined> {
  return beginnerGuideHref(await usCardsGuides());
}
