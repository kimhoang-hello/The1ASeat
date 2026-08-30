import type { CreditCardOffer } from "./content";

/**
 * Which reward currency a card earns — the credit card page's answer to the
 * blog's categories. Contentful has no field for this, so it is read off the
 * copy the card already carries; adding a field would mean the user had to
 * remember to fill it in on every new card for the chip row to stay correct.
 *
 * The trade-off is that a card earning a currency no rule below names gets no
 * chip at all and drops out of every points filter, silently. Whenever a card
 * on a new program is added, add its rule here too.
 *
 * Not to be confused with POINTS_PROGRAMS in points-programs.ts, which is the
 * calculator's benchmark valuations (a different, much shorter list).
 */
interface ProgramRule {
  id: string;
  name: string;
  pattern: RegExp;
}

/**
 * Bỏ ký hiệu thương hiệu trước khi đem đi khớp rule.
 *
 * Thay bằng KHOẢNG TRẮNG chứ không xoá hẳn: nội dung trên site viết
 * "TD® Rewards", còn rule là `/td rewards/i` đòi đúng một dấu cách — xoá hẳn
 * thì thành "TDRewards" và cũng trượt y như cũ. Gộp nhiều khoảng trắng lại để
 * "TD® Rewards" và "TD Rewards" cho ra cùng một chuỗi.
 *
 * KHÔNG nới lỏng những rule dựa vào ký hiệu để phân biệt: "Scene+™" thành
 * "Scene+ ", vẫn còn dấu cộng cho `/scene\s*\+/i` đòi, nên "scenery" vẫn không
 * dính.
 */
function withoutTrademarkMarks(text: string): string {
  return text.replace(/[®™*]/g, " ").replace(/\s+/g, " ");
}

/**
 * Matched in the order below. "à la carte" has to come before the cash back
 * rule because National Bank's benefits mention a travel credit in dollars.
 */
const PROGRAM_RULES: ProgramRule[] = [
  { id: "aeroplan", name: "Aeroplan®", pattern: /aeroplan/i },
  { id: "bonvoy", name: "Marriott Bonvoy®", pattern: /bonvoy/i },
  { id: "amex-mr", name: "Amex Membership Rewards®", pattern: /membership rewards|amex mr\b/i },
  { id: "avion", name: "RBC Avion®", pattern: /avion/i },
  { id: "scene-plus", name: "Scene+™", pattern: /scene\s*\+/i },
  { id: "td-rewards", name: "TD Rewards", pattern: /td rewards/i },
  { id: "viporter", name: "VIPorter®", pattern: /viporter/i },
  { id: "mileageplus", name: "United® MileagePlus®", pattern: /mileageplus/i },
  // "WestJet®" rather than "WestJet Rewards®", for the same reason as À la
  // carte™ below.
  { id: "westjet", name: "WestJet®", pattern: /westjet/i },
  // "À la carte™" rather than the program's full "À la carte Rewards" name:
  // the ®/™ audit learns brands by backing up from the symbol through capital
  // words, so the longer form would teach it that a bare "Rewards" is a brand
  // and flag every honest "TD Rewards"/"Promo Rewards" on the site.
  { id: "a-la-carte", name: "À la carte™", pattern: /à la carte/i },
  { id: "cash-back", name: "Cash back", pattern: /hoàn tiền|cash\s?back/i },
];

/**
 * The card's own name and welcome bonus name the currency directly, so they are
 * matched first and on their own. The benefit list is only a fallback: it
 * mentions other programs in passing — an Aeroplan card's benefits talk about
 * Air Canada lounges, a Scene+ card's about dollars back — and matching it
 * first would file cards under the wrong chip.
 */
export function programIdFor(offer: CreditCardOffer): string | undefined {
  const sources = [`${offer.name} ${offer.welcomeBonus ?? ""}`, offer.keyBenefits.join(" ")];

  for (const source of sources) {
    // Cùng phép chuẩn hoá với `programIdsInText`. Tên thẻ và quyền lợi trong
    // Contentful chứa rất nhiều ký hiệu ®/™/*, nên trước đây một thẻ ghi
    // "TD® Rewards" sẽ trượt rule `/td rewards/i` rồi rơi xuống rule sau —
    // mất chip, hoặc tệ hơn là nhận nhầm chip của hệ khác, mà không có gì báo.
    //
    // Áp lên tồn kho hiện tại KHÔNG đổi phân loại của thẻ nào (đã so 23/23
    // trước và sau); đây là lưới an toàn cho nội dung viết sau.
    const hit = PROGRAM_RULES.find((rule) => rule.pattern.test(withoutTrademarkMarks(source)));
    if (hit) return hit.id;
  }
  return undefined;
}

/**
 * MỌI hệ điểm được gọi tên trong một đoạn chữ bất kỳ (tiêu đề bài viết, mô tả
 * ngắn…), theo thứ tự khai báo của `PROGRAM_RULES`.
 *
 * Trả về cả danh sách chứ không phải khớp đầu tiên, vì người gọi còn phải lọc
 * tiếp theo tồn kho thẻ. Bài "Amex Membership Rewards vs RBC Avion" (đã nằm
 * trong kế hoạch nội dung ở SEO.md) gọi tên hai hệ; `amex-mr` đứng trước nhưng
 * hiện KHÔNG có thẻ nào trên site, nên nếu chỉ trả khớp đầu tiên thì bài đó
 * rơi về link chung, dù Avion có thẻ và dẫn được.
 *
 * Dùng chính `PROGRAM_RULES` chứ không so trên chuỗi đã `slugifyVi`. Slug hoá
 * xoá mất ký hiệu, mà với vài chương trình thì ký hiệu CHÍNH LÀ tên:
 * `slugifyVi("Scene+™")` ra đúng chữ `scene`, nên một bài tựa đề "Behind the
 * scenes" hay "Scenery…" bị gán nhầm cho Scene+™. Regex `/scene\s*\+/i` đòi
 * dấu cộng nên không dính.
 *
 * Ký hiệu ™/®/* được thay bằng khoảng trắng TRƯỚC khi khớp: nội dung trên site
 * viết "TD® Rewards", còn rule là `/td rewards/i` đòi đúng một dấu cách nên sẽ
 * trượt. Thay bằng khoảng trắng chứ không xoá hẳn — xoá hẳn thì "TD®Rewards"
 * dính thành "TDRewards" và cũng trượt. Việc này KHÔNG nới lỏng bẫy Scene+ ở
 * trên: "Scene+™" thành "Scene+ ", vẫn còn dấu cộng để regex đòi.
 *
 * `programIdFor` cố ý KHÔNG dùng chuẩn hoá này: đầu vào của nó là các trường
 * của thẻ, và chip lọc dựng từ đó là mặt đã rà kỹ — nới rộng phép khớp ở đó có
 * thể xếp lại chip của những thẻ đang đúng, đổi lấy một ca chưa xảy ra.
 */
export function programIdsInText(text: string): string[] {
  const cleaned = withoutTrademarkMarks(text);
  return PROGRAM_RULES.filter((rule) => rule.pattern.test(cleaned)).map((rule) => rule.id);
}

export interface CardPointsProgram {
  id: string;
  name: string;
  count: number;
}

/**
 * Every program with at least one card in `offers`, most cards first. Callers
 * pass the list the chips will actually filter, so a chip can never advertise a
 * count that clicking it does not deliver.
 */
export function getCardPointsPrograms(offers: CreditCardOffer[]): CardPointsProgram[] {
  const counts = new Map<string, number>();

  for (const offer of offers) {
    const id = programIdFor(offer);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return PROGRAM_RULES.filter((rule) => counts.has(rule.id))
    .map((rule) => ({ id: rule.id, name: rule.name, count: counts.get(rule.id)! }))
    .sort((a, b) => b.count - a.count);
}

/** The credit card page's URL for a given combination of its two filters. */
export function creditCardsPath({ type, points }: { type?: string; points?: string }): string {
  const params = new URLSearchParams();
  if (type && type !== "all") params.set("type", type);
  if (points) params.set("points", points);

  const query = params.toString();
  return query ? `/credit-cards?${query}` : "/credit-cards";
}
