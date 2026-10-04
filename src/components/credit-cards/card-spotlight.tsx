import { CardRow } from "@/components/credit-cards/card-row";
import type { CreditCardOffer } from "@/lib/content";
import { t as translate } from "@/lib/t";

const offers_t = translate("offers");

/**
 * Một tấm thẻ ở dạng gọn, đặt cạnh chữ của tác giả: ảnh, huy hiệu, bonus +
 * annual fee, rebate, hai đường đi tiếp.
 *
 * Dùng ở HAI chỗ: bốn trang "Các thẻ tốt nhất", và giữa thân bài viết mỗi khi
 * bài nhắc tới một thẻ có trên site. Từ 04/10/2026 (audit UX/UI) nó CHÍNH LÀ
 * dòng thẻ của danh sách (`CardRow`) — trước đó là một bố cục riêng (dải số liệu
 * `OfferStats`, phí đẩy sang mép phải, ~520px một thẻ trên điện thoại), nên
 * người đọc gặp cùng một tấm thẻ ở danh sách và trong bài thì thấy hai kiểu.
 *
 * KHÔNG có headline: ngay cạnh đã là chữ của tác giả nói đúng những điều đó,
 * lặp lại là bắt người đọc đọc hai lần cùng một nội dung. Cái còn lại — ảnh
 * thẻ, con số, huy hiệu hết hạn, nút apply — là thứ đoạn văn không nói được và
 * cũng là thứ phải luôn khớp Contentful.
 *
 * `placement` là bề mặt phát ra click trong GA4, và người gọi truyền vào chứ
 * không cố định ở đây: khối trong bài viết và khối trên trang "tốt nhất" phải
 * đếm riêng, nếu không thì không trả lời được câu "bài viết có ra tiền không".
 * Cờ `data-affiliate-self-tracked` cho `AffiliateClickTracker` nằm ở root của
 * `CardRow`.
 *
 * Link sang trang thẻ mang chữ "Ghế 1A đánh giá" như mọi dòng thẻ Canada — tác
 * giả chốt 04/10/2026 giữ chữ này cho thẻ Canada (thẻ Mỹ, tài khoản và bảng so
 * sánh dùng "Xem chi tiết").
 */
export function CardSpotlight({
  card,
  placement,
  nameAs = "h3",
}: {
  card: CreditCardOffer;
  placement: string;
  /**
   * `h3` trên trang "Các thẻ tốt nhất": thẻ nằm dưới `h2` của từng mục, đúng
   * một bậc. Trong thân bài viết thì KHÔNG phải heading: khối thẻ có thể đứng
   * ngay sau đoạn mở bài, trước mọi `h2`, và một `h3` ở đó nhảy thẳng từ `h1`
   * — đo 22/09/2026 ở hai bài Cobalt và Marriott. Tên thẻ trong bài là chú
   * thích bên lề, không phải một mục của bài.
   */
  nameAs?: "h3" | "p";
}) {
  return (
    <CardRow
      offer={card}
      href={`/credit-cards/${card.slug}`}
      placement={placement}
      detailsLabel={offers_t("editorsTake")}
      heading={nameAs}
      showHeadline={false}
    />
  );
}
