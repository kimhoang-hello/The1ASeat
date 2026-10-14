"use client";

import { sendGAEvent } from "@next/third-parties/google";

/**
 * Link affiliate đặt phòng, và là chỗ DUY NHẤT bắn `hotel_affiliate_click`.
 *
 * VÌ SAO KHÔNG DÙNG LẠI `apply_clicked`: event đó là key event "Apply ngay" —
 * thước đo doanh thu THẺ trong PRODUCT.md, và task GA4 hằng tuần đọc thẳng nó.
 * Gộp click đặt phòng vào đó là làm lệch con số thẻ. Event riêng thì hai nguồn
 * doanh thu tách bạch từ đầu.
 *
 * Tham số (không có dữ liệu cá nhân nào):
 *  - `hotel_id`, `hotel_slug`: `hotel_id` giữ nguyên khi đổi slug, để chuỗi số
 *    liệu không đứt.
 *  - `partner`: "expedia", "agoda"…
 *  - `placement`: bề mặt phát ra click (`hotel_detail_top`, `hotel_detail_rail`,
 *    `hotel_detail_end`…) — mỗi chỗ đặt nút một tên, cùng luật với
 *    `card_detail_rail`/`card_detail_top` bên trang thẻ.
 *
 * KHÔNG gửi `page_path` dù spec gợi ý: đó là tên tham số DÀNH RIÊNG của gtag.
 * Đã đọc request `g/collect` thật 14/10/2026 (build với GA ID giả): nó không
 * đi thành `ep.page_path` mà bị đổi thành `dp=` — tức ghi đè đường dẫn trang
 * của chính hit đó. Cùng họ với vụ `tracking_id` ghi đè measurement ID
 * (06/09/2026). Trang phát ra click vốn đã có sẵn: GA4 gắn `dl` (page_location)
 * vào MỌI event, nên dimension "Page path" chuẩn trả lời được câu đó.
 *
 * Click không phải booking: số booking và hoa hồng thật nằm ở báo cáo của đối
 * tác. Cùng luật với `ApplyLink`: không chặn điều hướng, không `await`.
 */
export function HotelBookingLink({
  href,
  rel,
  hotelId,
  hotelSlug,
  partner,
  placement,
  className,
  children,
}: {
  href: string;
  rel: string;
  hotelId: string;
  hotelSlug: string;
  partner: string;
  placement: string;
  className?: string;
  children: React.ReactNode;
}) {
  const track = () =>
    sendGAEvent("event", "hotel_affiliate_click", {
      hotel_id: hotelId,
      hotel_slug: hotelSlug,
      partner,
      placement,
    });

  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className={className}
      onClick={() => track()}
      // Nút giữa mở tab mới bằng `auxclick`, không phải `click` — cùng lý do
      // với `ApplyLink`. Chuột phải cũng là `auxclick` nên chỉ nhận nút giữa.
      onAuxClick={(event) => {
        if (event.button === 1) track();
      }}
    >
      {children}
    </a>
  );
}
