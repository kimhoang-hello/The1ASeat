import { slugifyVi } from "./blog-categories";
import { ringAfter } from "./card-next-steps";
import { formatMoney, type Bank, type BankAccount } from "./bank-accounts";
import { t as translate } from "./t";
import type { BlogPost, CreditCardOffer } from "./content/types";

const bank_t = translate("bankAccounts");

const KIND_LABEL_KEYS = {
  chequing: "kindChequing",
  savings: "kindSavings",
} as const;

/**
 * Dòng phụ của một tài khoản trong danh sách link: loại tài khoản + monthly
 * fee — đúng hai thứ mà bảng danh sách cũng dùng để phân biệt hai tài khoản
 * cùng một ngân hàng.
 *
 * Không phí thì nói thẳng "Miễn monthly fee": ghép "Monthly fee" với nhãn
 * "Miễn phí" ra "Monthly fee Miễn phí", đọc như một lỗi nối chuỗi — cùng lý do
 * `bankAccountDescription` không viết "Monthly fee miễn phí".
 */
export function accountMetaLine(account: BankAccount): string {
  const kind = bank_t(KIND_LABEL_KEYS[account.kind]);
  const fee =
    account.monthlyFee === 0
      ? bank_t("featureNoFee")
      : `${bank_t("monthlyFee")} ${formatMoney(account.monthlyFee)}`;
  return `${kind} · ${fee}`;
}

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
 * Các tài khoản khác của cùng ngân hàng, dưới dạng tài khoản thật chứ không
 * phải một link lọc.
 *
 * Cùng lý do với `siblingCardsInProgram` bên thẻ, và ở đây nặng hơn hẳn:
 * `otherAccountsFromBank` trả về `/bank-accounts?bank=rbc`, và đó là đường duy
 * nhất giữa các trang tài khoản với nhau — nên đo ngày 03/09/2026, cả 29 trang
 * tài khoản chỉ có đúng MỘT link nội bộ trỏ vào, đều từ trang danh sách. Ba
 * mươi trang có nội dung riêng mà crawler chỉ tới được qua một cửa duy nhất.
 *
 * Lấy theo VÒNG, cùng `ringAfter` mà bên thẻ dùng và cùng lý do: RBC® có 5 tài
 * khoản, nên "ba cái đầu danh sách" bỏ lại hai cái cuối đúng như cũ. Vòng thì
 * mỗi tài khoản của một ngân hàng được đúng `limit` trang anh em trỏ vào.
 */
export function siblingAccountsAtBank(
  account: BankAccount,
  accounts: BankAccount[],
  limit = 3,
): BankAccount[] {
  const family = accounts.filter((other) => other.bank === account.bank);
  return ringAfter(family, (other) => other.slug === account.slug, limit);
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
