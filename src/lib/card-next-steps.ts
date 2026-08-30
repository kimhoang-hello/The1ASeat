import { slugifyVi } from "./blog-categories";
import { PROGRAMS } from "./award-charts";
import { getCardPointsPrograms, programIdFor, creditCardsPath } from "./card-points-programs";
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
