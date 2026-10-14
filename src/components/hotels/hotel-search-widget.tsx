import Script from "next/script";

import { HOTEL_SEARCH_WIDGET } from "@/lib/hotels";

/**
 * Chỗ đặt widget tìm khách sạn chính thức của Expedia®. Mặc định trả về
 * `null` — xem `HOTEL_SEARCH_WIDGET` trong `lib/hotels.ts` để biết khi nào và
 * bật thế nào. Component chỉ dựng lại đúng snippet đối tác cấp (một thẻ div
 * mang `data-*` + một thẻ script), không tự vẽ ô nhập nào.
 */
export function HotelSearchWidget({ heading, className = "" }: { heading: string; className?: string }) {
  const config = HOTEL_SEARCH_WIDGET;
  if (!config.enabled) return null;

  return (
    <section className={className}>
      <h2 className="font-display text-xl font-bold text-foreground">{heading}</h2>
      <div className={`mt-4 ${config.containerClass}`} {...config.dataAttributes} />
      <Script src={config.scriptSrc} strategy="lazyOnload" />
    </section>
  );
}
