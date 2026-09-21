import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { UsCardSummary } from "@/components/credit-cards/us-card-summary";
import { US_CARDS_PUBLISHED } from "@/lib/feature-flags";
import {
  US_CARDS_BASE,
  US_CARDS_LIST_ANCHOR,
  US_CARD_FILTERS,
  US_ISSUERS,
  getUsCreditCards,
  matchesUsCardFilter,
  usCardFilter,
  usCardPath,
  usCardsListPath,
  usIssuerId,
  type UsCardFilter,
} from "@/lib/us-credit-cards";
import { usCardsGuideHref } from "@/lib/us-cards-guide";
import { creditCardJsonLd } from "@/lib/credit-card-schema";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const us = t("usCards");
const seo = t("seo");

export const metadata: Metadata = {
  ...pageMetadata({
    title: seo("usCardsTitle"),
    description: seo("usCardsDescription"),
    path: US_CARDS_BASE,
  }),
  // Chưa công bố thì không cho Google index — cùng luật với mọi trang nháp
  // khác trong `feature-flags.ts`.
  ...(US_CARDS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

// Dữ liệu thẻ nằm trong repo, nhưng việc bài hướng dẫn đã có hay chưa thì đọc
// từ Contentful — cùng cửa sổ ISR với `/credit-cards`.
export const revalidate = 60;

const FILTER_LABEL_KEYS: Record<UsCardFilter, string> = {
  all: "filterAll",
  travel: "filterTravel",
  airline: "filterAirline",
  hotel: "filterHotel",
  business: "filterBusiness",
};

/** Cùng cỡ chữ tiêu đề mục như các khu trên trang chủ. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">{children}</h2>
  );
}

export default async function UsCreditCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; issuer?: string }>;
}) {
  const [{ type, issuer }, guideHref] = await Promise.all([searchParams, usCardsGuideHref()]);
  const cards = getUsCreditCards();

  const featured = cards.filter((card) => card.us.featured).slice(0, 3);

  const activeFilter = usCardFilter(type);
  const filterCards = cards.filter((card) => matchesUsCardFilter(card, activeFilter));

  // Chip ngân hàng đếm TRONG loại thẻ đang chọn, như hàng chip điểm thưởng ở
  // `/credit-cards`: chip nào hiện ra cũng dẫn tới một danh sách có thẻ, và một
  // `?issuer=` không còn thẻ nào trong loại này thì rơi về danh sách của loại
  // đó thay vì một danh sách rỗng.
  const issuerChips = US_ISSUERS.map((item) => ({
    ...item,
    count: filterCards.filter((card) => card.us.issuerId === item.id).length,
  })).filter((item) => item.count > 0);
  const requestedIssuer = usIssuerId(issuer);
  const activeIssuer = issuerChips.some((item) => item.id === requestedIssuer)
    ? requestedIssuer
    : undefined;
  const listCards = activeIssuer
    ? filterCards.filter((card) => card.us.issuerId === activeIssuer)
    : filterCards;

  // Ô ngân hàng đếm trên TOÀN BỘ thẻ, không theo bộ lọc bên dưới: đây là lối
  // vào, nên con số phải nói ngân hàng đó có bao nhiêu thẻ trên site.
  const issuerTiles = US_ISSUERS.map((item) => ({
    ...item,
    count: cards.filter((card) => card.us.issuerId === item.id).length,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbUsCards"), path: US_CARDS_BASE }]),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl(US_CARDS_BASE)}#collection`,
        name: seo("usCardsTitle"),
        description: seo("usCardsDescription"),
        url: absoluteUrl(US_CARDS_BASE),
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: cards.length,
          itemListElement: cards.map((card, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(usCardPath(card.slug)),
            item: creditCardJsonLd(card),
          })),
        },
      },
    ],
  };

  const chip = (isActive: boolean) =>
    `inline-block cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
      isActive
        ? "border-primary bg-primary/10 font-semibold text-primary"
        : "border-border text-foreground/70 hover:border-primary hover:text-primary"
    }`;

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={us("eyebrow")} title={us("title")} subtitle={us("subtitle")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page">
          {!US_CARDS_PUBLISHED && (
            <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {us("draftNotice")}
            </p>
          )}

          {/* Lối vào cho người mới — cùng hình dạng với dải "Gợi ý thẻ" đầu
              trang `/credit-cards`: một dòng, không phải một khối nội dung.
              Trang này để tìm thẻ; phần kiến thức chỉ cần một cửa. */}
          {guideHref && (
            <Link
              href={guideHref}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary"
            >
              <span>
                <span className="block font-display font-bold text-foreground">
                  {us("beginnerTitle")}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {us("beginnerBody")}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-primary">
                {us("beginnerCta")} &rarr;
              </span>
            </Link>
          )}

          {featured.length > 0 && (
            <div className="mt-12">
              <SectionHeading>{us("featuredTitle")}</SectionHeading>
              {/* Ba cột từ `lg` với thẻ dựng đứng; bố cục ngang của danh sách
                  cần ~36rem mỗi thẻ nên chỉ vừa hai cột. */}
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {featured.map((card) => (
                  <UsCardSummary key={card.slug} card={card} stacked />
                ))}
              </div>
            </div>
          )}

          <div className="mt-14">
            <SectionHeading>{us("issuersTitle")}</SectionHeading>
            {/* Hai cột trên điện thoại, không phải một hàng cuộn ngang: sáu
                ngân hàng nằm gọn trong ba hàng và không ô nào bị khuất. */}
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {issuerTiles.map((item) => (
                <li key={item.id}>
                  {item.count > 0 ? (
                    <Link
                      href={usCardsListPath({ issuer: item.id })}
                      aria-current={item.id === activeIssuer ? "true" : undefined}
                      className={`flex h-full flex-col rounded-2xl border bg-card px-4 py-4 transition-colors hover:border-primary ${
                        item.id === activeIssuer ? "border-primary" : "border-border"
                      }`}
                    >
                      <span className="wrap-anywhere font-display font-bold text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-1 text-sm text-muted-foreground">
                        {us("issuerCount", { count: item.count })} &rarr;
                      </span>
                    </Link>
                  ) : (
                    <div className="flex h-full flex-col rounded-2xl border border-border bg-card px-4 py-4 opacity-60">
                      <span className="wrap-anywhere font-display font-bold text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-1 text-sm text-muted-foreground">{us("issuerEmpty")}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* `scroll-mt`: mọi link lọc nhảy về `#tat-ca-the-my`, và thanh điều
              hướng dính trên cùng sẽ che mất tiêu đề mục nếu thiếu nó. */}
          <div id={US_CARDS_LIST_ANCHOR} className="mt-14 scroll-mt-36">
            <SectionHeading>{us("allTitle")}</SectionHeading>

            {/* Cùng hai tầng lọc như `/credit-cards`: viên pill đặc cho loại
                thẻ, chip viền có số đếm cho ngân hàng. */}
            <nav aria-label={us("filterLabel")} className="mt-6 flex flex-wrap gap-2">
              {US_CARD_FILTERS.map((filter) => (
                <Link
                  key={filter}
                  href={usCardsListPath({ filter, issuer: activeIssuer })}
                  aria-current={activeFilter === filter ? "true" : undefined}
                  className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {us(FILTER_LABEL_KEYS[filter])}
                </Link>
              ))}
            </nav>

            {issuerChips.length > 1 && (
              <nav aria-label={us("issuerLabel")} className="mt-4">
                <ul className="flex flex-wrap items-center gap-2">
                  <li className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {us("issuerLabel")}
                  </li>
                  <li>
                    <Link
                      href={usCardsListPath({ filter: activeFilter })}
                      aria-current={activeIssuer ? undefined : "true"}
                      className={chip(!activeIssuer)}
                    >
                      {us("issuerAll")}
                      <span className="ml-1 text-xs text-muted-foreground">{filterCards.length}</span>
                    </Link>
                  </li>
                  {issuerChips.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={usCardsListPath({ filter: activeFilter, issuer: item.id })}
                        aria-current={item.id === activeIssuer ? "true" : undefined}
                        className={chip(item.id === activeIssuer)}
                      >
                        {item.name}
                        <span className="ml-1 text-xs text-muted-foreground">{item.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="mt-8 grid gap-5 xl:grid-cols-2">
              {listCards.map((card) => (
                <UsCardSummary key={card.slug} card={card} />
              ))}

              {listCards.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center xl:col-span-2">
                  <p className="text-sm text-muted-foreground">{us("empty")}</p>
                  <Link
                    href={usCardsListPath({})}
                    className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    {us("emptyCta")} &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Đặt SAU danh sách: người tới trang này trước hết để tìm thẻ. Ai
              xem xong mà chưa biết bắt đầu từ đâu thì gặp khối này đúng lúc. */}
          {guideHref && (
            <div className="mt-14 rounded-2xl border border-border bg-secondary p-6 sm:p-8">
              <SectionHeading>{us("newcomerTitle")}</SectionHeading>
              <p className="mt-3 max-w-2xl leading-relaxed text-foreground/90">{us("newcomerBody")}</p>

              <ol className="mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {(["journeyCanada", "journeyItin", "journeyFirstCard", "journeyCredit"] as const).map(
                  (key, index) => (
                    <li key={key} className="flex items-center gap-2">
                      {index > 0 && (
                        <span aria-hidden className="text-muted-foreground">
                          &rarr;
                        </span>
                      )}
                      <span className="rounded-full border border-border bg-card px-3 py-1.5">
                        {us(key)}
                      </span>
                    </li>
                  ),
                )}
              </ol>

              <Link
                href={guideHref}
                className="mt-6 inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                {us("newcomerCta")} &rarr;
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
