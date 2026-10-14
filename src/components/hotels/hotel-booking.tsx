import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";

import { HotelBookingLink } from "@/components/hotels/hotel-booking-link";
import { PRIMARY_PILL_CLASS } from "@/components/ui/apply-button";
import { AFFILIATE_REL, EDITORIAL_REL } from "@/lib/affiliate-links";
import { HOTEL_CHAINS, HOTEL_PARTNERS, enabledAffiliateLinks, type Hotel } from "@/lib/hotels";
import { t as translate } from "@/lib/t";

const h = translate("hotels");

/**
 * Khung "Đặt phòng" — chỗ chuyển đổi chính của trang khách sạn.
 *
 * Thứ tự cố định: link đối tác (affiliate, nút chính) → đặt trực tiếp (nút
 * viền) → review đầy đủ (link chữ). Mỗi nút gọi đích danh nơi nó dẫn tới, và
 * không câu nào hứa đối tác rẻ hơn hay có điểm thưởng: câu `loyaltyNote` nói
 * ĐIỀU NGƯỢC LẠI, vì người đọc site này là người chơi điểm — đặt qua OTA thường
 * mất điểm và quyền lợi hạng, và họ cần biết trước khi bấm.
 *
 * `compact` là bản đặt ngay dưới phần giới thiệu trên màn dưới `xl`: chỉ nút
 * và câu công bố, không tiêu đề — bản đầy đủ đứng cuối trang, nên hai khung
 * cùng hiện trên điện thoại không thành hai tiêu đề "Đặt phòng" trùng nhau.
 *
 * Disclosure đứng ngay dưới nút affiliate, ở MỌI bản có nút đó.
 */
export function HotelBooking({
  hotel,
  placement,
  reviewHref,
  compact = false,
  className = "",
}: {
  hotel: Hotel;
  /** Tên bề mặt cho GA4 — mỗi chỗ đặt khung một tên. */
  placement: string;
  /** Bài review chữ đang publish, nếu có. */
  reviewHref?: string;
  compact?: boolean;
  className?: string;
}) {
  const affiliateLinks = enabledAffiliateLinks(hotel);
  const program = HOTEL_CHAINS[hotel.chain].program;
  const direct = hotel.directBookingUrl;

  if (affiliateLinks.length === 0 && !direct && !reviewHref) return null;
  // Bản gọn chỉ có ý nghĩa khi có nút đặt phòng; chỉ còn link review thì để
  // bản đầy đủ cuối trang lo.
  if (compact && affiliateLinks.length === 0 && !direct) return null;

  const firstPartner = affiliateLinks[0] ? HOTEL_PARTNERS[affiliateLinks[0].partner].name : null;

  const buttons = (
    <div className="flex flex-col gap-3">
      {affiliateLinks.map((link) => (
        <HotelBookingLink
          key={`${link.partner}-${link.url}`}
          href={link.url}
          rel={AFFILIATE_REL}
          hotelId={hotel.id}
          hotelSlug={hotel.slug}
          partner={link.partner}
          placement={placement}
          className={`${PRIMARY_PILL_CLASS} inline-flex w-full items-center justify-center gap-1.5 text-center`}
        >
          {link.label ?? h("bookOn", { partner: HOTEL_PARTNERS[link.partner].name })}
          <ArrowUpRight size={16} weight="bold" aria-hidden />
        </HotelBookingLink>
      ))}
      {direct && (
        <a
          href={direct}
          target="_blank"
          rel={EDITORIAL_REL}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card px-6 py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:border-primary"
        >
          {h("bookDirect")}
          <ArrowUpRight size={16} weight="bold" aria-hidden />
        </a>
      )}
    </div>
  );

  const disclosure =
    affiliateLinks.length > 0 ? (
      <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{h("disclosure")}</p>
    ) : null;

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        {buttons}
        {disclosure}
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-bold text-foreground">{h("bookingHeading")}</h2>
      <div className="mt-4">{buttons}</div>
      {reviewHref && (
        <Link
          href={reviewHref}
          className="mt-2 flex min-h-11 items-center justify-center text-sm font-semibold text-primary hover:underline"
        >
          {h("readReview")} <span aria-hidden>&nbsp;&rarr;</span>
        </Link>
      )}
      <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>{h("noPrices")}</p>
        {firstPartner ? (
          <p>{h("loyaltyNote", { partner: firstPartner, program })}</p>
        ) : (
          direct && <p>{h("directNote", { program })}</p>
        )}
        {disclosure}
      </div>
    </section>
  );
}
