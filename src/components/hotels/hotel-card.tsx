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
 */
export function HotelCard({
  hotel,
  headingLevel = "h3",
  summary = false,
  preload = false,
  sizes = "(min-width: 1280px) 30vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, calc(100vw - 2rem)",
}: {
  hotel: Hotel;
  headingLevel?: "h2" | "h3";
  summary?: boolean;
  preload?: boolean;
  sizes?: string;
}) {
  const Heading = headingLevel;
  const kind = hotel.reviewSlug
    ? hotel.youtubeUrl
      ? h("badgeReviewVideo")
      : h("badgeReview")
    : h("badgeVideo");

  return (
    <Link
      href={hotelPath(hotel.slug)}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
        {hotel.coverImage ? (
          <Image
            src={hotel.coverImage.src}
            alt=""
            fill
            sizes={sizes}
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
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {HOTEL_CATEGORIES[hotel.category]}
        </span>
        <Heading className="mt-2 text-pretty font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
          {hotel.name}
        </Heading>
        <p className="mt-1 text-sm text-muted-foreground">
          {hotelLocationLabel(hotel)} <span aria-hidden>&middot;</span> {hotel.brand}
        </p>
        {summary && hotel.description[0] && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/80">{hotel.description[0]}</p>
        )}
        <p className="mt-auto pt-4 text-xs text-muted-foreground">{kind}</p>
      </div>
    </Link>
  );
}
