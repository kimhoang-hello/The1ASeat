import { slugifyVi } from "./blog-categories";
import { creditCardsPath, getCardPointsPrograms, programIdsInText } from "./card-points-programs";
import type { BlogPost, CreditCardOffer } from "./content/types";

/**
 * Chiều ngược của `card-next-steps.ts`: từ một bài viết đi tới thẻ.
 *
 * Trang bài viết không phải ngõ cụt về điều hướng — `getRelatedPosts` luôn lấp
 * đủ ba bài. Nhưng mọi đường ra đều quay lại trong blog: một bài viết về thẻ
 * tín dụng không có lấy một đường nào sang trang thẻ, tức là trang ra tiền của
 * site không nhận được gì từ nội dung dẫn người đọc tới nó.
 */

/** Thân bài là HTML; tên thẻ nằm trong chữ chứ không nằm trong thẻ đánh dấu. */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

/**
 * Thẻ được nhắc ĐÍCH DANH trong bài — so trên cả thân bài, khác hẳn
 * `relatedPostsForCard` (chiều ngược lại) vốn cố ý KHÔNG đụng tới thân bài.
 *
 * Hai chiều khác nhau vì thứ đem đi so khác nhau. Chiều kia so bằng tên ngân
 * hàng, mà thân bài nhắc tên ngân hàng ở khắp nơi ("mở thẻ TD® nào cũng…") nên
 * mỗi thẻ TD® sẽ kéo về cùng một mớ bài chẳng liên quan. Chiều này so bằng TRỌN
 * tên thẻ — "American Express® Aeroplan® Reserve" xuất hiện trong thân bài thì
 * bài đó thật sự đang nói về nó, không có cách nào trùng ngẫu nhiên.
 *
 * Thực tế mức này bắt được ÍT: đo ngày 30/08/2026 trên 36 bài thì đúng 1 bài
 * viết trọn tên một tấm thẻ. Người viết gọi thẻ bằng tên rút gọn ("Amex MR"),
 * còn Contentful lưu nguyên tên dài kèm ® và đuôi "Card". Đã thử chuẩn hoá hai vế
 * ("american express" → "amex", bỏ đuôi "-card") và đo lại: THÊM ĐÚNG 0 BÀI —
 * nên đừng thêm lại lớp đó. Chính vì mức này thưa mà `PostNextSteps` có mức 3.
 *
 * Thẻ có tên là khúc đầu của tên thẻ khác bị loại: bài nói về "RBC® Avion® Visa
 * Infinite Privilege" đương nhiên cũng chứa chuỗi "RBC® Avion® Visa Infinite",
 * và hiện cả hai sẽ nói với người đọc rằng bài này bàn về một tấm thẻ nó không
 * hề nhắc tới.
 */
export function cardsMentionedInPost(
  post: BlogPost,
  offers: CreditCardOffer[],
  limit = 3,
): CreditCardOffer[] {
  const haystack = slugifyVi(`${post.title} ${post.excerpt} ${stripTags(post.body)}`);

  const matched = offers
    .map((offer) => ({ offer, key: slugifyVi(offer.name) }))
    .filter(({ key }) => key.length > 0 && haystack.includes(key))
    // Dài trước, để vòng lọc dưới giữ lại tên đầy đủ và bỏ tên bị bao trong nó.
    .sort((a, b) => b.key.length - a.key.length);

  const kept: typeof matched = [];
  for (const entry of matched) {
    if (kept.some((other) => other.key.includes(entry.key))) continue;
    kept.push(entry);
  }

  return kept.slice(0, limit).map((entry) => entry.offer);
}

/**
 * Hệ điểm bài này nói tới, nếu có — chỉ soi TIÊU ĐỀ và mô tả ngắn, không soi
 * thân bài: gần như bài nào cũng nhắc "Aeroplan®" đâu đó ở giữa, còn tiêu đề
 * gọi tên hệ điểm thì bài thật sự viết về hệ đó.
 */
export function pointsProgramForPost(
  post: BlogPost,
  offers: CreditCardOffer[],
): { href: string; name: string } | null {
  const ids = programIdsInText(`${post.title} ${post.excerpt}`);
  if (ids.length === 0) return null;

  // Hệ ĐẦU TIÊN vừa được bài gọi tên vừa thật sự có thẻ — không phải hệ đầu
  // tiên được gọi tên. `getCardPointsPrograms` chỉ trả về hệ có thẻ, nên phép
  // lọc này vừa giữ link khỏi bẫy `?points=` hỏng lặng (`/credit-cards` cố ý
  // cho id lạ trả về danh sách KHÔNG lọc, người đọc tưởng là kết quả lọc), vừa
  // cứu được bài gọi tên nhiều hệ mà hệ đứng trước lại không có thẻ nào.
  const available = getCardPointsPrograms(offers);
  const hit = ids.map((id) => available.find((program) => program.id === id)).find(Boolean);

  return hit ? { href: creditCardsPath({ points: hit.id }), name: hit.name } : null;
}
