import { slugifyVi } from "./blog-categories";
import { PROGRAMS } from "./award-charts";
import { getCardPointsPrograms, programIdFor, creditCardsPath } from "./card-points-programs";
import { BANKS, type Bank, type BankAccount } from "./bank-accounts";
import type { BlogPost, CreditCardOffer } from "./content/types";

/**
 * Trang chi tiết một thẻ từng là ngõ cụt: nút apply, link về danh sách, link về
 * trang chủ. Không có đường nào đi tiếp tới thứ trả lời câu hỏi kế tiếp của
 * người đọc — "điểm này bay được đâu", "còn thẻ nào cùng loại điểm", "có bài
 * nào viết về nó không". Đây là nguyên tắc "mọi con số phải nối được tới hành
 * động" của site, đứt ngay ở trang ra tiền.
 *
 * Mọi đường ở đây đều suy ra từ dữ liệu đang có, không có bảng gán tay nào cần
 * bảo trì song song — trừ đúng một danh sách hai phần tử được ghi chú bên dưới.
 */

/**
 * Hai hệ điểm mà `/transfer-partners` thật sự có cột. Bảng đó có đúng hai cột
 * `amex` và `rbc` (xem `TransferPartnerRow`), nên đây là hình dạng của dữ liệu
 * chứ không phải lựa chọn biên tập. Thẻ Bonvoy®, Scene+™, TD Rewards… chuyển
 * điểm theo luật riêng của chương trình chúng, không qua trang này — nên chúng
 * KHÔNG được trỏ tới đó, thà không có link còn hơn có link sai chỗ.
 */
const TRANSFER_TOOL_PROGRAMS = new Set(["amex-mr", "avion"]);

export interface NextStepLink {
  href: string;
  label: string;
  description: string;
}

/**
 * Công cụ tra cứu hợp với loại điểm thẻ này kiếm được, hoặc `null` nếu không
 * có công cụ nào thật sự nói về nó.
 *
 * Award Flight Finder chỉ nhận chương trình mà nó có bảng giá — kiểm bằng
 * `PROGRAMS` chứ không phải bằng danh sách chép tay, nên thêm một chương trình
 * vào công cụ là link này tự có.
 */
export function pointsToolFor(
  offer: CreditCardOffer,
  labels: { awardLabel: string; awardDescription: string; transferLabel: string; transferDescription: string },
): NextStepLink | null {
  const programId = programIdFor(offer);
  if (!programId) return null;

  if (PROGRAMS.some((program) => program.id === programId)) {
    return {
      href: "/award-flight-finder",
      label: labels.awardLabel,
      description: labels.awardDescription,
    };
  }

  if (TRANSFER_TOOL_PROGRAMS.has(programId)) {
    return {
      href: "/transfer-partners",
      label: labels.transferLabel,
      description: labels.transferDescription,
    };
  }

  return null;
}

/**
 * Link tới các thẻ khác cùng loại điểm, kèm số lượng — `null` khi thẻ này là
 * thẻ duy nhất của chương trình đó, vì một chip lọc ra đúng một thẻ mà người
 * đọc đang đứng trên nó thì không dẫn đi đâu cả.
 */
export function samePointsProgramLink(
  offer: CreditCardOffer,
  offers: CreditCardOffer[],
): { href: string; programName: string; count: number } | null {
  const programId = programIdFor(offer);
  if (!programId) return null;

  const program = getCardPointsPrograms(offers).find((p) => p.id === programId);
  if (!program || program.count < 2) return null;

  return {
    href: creditCardsPath({ points: programId }),
    programName: program.name,
    count: program.count - 1,
  };
}

/**
 * `limit` phần tử đứng ngay sau `self` trong `items`, vòng lại đầu khi hết —
 * và không bao giờ trả về chính `self`.
 *
 * Dùng chung cho thẻ và cho tài khoản ngân hàng (`bank-next-steps.ts` gọi lại
 * hàm này). Tính chất cần ở cả hai chỗ: với `n` phần tử và `limit >= 1`, mỗi
 * phần tử được đúng `min(limit, n - 1)` phần tử khác trỏ vào — không có phần
 * tử nào bị bỏ lại, đó chính là điều mà cách "lấy `limit` phần tử đầu danh
 * sách" không bảo đảm được.
 */
export function ringAfter<T>(items: T[], isSelf: (item: T) => boolean, limit: number): T[] {
  const index = items.findIndex(isSelf);
  if (index < 0) return items.slice(0, limit);

  const out: T[] = [];
  for (let step = 1; step < items.length && out.length < limit; step++) {
    out.push(items[(index + step) % items.length]);
  }
  return out;
}

/**
 * Các thẻ khác cùng hệ điểm, dưới dạng thẻ thật chứ không phải một link lọc.
 *
 * `samePointsProgramLink` ở trên dẫn tới `/credit-cards?points=aeroplan`, và
 * chừng nào đó là đường DUY NHẤT thì bốn trang thẻ Aeroplan® trên site chỉ có
 * đúng một link nội bộ trỏ vào mỗi trang — từ trang danh sách. Đo ngày
 * 03/09/2026: 8 trong 26 trang thẻ ở tình trạng đó, gồm cả bốn thẻ Aeroplan®,
 * là cụm từ khoá đáng giá nhất của site. Trang bài viết đã trỏ thẳng sang ba
 * bài liên quan và trang tài khoản đã trỏ thẳng sang thẻ cùng ngân hàng; chỉ
 * trang thẻ là không trỏ sang thẻ nào.
 *
 * Lấy theo VÒNG chứ không phải ba thẻ đầu bảng: đứng ở thẻ nào thì lấy các thẻ
 * ĐỨNG SAU nó trong thứ tự của site, hết danh sách thì vòng lại đầu. Lý do là
 * số học chứ không phải thẩm mỹ — nếu mọi trang đều liệt kê ba thẻ đầu, thì
 * trong một hệ điểm có sáu thẻ, ba thẻ xếp cuối vẫn không có một link nội bộ
 * nào trỏ vào và bài toán ban đầu vẫn còn nguyên với chúng (đã đo: hai thẻ TD®
 * Aeroplan® rơi đúng vào cảnh đó ở bản vá đầu). Vòng thì mỗi thẻ trong hệ được
 * đúng `limit` trang khác trỏ vào, không thẻ nào lọt.
 *
 * Thứ tự nguồn vẫn là thứ tự của `offers`, tức thứ tự `getCreditCardOffers()`
 * đã xếp (elevated trước, rồi Amex, rồi phần còn lại) — nên đứng ở thẻ cuối
 * danh sách, vòng lại chính là ba thẻ site đang muốn đẩy nhất.
 */
export function siblingCardsInProgram(
  offer: CreditCardOffer,
  offers: CreditCardOffer[],
  limit = 3,
): CreditCardOffer[] {
  const programId = programIdFor(offer);
  if (!programId) return [];

  const family = offers.filter((other) => programIdFor(other) === programId);
  return ringAfter(family, (other) => other.slug === offer.slug, limit);
}

/**
 * Tài khoản ngân hàng do chính ngân hàng phát hành thẻ này mở — chiều ngược
 * của `cardsFromBank` bên `bank-next-steps.ts`.
 *
 * Bên tài khoản đã có khối "thẻ tín dụng của ngân hàng này" từ đầu, còn bên
 * thẻ thì không có đường nào sang mục tài khoản — nên hai mục lớn nhất của
 * site nối với nhau bằng đúng một chiều. Đây là chiều còn thiếu, và nó cũng là
 * đường duy nhất có thật dẫn tới trang tài khoản của National Bank®: ngân hàng
 * đó có đúng một tài khoản trên site, nên không có "tài khoản anh em" nào trỏ
 * vào nó được.
 *
 * So `issuer` bằng `slugifyVi` chứ không so chuỗi thẳng, cùng lý do đã ghi ở
 * `cardsFromBank`: `issuer` là chữ tự do trong Contentful, sửa "RBC®" thành
 * "RBC" ở đó là một phép so chính xác sẽ đứt lặng.
 *
 * Trả về cả `bank` chứ không chỉ danh sách tài khoản, và người gọi PHẢI lấy
 * nhãn từ `bank.name` — đừng in `offer.issuer` ra tiêu đề. `slugifyVi` xoá dấu
 * câu và ký hiệu, nên một `issuer` gõ thành "RBC®!" hay "rbc " vẫn khớp đúng
 * ngân hàng (điều mình muốn) nhưng in ra tiêu đề thì thành chuỗi hỏng.
 * `BANKS[].name` là dạng chuẩn của site, đã mang sẵn ®/™ đúng như
 * `audit:trademarks` đòi. Khối tương ứng bên trang tài khoản cũng lấy nhãn từ
 * `bank.name`, nên hai chiều gọi tên ngân hàng giống hệt nhau.
 */
export function bankAccountsFromIssuer(
  offer: CreditCardOffer,
  accounts: BankAccount[],
  limit = 3,
): { bank: Bank; accounts: BankAccount[] } | null {
  const issuerKey = slugifyVi(offer.issuer);
  if (!issuerKey) return null;

  const bank = BANKS.find((candidate) => slugifyVi(candidate.name) === issuerKey);
  if (!bank) return null;

  const matches = accounts.filter((account) => account.bank === bank.id).slice(0, limit);
  return matches.length ? { bank, accounts: matches } : null;
}

/**
 * Bài viết nói về đúng thẻ này hoặc đúng hệ điểm của nó.
 *
 * Chỉ so trên tiêu đề, mô tả ngắn và chuyên mục — KHÔNG so trên thân bài. Thân
 * bài nhắc tên ngân hàng ở mọi chỗ ("mở thẻ TD® nào cũng…"), nên so ở đó thì
 * mỗi thẻ TD® kéo về cùng một mớ bài chẳng liên quan. Thà không có bài nào còn
 * hơn có ba bài sai — đúng nguyên tắc "trung thực hơn là đầy đủ".
 *
 * Điểm: tên thẻ khớp trọn là 3, tên chương trình điểm là 2, mình tên ngân hàng
 * thì 1 và KHÔNG đủ để hiện ra. Nói cách khác chỉ hai vế đầu mới dẫn tới bài;
 * ngân hàng chỉ dùng để xếp thứ tự giữa những bài đã đủ điều kiện.
 */
export function relatedPostsForCard(
  offer: CreditCardOffer,
  posts: BlogPost[],
  offers: CreditCardOffer[],
  limit = 3,
): BlogPost[] {
  const cardKey = slugifyVi(offer.name);
  const issuerKey = slugifyVi(offer.issuer);
  const programId = programIdFor(offer);
  const programName = programId
    ? getCardPointsPrograms(offers).find((p) => p.id === programId)?.name
    : undefined;
  const programKey = programName ? slugifyVi(programName) : undefined;

  const scored = posts
    .map((post) => {
      const haystack = slugifyVi(`${post.title} ${post.excerpt} ${post.category}`);
      let score = 0;
      if (cardKey && haystack.includes(cardKey)) score += 3;
      if (programKey && haystack.includes(programKey)) score += 2;
      if (issuerKey && haystack.includes(issuerKey)) score += 1;
      return { post, score };
    })
    .filter((entry) => entry.score >= 2);

  // So bằng mốc thời gian, KHÔNG so chuỗi. Bài tác giả viết tay mang offset
  // (`-04:00`) còn bài video do `sync-videos` tạo mang `Z`, nên
  // `2026-08-02T23:00-04:00` xảy ra SAU `2026-08-03T02:00Z` mà so chuỗi lại
  // xếp nó trước. Cùng cái bẫy `latestModified` đã vấp ở sitemap.
  const at = (post: BlogPost) => new Date(post.publishedAt).getTime() || 0;
  scored.sort((a, b) => b.score - a.score || at(b.post) - at(a.post));

  return scored.slice(0, limit).map((entry) => entry.post);
}
