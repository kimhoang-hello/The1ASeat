import { slugifyVi } from "./blog-categories";
import type { BlogPost, CreditCardOffer } from "./content/types";

/**
 * Bài viết nhắc tới thẻ nào, và nhắc ở ĐOẠN NÀO.
 *
 * Khác `cardsMentionedInPost` bên `post-next-steps.ts`: hàm đó trả về danh
 * sách thẻ để dựng khối link ở CUỐI bài, nên chỉ cần biết "có nhắc hay không".
 * Hàm này quyết định chỗ chèn một khối thẻ vào GIỮA thân bài, nên phải biết
 * đoạn số mấy.
 *
 * VÌ SAO PHẢI CÓ BẢNG TÊN RÚT GỌN. `cardsMentionedInPost` so bằng TRỌN tên
 * thẻ, và chú thích của nó ghi lại một phép đo: 1/36 bài khớp. Đo lại ngày
 * 07/09/2026 trên 40 bài và 34 thẻ: 3 bài. Lý do không đổi — Contentful lưu
 * "American Express Cobalt® Card" còn người viết gõ "Cobalt". Thêm bảng dưới
 * đây, đo lại: 5 bài, 7 cặp bài–thẻ.
 *
 * Chú thích của hàm kia còn ghi rằng đã thử CHUẨN HOÁ tự động ("american
 * express" → "amex", bỏ đuôi "-card") và thêm đúng 0 bài — đừng làm lại lớp
 * đó. Bảng này là thứ khác: nó không đoán ra tên rút gọn theo luật, nó ghi ra
 * từng cái tên người viết THẬT SỰ đã gõ, đo được từ chính thân bài. Thẻ không
 * có mục ở đây vẫn khớp bằng trọn tên như cũ — thiếu bí danh làm khối thẻ
 * không hiện, chứ không làm hiện nhầm thẻ.
 *
 * LUẬT CHỌN BÍ DANH: chỉ nhận cái tên mà **chỉ Canada mới có**.
 *
 * Không phải luật cho đẹp — nó sinh ra từ một false positive đo được ngày
 * 07/09/2026. Bí danh `"amex gold"` khớp đúng câu này trong bài "3 thứ không
 * thể thiếu khi du lịch nước ngoài":
 *
 *   "Nếu có US credit card thì options khá nhiều như Amex Gold, Chase
 *    Sapphire Preferred, Chase Ink Preferred, hay Capital One Venture X."
 *
 * Câu đó nói về thẻ MỸ. Khối thẻ hiện ra lại là American Express® Gold Rewards
 * Card của Canada, kèm nút Apply đi thẳng tới link affiliate Canada — dựng một
 * CTA cho đúng sản phẩm mà câu văn KHÔNG nói tới. Trên một trang ra tiền thì
 * đó tệ hơn nhiều so với không có khối nào.
 *
 * Nên: thẻ nào có bản Mỹ nổi tiếng trùng tên rút gọn — Amex® Gold, Amex®
 * Platinum, Amex® Green, các thẻ Marriott Bonvoy® — KHÔNG được cấp bí danh
 * ngắn. Chúng chỉ khớp khi bài viết trọn tên theo cách Contentful lưu, và đó
 * là cái giá đúng để trả: bỏ sót một khối thì không ai thiệt, gắn nhầm thẻ thì
 * có.
 *
 * Bí danh cũng phải đủ hẹp để không trùng thẻ khác trong chính Canada: "gold"
 * trần sẽ dính cả Amex® Gold, Aventura® Gold và Scotiabank® Gold.
 */
const ALIASES: Record<string, string[]> = {
  // Chỉ có ở Canada — không thẻ Mỹ nào mang những tên này.
  "amex-cobalt": ["cobalt"],
  "amex-aeroplan-reserve": ["aeroplan reserve"],
  "rbc-avion-visa-infinite": ["avion visa infinite"],
  "rbc-avion-visa-platinum": ["avion visa platinum"],
  "td-first-class-travel-visa-infinite": ["first class travel"],
  "td-aeroplan-visa-infinite": ["td aeroplan visa infinite"],
  "cibc-aventura-gold-visa": ["aventura gold"],
  "cibc-aeroplan-visa": ["cibc aeroplan visa"],
  "scotiabank-passport-visa-infinite": ["scotiabank passport", "passport visa infinite"],
  "scotiabank-gold-amex": ["scotiabank gold american express", "scotia gold amex"],
  "wealthsimple-visa-infinite-privilege": ["wealthsimple visa infinite privilege"],
  // "gold rewards card" là tên Canada; "amex gold" thì KHÔNG nằm ở đây — xem
  // false positive đã ghi bên trên.
  "amex-gold-rewards": ["gold rewards card"],
  // amex-platinum, amex-green, amex-marriott-bonvoy, amex-marriott-bonvoy-business
  // cố ý KHÔNG có bí danh: cả bốn đều có bản Mỹ trùng tên rút gọn.
};

/** Thân bài là HTML; tên thẻ nằm trong chữ chứ không nằm trong thẻ đánh dấu. */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

/** Mọi chuỗi dùng để nhận ra một thẻ: trọn tên, cộng bí danh nếu có. */
function keysFor(offer: CreditCardOffer): string[] {
  const full = slugifyVi(offer.name);
  const aliases = (ALIASES[offer.slug] ?? []).map(slugifyVi);
  return [full, ...aliases].filter((key) => key.length > 0);
}

export interface CardMention {
  card: CreditCardOffer;
  /** Chèn khối thẻ NGAY SAU khối này trong `post.bodyBlocks`. */
  afterBlock: number;
}

/**
 * Thẻ được nhắc trong thân bài, kèm chỗ chèn khối — nhiều nhất `limit` thẻ,
 * mỗi thẻ đúng MỘT lần, ở lần nhắc ĐẦU TIÊN.
 *
 * Lần đầu chứ không phải mọi lần: một bài review thẻ nhắc tên nó hai chục lần,
 * và hai chục khối thẻ giống hệt nhau thì không còn là thông tin nữa. Cũng vì
 * vậy mà có `limit` — bài "101" điểm danh sáu thẻ sẽ biến thành catalogue nếu
 * không chặn.
 *
 * Thẻ mang tên là khúc đầu của tên thẻ khác bị loại, cùng luật với
 * `cardsMentionedInPost`: bài nói về "RBC® Avion® Visa Infinite Privilege"
 * đương nhiên cũng chứa chuỗi "RBC® Avion® Visa Infinite".
 */
export function cardMentionsInPost(
  post: BlogPost,
  offers: CreditCardOffer[],
  limit = 3,
): CardMention[] {
  const blocks = post.bodyBlocks.map((block) => slugifyVi(stripTags(block)));

  const found = offers
    .map((offer) => {
      const keys = keysFor(offer);
      // Khối đầu tiên chứa BẤT KỲ cách gọi nào của thẻ này.
      const at = blocks.findIndex((block) => keys.some((key) => block.includes(key)));
      // `longest` chỉ để so bao hàm giữa các thẻ, nên lấy chuỗi dài nhất khớp
      // được — tên đầy đủ khi bài viết trọn tên, bí danh khi không.
      const longest = keys.slice().sort((a, b) => b.length - a.length)[0] ?? "";
      return { offer, at, longest };
    })
    .filter((entry) => entry.at >= 0)
    // Tên dài trước, để vòng lọc dưới giữ tên đầy đủ và bỏ tên bị bao trong nó.
    .sort((a, b) => b.longest.length - a.longest.length);

  const kept: typeof found = [];
  for (const entry of found) {
    if (kept.some((other) => other.longest.includes(entry.longest))) continue;
    kept.push(entry);
  }

  // Theo THỨ TỰ XUẤT HIỆN trong bài, không theo độ dài tên: khối thẻ chèn vào
  // giữa thân bài, nên thứ tự phải là thứ tự người đọc gặp chúng.
  return kept
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map((entry) => ({ card: entry.offer, afterBlock: entry.at }));
}

/** Thẻ trên site chưa có bí danh nào — `audit:card-mentions` in ra để người
 *  viết biết bài nhắc tên rút gọn của nó sẽ không hiện khối thẻ. */
export function cardsWithoutAliases(offers: CreditCardOffer[]): CreditCardOffer[] {
  return offers.filter((offer) => (ALIASES[offer.slug] ?? []).length === 0);
}

/** Bí danh trỏ tới slug không còn tồn tại — bảng chết dần theo thời gian nếu
 *  không có gì canh. */
export function orphanAliasSlugs(offers: CreditCardOffer[]): string[] {
  const known = new Set(offers.map((offer) => offer.slug));
  return Object.keys(ALIASES).filter((slug) => !known.has(slug));
}
