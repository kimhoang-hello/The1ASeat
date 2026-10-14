import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/blog/post-card";
import { HotelBooking } from "@/components/hotels/hotel-booking";
import { HotelVideo } from "@/components/hotels/hotel-video";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { getPostsWithin } from "@/lib/content";
import { HOTELS_PUBLISHED } from "@/lib/feature-flags";
import {
  HOTELS_BASE,
  HOTEL_CATEGORIES,
  HOTEL_CHAINS,
  getHotels,
  hotelBySlug,
  hotelLocationLabel,
  hotelPath,
  plainName,
  type Hotel,
} from "@/lib/hotels";
import { ringAfter } from "@/lib/ring";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { t as translate } from "@/lib/t";
import { getYouTubeVideoId } from "@/lib/video-embed";

const h = translate("hotels");
const seo = translate("seo");

export function generateStaticParams() {
  return getHotels().map((hotel) => ({ slug: hotel.slug }));
}

// KHÔNG đặt `dynamicParams = false`: trên trang có `revalidate`, Next 16 dựng
// lại các trang đó thành 404 rồi cache bản 404 sau mỗi lần webhook gọi
// `revalidatePath("/", "layout")` — sự cố 30/09/2026 của thẻ Mỹ (AGENTS.md).
// Slug lạ và khách sạn nháp vẫn 404 nhờ `notFound()` bên dưới.
//
// Dữ liệu khách sạn nằm trong repo; Contentful chỉ cho bài review (tiêu đề,
// ảnh, ngày). Thiếu `revalidate` thì CDN giữ HTML tới một năm.
export const revalidate = 3600;

/** Hạn chờ danh sách bài viết — dữ liệu phụ của trang này, xem `getPostsWithin`. */
const POSTS_BUDGET_MS = 8_000;

function coverUrl(hotel: Hotel): string | undefined {
  const src = hotel.coverImage?.src;
  if (!src) return undefined;
  return src.startsWith("/") ? absoluteUrl(src) : src;
}

/** Mô tả tìm kiếm: bản viết tay, không có thì đoạn giới thiệu đầu cắt ở ~160 ký tự. */
function metaDescription(hotel: Hotel): string {
  if (hotel.seoDescription) return hotel.seoDescription;
  const first = hotel.description[0] ?? hotel.name;
  return first.length <= 160 ? first : `${first.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const hotel = hotelBySlug(slug);
  if (!hotel) return {};

  return {
    ...pageMetadata({
      title: hotel.seoTitle ?? `${hotel.name}: review và cách đặt phòng`,
      description: metaDescription(hotel),
      path: hotelPath(hotel.slug),
      image: coverUrl(hotel),
    }),
    ...(HOTELS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function HotelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = hotelBySlug(slug);
  if (!hotel) notFound();

  // Bài review là dữ liệu PHỤ: Contentful nấc hay treo thì trang khách sạn vẫn
  // hiện đủ phần của nó, chỉ mất thẻ bài review và link sang blog — có hạn chờ,
  // xem `getPostsWithin`.
  const posts = await getPostsWithin(POSTS_BUDGET_MS, `hotels/${slug}`);
  // Chỉ dẫn tới bài ĐANG publish — bài bị gỡ thì link biến mất cùng nó, không
  // để lại một đường dẫn 404 trên trang.
  const review = hotel.reviewSlug ? posts.find((post) => post.slug === hotel.reviewSlug) : undefined;
  const reviewHref = review ? `/blog/${review.slug}` : undefined;
  const videoId = hotel.youtubeUrl ? getYouTubeVideoId(hotel.youtubeUrl) : null;

  const chain = HOTEL_CHAINS[hotel.chain];
  const programPost =
    chain.programPostSlug && posts.some((post) => post.slug === chain.programPostSlug)
      ? chain.programPostSlug
      : undefined;
  // Vòng chứ không phải "hai khách sạn đầu danh sách" — cùng lý do với
  // `ringAfter` ở trang thẻ: khách sạn nào cũng có anh em trỏ vào.
  const siblings = ringAfter(getHotels(), (other) => other.slug === hotel.slug, 2);

  const path = hotelPath(hotel.slug);
  const url = absoluteUrl(path);
  const cover = hotel.coverImage;
  const image = coverUrl(hotel);

  // `Hotel` chỉ mang thứ đã kiểm được: tên, địa chỉ cấp thành phố, ảnh,
  // thương hiệu, trang chính thức. KHÔNG `aggregateRating`, `starRating`,
  // `priceRange` hay `review` — site không có số liệu thật cho chúng, và dữ
  // liệu có cấu trúc bịa là thứ spec cấm.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbHotels"), path: HOTELS_BASE },
        { name: plainName(hotel.name), path },
      ]),
      {
        "@type": "Hotel",
        "@id": `${url}#hotel`,
        name: plainName(hotel.name),
        address: { "@type": "PostalAddress", addressLocality: hotel.city, addressCountry: hotel.country },
        brand: { "@type": "Brand", name: plainName(hotel.brand) },
        mainEntityOfPage: url,
        ...(image && { image: [image] }),
        ...(hotel.directBookingUrl && { url: hotel.directBookingUrl }),
        ...(review && {
          subjectOf: {
            "@type": "BlogPosting",
            headline: review.title,
            url: absoluteUrl(`/blog/${review.slug}`),
          },
        }),
      },
    ],
  };

  const facts: { label: string; value: string }[] = [
    { label: h("factLocation"), value: hotel.location },
    ...(hotel.roomTypeReviewed ? [{ label: h("factRoom"), value: hotel.roomTypeReviewed }] : []),
    ...(hotel.booked ? [{ label: h("factBooked"), value: hotel.booked }] : []),
    { label: h("factProgram"), value: chain.program },
  ];

  return (
    /* Cùng khung với trang thẻ: 42rem dưới `xl`, 68rem từ `xl` với cột phải
       dính. Khác trang thẻ ở chỗ cột dính nằm bên PHẢI và ảnh bìa lớn đứng đầu
       cột trái — với khách sạn, tấm ảnh là thứ người đọc muốn thấy trước.

       Khung đặt phòng có ba bản, mỗi bản một `placement`: `hotel_detail_top`
       (gọn, ngay dưới giới thiệu, dưới `xl`), `hotel_detail_end` (đầy đủ, cuối
       trang, dưới `xl` — người đọc xem xong video là lúc muốn đặt nhất) và
       `hotel_detail_rail` (đầy đủ, cột phải dính, từ `xl`). Ở mỗi bề ngang
       chỉ hai bản trên hoặc một bản dưới hiện ra. */
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 xl:max-w-[68rem]">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ label: seo("breadcrumbHotels"), href: HOTELS_BASE }]} />

      {!HOTELS_PUBLISHED && (
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          {h("draftNotice")}
        </p>
      )}

      <header className="mt-4">
        <h1 className="text-balance font-display text-3xl font-bold text-foreground sm:text-4xl">{hotel.name}</h1>
        <p className="mt-3 text-base text-muted-foreground">
          {hotelLocationLabel(hotel)} <span aria-hidden>&middot;</span> {hotel.brand}{" "}
          <span aria-hidden>&middot;</span> {HOTEL_CATEGORIES[hotel.category]}
        </p>
      </header>

      {/* Từ `xl`: ảnh bìa nằm trong cột TRÁI, khung đặt phòng đứng cạnh ngay từ
          đỉnh ảnh. Bản đầu để ảnh chạy hết bề ngang phía trên lưới: ở 1280×800
          ảnh cao 576px đẩy khung đặt phòng xuống 1,019px — màn đầu trên desktop
          không có nút đặt phòng nào (audit UX 14/10/2026). Dưới `xl` không có
          cột phải nên thứ tự đọc không đổi. */}
      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        <div className="min-w-0">
          {cover && (
            <figure>
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
                {/* `sizes` theo bề rộng THẬT của khung ở từng khoảng: từ `xl`
                    ảnh nằm trong cột trái (68rem − cột phải 20rem − khe 3rem −
                    lề 4rem = 41rem), dưới `xl` chạy hết khung 42rem. */}
                <Image
                  src={cover.src}
                  alt={cover.alt}
                  fill
                  preload
                  sizes="(min-width: 1280px) 41rem, (min-width: 1024px) 704px, (min-width: 768px) 720px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)"
                  className="object-cover"
                />
              </div>
              {cover.credit && (
                <figcaption className="mt-2 text-xs text-muted-foreground">{cover.credit}</figcaption>
              )}
            </figure>
          )}

          <div className={`space-y-4 text-lg leading-relaxed text-foreground/90 ${cover ? "mt-8" : ""}`}>
            {hotel.description.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>

          <HotelBooking hotel={hotel} placement="hotel_detail_top" compact className="mt-6 xl:hidden" />

          <section aria-labelledby="trai-nghiem" className="mt-10">
            <h2 id="trai-nghiem" className="font-display text-xl font-bold text-foreground">
              {h("factsHeading")}
            </h2>
            <dl className="mt-3 divide-y divide-border border-y border-border">
              {facts.map((fact) => (
                <div key={fact.label} className="grid gap-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-sm font-semibold text-foreground">{fact.label}</dt>
                  <dd className="text-sm leading-relaxed text-foreground/90">{fact.value}</dd>
                </div>
              ))}
              {hotel.amenities.length > 0 && (
                <div className="grid gap-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-sm font-semibold text-foreground">{h("factAmenities")}</dt>
                  <dd className="text-sm leading-relaxed text-foreground/90">
                    <ul className="space-y-1">
                      {hotel.amenities.map((amenity) => (
                        <li key={amenity}>{amenity}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
            {hotel.booked && (
              <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">{h("pointsNote")}</p>
            )}
          </section>

          {hotel.highlights.length > 0 && (
            <section aria-labelledby="dieu-minh-thich" className="mt-10">
              <h2 id="dieu-minh-thich" className="font-display text-xl font-bold text-foreground">
                {h("highlightsHeading")}
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-foreground/90">
                {hotel.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {hotel.notes.length > 0 && (
            <section aria-labelledby="can-biet-truoc" className="mt-10">
              <h2 id="can-biet-truoc" className="font-display text-xl font-bold text-foreground">
                {h("notesHeading")}
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-foreground/90">
                {hotel.notes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {videoId && (
            <section aria-labelledby="video-review" className="mt-10">
              <h2 id="video-review" className="font-display text-xl font-bold text-foreground">
                {h("videoHeading")}
              </h2>
              <div className="mt-4">
                <HotelVideo
                  videoId={videoId}
                  title={plainName(hotel.name)}
                  playLabel={h("playVideo", { title: plainName(hotel.name) })}
                />
              </div>
            </section>
          )}

          {review && (
            <section aria-labelledby="bai-review" className="mt-10">
              <h2 id="bai-review" className="font-display text-xl font-bold text-foreground">
                {h("reviewHeading")}
              </h2>
              <div className="mt-4 max-w-md">
                <PostCard post={review} headingLevel="h3" />
              </div>
            </section>
          )}

          {hotel.galleryImages.length > 0 && (
            <section aria-labelledby="hinh-anh" className="mt-10">
              <h2 id="hinh-anh" className="font-display text-xl font-bold text-foreground">
                {h("galleryHeading")}
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {hotel.galleryImages.map((photo) => (
                  <li
                    key={photo.src}
                    className="relative overflow-hidden rounded-xl bg-muted"
                    style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(min-width: 1280px) 14rem, (min-width: 640px) 30vw, 46vw"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
              {reviewHref && (
                <Link
                  href={reviewHref}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                >
                  {h("galleryMore")} <span aria-hidden>&nbsp;&rarr;</span>
                </Link>
              )}
            </section>
          )}

          <HotelBooking
            hotel={hotel}
            placement="hotel_detail_end"
            reviewHref={reviewHref}
            className="mt-10 xl:hidden"
          />

          <NextSteps title={h("siblingsTitle")} className="mt-12 border-t border-border pt-8">
            {siblings.map((sibling) => (
              <StepLink
                key={sibling.slug}
                href={hotelPath(sibling.slug)}
                label={sibling.name}
                description={`${hotelLocationLabel(sibling)} · ${sibling.brand}`}
              />
            ))}
            {(hotel.relatedLinks ?? []).map((link) => (
              <StepLink key={link.href} href={link.href} label={link.label} description={link.description} />
            ))}
            {programPost && (
              <StepLink
                href={`/blog/${programPost}`}
                label={h("programLabel", { program: chain.program })}
                description={h("programDescription")}
              />
            )}
            <StepLink
              href={HOTELS_BASE}
              label={h("allHotelsLabel")}
              description={h("allHotelsDescription", { count: getHotels().length })}
            />
          </NextSteps>
        </div>

        <aside className="hidden xl:block">
          <HotelBooking
            hotel={hotel}
            placement="hotel_detail_rail"
            reviewHref={reviewHref}
            className="xl:tall:sticky xl:tall:top-chrome"
          />
        </aside>
      </div>
    </article>
  );
}
