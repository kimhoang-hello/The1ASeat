import Image from "next/image";
import Link from "next/link";

import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { HOTEL_CATEGORIES, hotelLocationLabel, hotelPath, type Hotel } from "@/lib/hotels";
import { t as translate } from "@/lib/t";

const h = translate("hotels");

/**
 * Thẻ một khách sạn trên `/hotels`. Cùng khung với `PostCard` (viền, nền trắng,
 * bóng chỉ khi rê chuột) để mục Khách sạn đọc như phần còn lại của site, không
 * như một trang OTA: không giá, không sao, không nút "Đặt ngay" — cả thẻ dẫn
 * tới trang khách sạn, nơi có đủ thông tin trước khi người đọc ra đối tác.
 *
 * Ảnh `alt=""`: tên khách sạn nằm ngay dưới trong cùng link — cùng lý do với
 * `PostCard`, có alt thì trình đọc màn hình đọc tên hai lần.
 *
 * `summary` (khối "Ghế 1A chọn"): thêm đoạn giới thiệu đầu tiên, cắt ba dòng.
 *
 * `hasReview` do trang truyền vào, từ danh sách bài ĐANG publish — không suy từ
 * `reviewSlug`: bài review bị gỡ thì nhãn "Review + video" sẽ hứa một thứ trang
 * khách sạn đã không còn hiện (Codex bắt 14/10/2026).
 *
 * `listOnMobile` (lưới "Tất cả khách sạn"): dưới `sm` thẻ thành một DÒNG — ảnh
 * nhỏ bên trái, phân khúc, tên, vị trí — cùng mẫu với `PostCard` ở `/blog`. Đo
 * 14/10/2026 ở 375px: chín thẻ dọc cao 371px mỗi thẻ, trang tổng dài 6,771px
 * (hơn tám màn), danh sách đầy đủ bắt đầu ở 2,082px. Từ `sm` vẫn là thẻ dọc.
 */
export function HotelCard({
  hotel,
  hasReview,
  headingLevel = "h3",
  summary = false,
  preload = false,
  listOnMobile = false,
}: {
  hotel: Hotel;
  /** Bài review chữ của khách sạn có đang publish không. */
  hasReview: boolean;
  headingLevel?: "h2" | "h3";
  summary?: boolean;
  preload?: boolean;
  listOnMobile?: boolean;
}) {
  const Heading = headingLevel;
  const hasVideo = Boolean(hotel.youtubeUrl);
  const kind =
    hasReview && hasVideo
      ? h("badgeReviewVideo")
      : hasReview
        ? h("badgeReview")
        : hasVideo
          ? h("badgeVideo")
          : null;

  return (
    <Link
      href={hotelPath(hotel.slug)}
      className={`group flex h-full cursor-pointer rounded-2xl border border-border bg-card transition-shadow hover:shadow-md ${
        listOnMobile
          ? "items-start gap-3 p-3 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0"
          : "flex-col overflow-hidden"
      }`}
    >
      <div
        className={`relative aspect-[3/2] overflow-hidden bg-muted ${
          listOnMobile ? "w-28 shrink-0 rounded-lg sm:w-full sm:rounded-none" : "w-full"
        }`}
      >
        {hotel.coverImage ? (
          <Image
            src={hotel.coverImage.src}
            alt=""
            fill
            sizes={
              listOnMobile
                ? "(min-width: 1280px) 30vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 112px"
                : "(min-width: 1280px) 30vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, calc(100vw - 2rem)"
            }
            preload={preload}
            className="object-cover"
          />
        ) : (
          // Lớp bọc `absolute`, không truyền `absolute` vào `MediaPlaceholder`:
          // component đó tự mang `relative`, hai utility cùng `position` thì
          // thứ tự trong file CSS quyết định — bẫy đã ghi ở `CardImage`.
          <div className="absolute inset-0">
            <MediaPlaceholder icon="building" tone="navy" className="h-full w-full" />
          </div>
        )}
      </div>
      <div className={`flex flex-1 flex-col ${listOnMobile ? "min-w-0 sm:p-5" : "p-5"}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {HOTEL_CATEGORIES[hotel.category]}
        </span>
        <Heading
          className={`text-pretty font-display text-base font-bold leading-snug text-foreground group-hover:text-primary ${
            listOnMobile ? "mt-1 sm:mt-2" : "mt-2"
          }`}
        >
          {hotel.name}
        </Heading>
        <p className="mt-1 text-sm text-muted-foreground">
          {hotelLocationLabel(hotel)} <span aria-hidden>&middot;</span> {hotel.brand}
        </p>
        {summary && hotel.description[0] && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/80">{hotel.description[0]}</p>
        )}
        {kind && (
          <p className={`mt-auto text-xs text-muted-foreground ${listOnMobile ? "pt-1 sm:pt-4" : "pt-4"}`}>{kind}</p>
        )}
      </div>
    </Link>
  );
}
