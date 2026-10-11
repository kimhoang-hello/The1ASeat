/**
 * Nối một click Apply trên trang thẻ về trang Gợi ý thẻ.
 *
 * Người đọc thấy gợi ý, bấm "Đọc kỹ về thẻ này" / "Xem thẻ", đọc trang thẻ rồi
 * mới bấm Apply ở đó — click đó mang `placement=card_detail` và GA4 không cho
 * biết nó bắt đầu từ trang gợi ý (Explorations bị chặn, `page_referrer` của
 * điều hướng phía client không đổi). Đánh dấu slug trong `sessionStorage` lúc
 * rời trang gợi ý, và `ApplyLink` gắn `via: "recommender"` khi người đọc apply
 * ĐÚNG thẻ đó trong cùng phiên tab (GA4 10/10/2026).
 *
 * Chỉ slug thẻ công khai, không có gì về người dùng. Mọi truy cập bọc try/catch:
 * có trình duyệt chặn `sessionStorage`, và đo hụt thì không được làm gãy click.
 */

const KEY = "g1a_reco_via";

/** Một danh sách, không phải một slug: mở A rồi B từ trang gợi ý, Back về A và apply thì A vẫn tính (Codex, 10/10/2026). */
const MAX_CARDS = 20;

function marked(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((row): row is string => typeof row === "string") : [];
  } catch {
    return [];
  }
}

export function markRecommenderCard(product: string): void {
  try {
    const next = [...marked().filter((row) => row !== product), product].slice(-MAX_CARDS);
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Không nhớ được thì click Apply sau đó chỉ thiếu `via`.
  }
}

export function cameFromRecommender(product: string): boolean {
  return marked().includes(product);
}
