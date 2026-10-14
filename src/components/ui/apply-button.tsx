import { AFFILIATE_REL, PLAIN_REL } from "@/lib/affiliate-links";
import { ApplyLink } from "@/components/ui/apply-link";
import messages from "../../../messages/vi.json";
import { translator } from "@/lib/t";

const offers = translator(messages.offers);

/**
 * Hình dạng nút chính của site. Tách thành hằng số (14/10/2026) vì nút "Xem giá
 * trên Expedia®" của mục Khách sạn phải trông đúng như nút Apply — cùng một
 * hành động "ra đối tác" — mà đi qua component đo đạc riêng
 * (`HotelBookingLink`), không qua `ApplyLink`.
 *
 * KHÔNG mang thuộc tính `display`: nơi dùng tự đặt (`inline-block` ở đây,
 * `inline-flex` ở nút khách sạn). Hai utility cùng `display` trên một phần tử
 * thì thứ tự trong file CSS quyết định chứ không phải thứ tự trong chuỗi class
 * — cùng cái bẫy đã ghi ở nhãn Beta trên menu.
 */
export const PRIMARY_PILL_CLASS =
  "cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover";

/**
 * The single place the apply link lives: every surface gets the same pill and
 * the same words, so the call to action reads the same on the home page, the
 * card list, a card's own page and the bank-account list.
 *
 * `affiliate` only decides the `rel`. Most bank accounts now go through a
 * FinlyWealth referral link too; the few that have none point straight at the
 * bank and go out as plain `nofollow` — same button either way, because the
 * reader is doing the same thing.
 *
 * `name` (04/10/2026, audit UX/UI): trong một danh sách, 35 nút cùng đọc
 * "Apply ngay" — mở danh sách link của trình đọc màn hình là không biết nút nào
 * ra ngân hàng nào. Tên sản phẩm được nối vào bằng `sr-only`, chữ nhìn thấy giữ
 * nguyên. Trang của chính một sản phẩm thì không cần: tên đã là H1. Mũi tên
 * `aria-hidden` để không bị đọc thành "mũi tên phải".
 */
export function ApplyButton({
  href,
  className = "",
  affiliate = true,
  placement,
  product,
  name,
}: {
  href: string;
  className?: string;
  affiliate?: boolean;
  /** Bề mặt phát ra click. Xem `ApplyLink` — bắt buộc, không có mặc định. */
  placement: string;
  /** Slug thẻ hoặc tài khoản. */
  product: string;
  /** Tên thẻ/tài khoản, chỉ cho trình đọc màn hình — xem ghi chú trên. */
  name?: string;
}) {
  return (
    <ApplyLink
      href={href}
      rel={affiliate ? AFFILIATE_REL : PLAIN_REL}
      placement={placement}
      product={product}
      className={`inline-block ${PRIMARY_PILL_CLASS} ${className}`}
    >
      {offers("applyNow")} <span aria-hidden>&rarr;</span>
      {name && <span className="sr-only"> {name}</span>}
    </ApplyLink>
  );
}
