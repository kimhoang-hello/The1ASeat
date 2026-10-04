import type { Metadata } from "next";
import Link from "next/link";
import { getCreditCardOffers } from "@/lib/content";
import { isElevatedLive } from "@/lib/credit-card-state";
import { PageHeader } from "@/components/layout/page-header";
import { CardRow } from "@/components/credit-cards/card-row";
import { Flag } from "@/components/ui/flag";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { FilterPanel } from "@/components/ui/filter-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { BetaBadge } from "@/components/ui/beta-badge";
import { RECOMMENDER_PUBLISHED, US_CARDS_PUBLISHED } from "@/lib/feature-flags";
import { US_CARDS_BASE, getUsCreditCards } from "@/lib/us-credit-cards";
import { RECOMMENDER_PATH } from "@/lib/recommender/path";
import { PointsProgramLinks } from "@/components/credit-cards/points-program-links";
import { CardTags } from "@/components/credit-cards/card-tags";
import { cardTagsFor } from "@/lib/card-tags";
import { todayInSiteZone } from "@/lib/format-date";
import { CardSortSelect } from "@/components/credit-cards/sort-select";
import { BEST_CARDS_BASE } from "@/lib/best-cards";
import {
  creditCardsPath,
  getCardPointsPrograms,
  programIdFor,
} from "@/lib/card-points-programs";
import { CARD_SORT_OPTIONS, cardSortId, sortOffers, type CardSortId } from "@/lib/credit-card-sort";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const offers_t = t("offers");
const common = t("common");
const best = t("bestCards");
const reco = t("recommender");
const usCards = t("usCards");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("creditCardsTitle"),
  description: seo("creditCardsDescription"),
  path: "/credit-cards",
});

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

const TABS = [
  { value: "all", labelKey: "tabAll", emptyKey: "emptyAll" },
  { value: "noi-bat", labelKey: "tabElevated", emptyKey: "emptyElevated" },
  { value: "khac", labelKey: "tabOther", emptyKey: "emptyOther" },
] as const;

export default async function CreditCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; points?: string; sort?: string }>;
}) {
  const [allOffers, { type, points, sort }] = await Promise.all([
    getCreditCardOffers(),
    searchParams,
  ]);

  const activeTab = type === "khac" || type === "noi-bat" ? type : "all";
  const tabOffers = allOffers.filter(
    (offer) =>
      activeTab === "all" ||
      (activeTab === "noi-bat" ? isElevatedLive(offer) : !isElevatedLive(offer)),
  );

  // Counted within the tab, so every chip leads somewhere — and an unknown
  // ?points= value falls back to the unfiltered list rather than an empty one.
  const programs = getCardPointsPrograms(tabOffers);
  const activePoints = programs.some((program) => program.id === points) ? points : undefined;
  const activeSort = cardSortId(sort);
  const today = todayInSiteZone();
  const offers = sortOffers(
    activePoints ? tabOffers.filter((offer) => programIdFor(offer) === activePoints) : tabOffers,
    activeSort,
  );

  // Nhãn dựng sẵn ở server: `CardSortSelect` là Client Component, không nhận
  // được hàm `t` qua ranh giới RSC.
  // Số bộ lọc khác mặc định, in trên nút "Lọc · Sắp xếp" ở điện thoại.
  const activeFilterCount = [
    activeTab !== "all",
    activePoints !== undefined,
    activeSort !== CARD_SORT_OPTIONS[0].id,
  ].filter(Boolean).length;

  const sortLabels = Object.fromEntries(
    CARD_SORT_OPTIONS.map((option) => [option.id, offers_t(option.labelKey)]),
  ) as Record<CardSortId, string>;

  // The ?type= views are filtered slices of the same list and both canonicalise
  // back to /credit-cards, so the ItemList describes every card, not the slice.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbCreditCards"), path: "/credit-cards" }]),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/credit-cards")}#collection`,
        name: seo("creditCardsTitle"),
        description: seo("creditCardsDescription"),
        url: absoluteUrl("/credit-cards"),
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: allOffers.length,
          itemListElement: allOffers.map((offer, index) => ({
            "@type": "ListItem",
            position: index + 1,
            // Trang danh sách = "summary page" theo cách Google hiểu ItemList:
            // mỗi mục chỉ trỏ tới trang riêng, còn schema đầy đủ của thẻ nằm ở
            // trang đó. Lồng cả `item` đầy đủ lẫn `url` là trộn hai kiểu mà
            // Google tách riêng, và trên `/credit-cards` nó chiếm 76KB HTML —
            // 34 bản sao của đúng những gì 34 trang thẻ đã khai (đo 22/09/2026).
            url: absoluteUrl(`/credit-cards/${offer.slug}`),
            name: offer.name,
          })),
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader title={offers_t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        {/* Cửa vào CÔNG CỤ GỢI Ý và phần biên tập, đứng trên bộ lọc — gộp
            thành MỘT dải từ 03/10/2026 (audit UX/UI). Trước đó là hai dải
            đầy đủ tiêu đề + mô tả, cộng lại ~280px trên màn 375px trước khi
            tới bộ lọc. Thứ tự giữ nguyên ý cũ: chưa biết mình cần gì (gợi ý)
            → muốn xem bảng xếp của Ghế 1A (tốt nhất) → đã có danh sách (bộ
            lọc bên dưới). Link cao 44px thật vì trên điện thoại hai link
            xếp chồng sát nhau. */}
        <div className="mx-auto mb-8 flex max-w-page flex-col items-start gap-x-6 rounded-2xl border border-border bg-card px-5 py-2 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="py-2 font-display font-bold text-foreground">{reco("bandTitle")}</p>
          {RECOMMENDER_PUBLISHED && (
            <Link
              href={RECOMMENDER_PATH}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              {reco("bandCta")}
              <BetaBadge />
              <span aria-hidden>&rarr;</span>
            </Link>
          )}
          <Link
            href={BEST_CARDS_BASE}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
          >
            {best("hubTitle")} &rarr;
          </Link>
        </div>

        <FilterPanel
          label={common("filterSort")}
          activeCount={activeFilterCount}
          summary={<p>{offers_t("resultCount", { count: offers.length })}</p>}
          className="mx-auto mb-5 max-w-page"
        >
          {/* `flex-wrap` + `whitespace-nowrap`: không có hai lớp này thì ba viên
              pill bị ép nằm chung một dòng, chữ xuống dòng bên trong và
              `rounded-full` biến chúng thành ba khối tròn cao 76px ở màn 320px.
              Xuống dòng thành hai hàng pill là đúng hình dạng của nó. */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={creditCardsPath({ type: tab.value, points: activePoints, sort: activeSort })}
                aria-current={activeTab === tab.value ? "true" : undefined}
                className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground/70 hover:text-foreground"
                }`}
              >
                {offers_t(tab.labelKey)}
              </Link>
            ))}
          </div>

          <PointsProgramLinks
            programs={programs}
            activeId={activePoints}
            activeType={activeTab}
            activeSort={activeSort}
            totalCount={tabOffers.length}
            className="mt-4"
          />

          {/* Dưới hai hàng lọc — cùng chỗ trang tài khoản ngân hàng đặt nó, nên
              ai đã dùng một trang thì không phải đi tìm ở trang kia. */}
          <CardSortSelect
            value={activeSort}
            label={offers_t("sortLabel")}
            optionLabels={sortLabels}
            className="mt-4 sm:max-w-xs"
          />
        </FilterPanel>

        {/* Hai cột từ `xl`: chỗ rộng dồn vào thẻ thứ hai thay vì thành dòng
            chữ 110 ký tự. */}
        <div className="mx-auto grid max-w-page gap-4 xl:grid-cols-2 xl:gap-5">
          {offers.map((offer) => (
            <CardRow
              key={offer.slug}
              offer={offer}
              href={`/credit-cards/${offer.slug}`}
              placement="card_list"
              detailsLabel={offers_t("viewDetails")}
            >
              <CardTags tags={cardTagsFor(offer.slug, today)} className="mt-3" />
            </CardRow>
          ))}

          {offers.length === 0 && (
            /* Có chữ nhưng trước đây không có đường thoát: người lọc tới một
               tổ hợp rỗng phải tự nghĩ ra cách quay lại danh sách đầy đủ. */
            <div className="rounded-2xl border border-border bg-card p-8 text-center xl:col-span-2">
              <p className="text-sm text-muted-foreground">
                {offers_t(TABS.find((tab) => tab.value === activeTab)!.emptyKey)}
              </p>
              {/* Xoá bộ lọc chứ không xoá tất cả: `/credit-cards` trần sẽ vứt
                  luôn thứ tự người đọc đang chọn — và cả `utm_*` trên URL. */}
              <Link
                href={creditCardsPath({ sort: activeSort })}
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                {offers_t("emptyCta")} &rarr;
              </Link>
            </div>
          )}

          {/* Cửa sang mục Thẻ Mỹ, ĐẶT CUỐI danh sách chứ không cạnh hai dải
              đầu trang: người vào trang này tìm thẻ Canada, còn thẻ Mỹ là bước
              sau. Trước đây mục đó chỉ có cửa từ menu. */}
          {US_CARDS_PUBLISHED && (
            <Link
              href={US_CARDS_BASE}
              className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between sm:gap-3 xl:col-span-2"
            >
              <span>
                <span className="flex items-center gap-[0.35em] font-display font-bold text-foreground">
                  <Flag country="us" />
                  {usCards("bandTitle")}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {usCards("bandBody", { count: getUsCreditCards().length })}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-primary">{usCards("bandCta")} &rarr;</span>
            </Link>
          )}

          <OfferDisclosure className="mt-3 xl:col-span-2" />
        </div>
      </section>
    </>
  );
}
