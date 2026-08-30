import { slugifyVi } from "./blog-categories";
import type { Bank, BankAccount } from "./bank-accounts";
import type { BlogPost, CreditCardOffer } from "./content/types";

/**
 * Bản song song của `card-next-steps.ts` cho trang chi tiết tài khoản ngân
 * hàng.
 *
 * Trang đó có nút so sánh cạnh nút apply và một dải link cỡ `text-xs` ở chân
 * trang, yếu hơn hẳn trang thẻ tương ứng: không bài viết liên quan, và không
 * một đường nào sang mục thẻ tín dụng dù người vừa mở tài khoản ở một ngân
 * hàng chính là người dễ mở thẻ của ngân hàng đó nhất.
 *
 * Cùng luật với bản gốc: mọi đường suy ra từ dữ liệu, đường nào không có thì
 * không hiện.
 */

/**
 * Thẻ tín dụng do chính ngân hàng này phát hành.
 *
 * So bằng `slugifyVi` chứ không so chuỗi thẳng: `BANKS[].name` và
 * `offer.issuer` hiện trùng nhau từng ký tự cho sáu ngân hàng có thẻ, nhưng
 * `issuer` là chữ tự do trong Contentful — sửa "RBC®" thành "RBC" ở đó là một
 * phép so chính xác sẽ đứt lặng, không có gì báo.
 *
 * Bốn ngân hàng còn lại (Tangerine®, EQ Bank™, Simplii Financial™, KOHO) không
 * có thẻ nào trên site, nên trả về danh sách rỗng và khối gọi nó sẽ không hiện
 * mục này — đúng ý, chứ không phải thiếu sót.
 */
export function cardsFromBank(
  bank: Bank,
  offers: CreditCardOffer[],
  limit = 3,
): CreditCardOffer[] {
  const bankKey = slugifyVi(bank.name);
  if (!bankKey) return [];

  return offers.filter((offer) => slugifyVi(offer.issuer) === bankKey).slice(0, limit);
}

/**
 * Link tới các tài khoản khác cùng ngân hàng, kèm số lượng — `null` khi đây là
 * tài khoản duy nhất của ngân hàng đó, vì một bộ lọc trả về đúng cái người đọc
 * đang đứng trên nó thì không dẫn đi đâu cả. Cùng luật với
 * `samePointsProgramLink` bên thẻ.
 */
export function otherAccountsFromBank(
  account: BankAccount,
  accounts: BankAccount[],
): { href: string; count: number } | null {
  const count = accounts.filter((other) => other.bank === account.bank).length;
  if (count < 2) return null;

  return { href: `/bank-accounts?bank=${account.bank}`, count: count - 1 };
}

/**
 * Bài viết nói về đúng tài khoản này hoặc đúng ngân hàng này.
 *
 * Chỉ so trên tiêu đề, mô tả ngắn và chuyên mục — KHÔNG so thân bài, đúng lý
 * do đã ghi ở `relatedPostsForCard`: thân bài nhắc tên ngân hàng ở mọi chỗ nên
 * so ở đó thì mọi tài khoản Scotiabank® kéo về cùng một mớ bài chẳng liên quan.
 *
 * Điểm: tên tài khoản khớp là 3, tên ngân hàng là 2, và ngưỡng là 2 — nghĩa là
 * tên ngân hàng xuất hiện trong TIÊU ĐỀ đã đủ. Ở tiêu đề thì đó là tín hiệu
 * thật ("Ưu đãi Scotiabank® tháng 8" đúng là chuyện của người đang xem tài
 * khoản Scotiabank®), khác hẳn khi nó nằm lẫn giữa thân bài.
 */
export function relatedPostsForAccount(
  account: BankAccount,
  bank: Bank,
  posts: BlogPost[],
  limit = 3,
): BlogPost[] {
  const accountKey = slugifyVi(account.name);
  const bankKey = slugifyVi(bank.name);

  const scored = posts
    .map((post) => {
      const haystack = slugifyVi(`${post.title} ${post.excerpt} ${post.category}`);
      let score = 0;
      if (accountKey && haystack.includes(accountKey)) score += 3;
      if (bankKey && haystack.includes(bankKey)) score += 2;
      return { post, score };
    })
    .filter((entry) => entry.score >= 2);

  // So bằng mốc thời gian, KHÔNG so chuỗi — bài viết tay mang offset (`-04:00`)
  // còn bài video do `sync-videos` tạo mang `Z`, nên so chuỗi xếp sai thứ tự.
  // Cùng cái bẫy đã vấp ở sitemap và ở `relatedPostsForCard`.
  const at = (post: BlogPost) => new Date(post.publishedAt).getTime() || 0;
  scored.sort((a, b) => b.score - a.score || at(b.post) - at(a.post));

  return scored.slice(0, limit).map((entry) => entry.post);
}
