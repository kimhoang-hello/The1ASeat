import postsData from "../../../content/sample/posts.json";
import creditCardsData from "../../../content/sample/credit-cards.json";
import transferBonusesData from "../../../content/sample/transfer-bonuses.json";
import authorData from "../../../content/sample/author.json";
import type { AuthorProfile, BlogPost, CreditCardOffer, TransferBonus } from "./types";

/**
 * `bodyBlocks` dựng tại đây chứ không nằm trong JSON: bộ mẫu là HTML viết tay,
 * không phải rich text, nên không có cây để cắt. Cắt ở ranh giới `</p>` cấp
 * cao nhất là đủ cho dữ liệu mẫu — và nếu không khớp gì thì cả thân bài thành
 * MỘT khối, tức trang vẫn đúng, chỉ là không chèn được khối thẻ vào giữa.
 *
 * `as BlogPost[]` ở bản cũ che mất việc thiếu field này khỏi TypeScript; giữ
 * nguyên phép ép kiểu cho phần còn lại nhưng field mới thì dựng thật.
 */
export function getSamplePosts(): BlogPost[] {
  return (postsData as Omit<BlogPost, "bodyBlocks">[]).map((post) => ({
    ...post,
    bodyBlocks: post.body.split(/(?<=<\/p>)(?=\s*<)/).filter((block) => block.trim().length > 0),
  }));
}

export function getSampleCreditCardOffers(): CreditCardOffer[] {
  return creditCardsData as CreditCardOffer[];
}

export function getSampleTransferBonuses(): TransferBonus[] {
  return transferBonusesData as TransferBonus[];
}

export function getSampleAuthor(): AuthorProfile {
  return authorData as AuthorProfile;
}
