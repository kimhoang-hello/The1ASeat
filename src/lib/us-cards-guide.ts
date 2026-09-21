import { getPostBySlug } from "./content";
import { US_CARDS_PUBLISHED } from "./feature-flags";
import { US_CARDS_GUIDE_SLUG } from "./us-credit-cards";

/**
 * Link tới bài hướng dẫn chơi thẻ Mỹ, hoặc `undefined` khi không được hiện.
 *
 * Bài chưa có lúc dựng mục này. Trong lúc mục còn là bản nháp, các nút vẫn hiện
 * (trỏ tới đúng URL bài sẽ có) để duyệt được giao diện. Đã công bố mà bài vẫn
 * chưa có thì mọi nút "Xem hướng dẫn" tự ẩn — không dẫn người đọc vào trang 404.
 *
 * File riêng, không nằm trong `us-credit-cards.ts`: hàm này đọc Contentful,
 * còn file dữ liệu phải import được trần trong test (`node --test`).
 */
export async function usCardsGuideHref(): Promise<string | undefined> {
  const href = `/blog/${US_CARDS_GUIDE_SLUG}`;
  if (!US_CARDS_PUBLISHED) return href;
  return (await getPostBySlug(US_CARDS_GUIDE_SLUG)) ? href : undefined;
}
