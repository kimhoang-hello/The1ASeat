import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { HotelCard } from "@/components/hotels/hotel-card";
import { HotelFilterGrid, type HotelFacet } from "@/components/hotels/hotel-filter-grid";
import { HotelSearchWidget } from "@/components/hotels/hotel-search-widget";
import { getPostsWithin } from "@/lib/content";
import { categoryPath, slugifyVi } from "@/lib/blog-categories";
import { HOTELS_PUBLISHED } from "@/lib/feature-flags";
import {
  HOTELS_BASE,
  HOTEL_CATEGORIES,
  HOTEL_CHAINS,
  getFeaturedHotels,
  getHotels,
  hotelPath,
  plainName,
  type Hotel,
} from "@/lib/hotels";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const h = translate("hotels");
const seo = translate("seo");

/** Hạn chờ danh sách bài viết — dữ liệu phụ của trang này, xem `getPostsWithin`. */
const POSTS_BUDGET_MS = 8_000;

/** Chuyên mục blog chứa các bài review khách sạn — đích của link "Đọc tất cả review". */
const HOTEL_CATEGORY = "Khách sạn";

export const metadata: Metadata = {
  ...pageMetadata({
    title: seo("hotelsTitle"),
    description: seo("hotelsDescription"),
    path: HOTELS_BASE,
  }),
  // Cùng luật với mọi mục chưa công bố (`feature-flags.ts`).
  ...(HOTELS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

// Dữ liệu khách sạn nằm trong repo, nhưng trang còn đọc danh sách bài viết từ
// Contentful để chỉ dựng link tới bài đang publish. Thiếu dòng này thì Next
// giao cho CDN một `s-maxage` một năm — bẫy đã ghi ở `/award-flight-finder`.
export const revalidate = 3600;

/** Các lựa chọn của một nhóm lọc, theo thứ tự xuất hiện đầu tiên trong dữ liệu. */
function options(hotels: Hotel[], pick: (hotel: Hotel) => { value: string; label: string }) {
  const seen = new Map<string, string>();
  for (const hotel of hotels) {
    const { value, label } = pick(hotel);
    if (!seen.has(value)) seen.set(value, label);
  }
  return [...seen].map(([value, label]) => ({ value, label }));
}

export default async function HotelsPage() {
  const hotels = getHotels();
  const featured = getFeaturedHotels();

  // Danh sách bài chỉ để quyết định link nào được hiện; Contentful nấc hay
  // treo thì các link đó biến mất, còn danh sách khách sạn vẫn đủ — xem
  // `getPostsWithin`.
  const posts = await getPostsWithin(POSTS_BUDGET_MS, "hotels");
  const postSlugs = new Set(posts.map((post) => post.slug));
  const hasLiveReview = (hotel: Hotel) => Boolean(hotel.reviewSlug && postSlugs.has(hotel.reviewSlug));
  const hasHotelCategory = posts.some((post) => slugifyVi(post.category) === slugifyVi(HOTEL_CATEGORY));
  const reviewsHref = categoryPath(slugifyVi(HOTEL_CATEGORY));

  const facets: HotelFacet[] = [
    {
      key: "destination",
      label: h("filterDestination"),
      options: options(hotels, (hotel) => ({ value: hotel.city, label: hotel.city })),
    },
    {
      key: "chain",
      label: h("filterChain"),
      options: options(hotels, (hotel) => ({ value: hotel.chain, label: HOTEL_CHAINS[hotel.chain].label })),
    },
    {
      key: "category",
      label: h("filterCategory"),
      options: options(hotels, (hotel) => ({ value: hotel.category, label: HOTEL_CATEGORIES[hotel.category] })),
    },
  ];

  const programPosts = Object.values(HOTEL_CHAINS).filter(
    (chain) => chain.programPostSlug && postSlugs.has(chain.programPostSlug),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbHotels"), path: HOTELS_BASE }]),
      // Chỉ url + name, cùng quyết định với các trang danh sách khác
      // (AGENTS.md, SEO 22/09/2026): không giá, không đánh giá sao.
      {
        "@type": "ItemList",
        name: h("itemListName"),
        itemListElement: hotels.map((hotel, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: plainName(hotel.name),
          url: absoluteUrl(hotelPath(hotel.slug)),
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader title={h("title")} subtitle={h("subtitle")} />

      {/* Padding NGOÀI `max-w-page`, như `/us-credit-cards`: mép trái thân
          trang trùng mép trái tiêu đề của `PageHeader`. Đặt padding bên trong
          thì mọi thứ dưới tiêu đề thụt vào thêm 32px. */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page">
          {!HOTELS_PUBLISHED && (
            <p className="mb-6 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
              {h("draftNotice")}
            </p>
          )}

          {hasHotelCategory && (
            <Link
              href={reviewsHref}
              className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              {h("reviewsLink")} <span aria-hidden>&nbsp;&rarr;</span>
            </Link>
          )}

          {featured.length > 0 && (
            <section aria-labelledby="hotels-featured">
              <h2 id="hotels-featured" className="font-display text-xl font-bold text-foreground">
                {h("featuredHeading")}
              </h2>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((hotel, index) => (
                  <li key={hotel.slug}>
                    {/* Ảnh của thẻ ĐẦU TIÊN là LCP của trang — cùng luật `preload`
                        với `PostCard` ở `/blog`. */}
                    <HotelCard
                      hotel={hotel}
                      hasReview={hasLiveReview(hotel)}
                      summary
                      preload={index === 0}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <HotelSearchWidget heading={h("searchWidgetHeading")} className="mt-12" />

          <section aria-labelledby="hotels-all" className="mt-12">
            <h2 id="hotels-all" className="mb-4 font-display text-xl font-bold text-foreground">
              {h("allHeading")}
            </h2>
            <HotelFilterGrid
              items={hotels.map((hotel) => ({
                slug: hotel.slug,
                values: { destination: hotel.city, chain: hotel.chain, category: hotel.category },
                card: <HotelCard hotel={hotel} hasReview={hasLiveReview(hotel)} listOnMobile />,
              }))}
              facets={facets}
              labels={{
                filter: h("filterButton"),
                all: h("filterAll"),
                resultCount: h("resultCount"),
                empty: h("empty"),
                emptyCta: h("emptyCta"),
              }}
            />
          </section>

          <NextSteps title={h("nextStepsTitle")} className="mt-12 max-w-3xl border-t border-border pt-8">
            {hasHotelCategory && (
              <StepLink href={reviewsHref} label={h("reviewsLabel")} description={h("reviewsDescription")} />
            )}
            {programPosts.map((chain) => (
              <StepLink
                key={chain.programPostSlug}
                href={`/blog/${chain.programPostSlug}`}
                label={h("programLabel", { program: chain.program })}
                description={h("programDescription")}
              />
            ))}
          </NextSteps>
        </div>
      </section>
    </>
  );
}
