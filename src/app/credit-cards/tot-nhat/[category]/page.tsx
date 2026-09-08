import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { BestCardPickSection } from "@/components/credit-cards/best-card-pick";
import { getCreditCardOffers } from "@/lib/content";
import {
  BEST_CARDS_BASE,
  BEST_CARDS_CATEGORIES,
  assertBestCardPicksExist,
  bestCardsCategoryBySlug,
  bestCardsPath,
  pickHeading,
  pickOffers,
} from "@/lib/best-cards";
import { ringAfter } from "@/lib/card-next-steps";
import { creditCardJsonLd } from "@/lib/credit-card-schema";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const best = translate("bestCards");
const seo = translate("seo");
const common = translate("common");

export async function generateStaticParams() {
  // Chạy lúc `next build`, nên một slug thẻ gõ sai trong `best-cards.ts` làm
  // deploy đỏ ngay thay vì làm một mục biên tập lặng lẽ mất thẻ trên
  // production. Cùng chỗ đặt và cùng lý do với `assertNoSlugClash` bên trang
  // chi tiết thẻ.
  assertBestCardPicksExist(await getCreditCardOffers());
  return BEST_CARDS_CATEGORIES.map((category) => ({ category: category.slug }));
}

// Mọi con số trên trang đến từ Contentful lúc render — cùng cửa sổ ISR với
// `/credit-cards`, nếu không thì một trang "thẻ tốt nhất" sẽ quảng cáo welcome
// bonus của tháng trước.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = bestCardsCategoryBySlug(slug);
  if (!category) return {};

  return pageMetadata({
    title: category.titleVi,
    description: category.metaDescriptionVi,
    path: bestCardsPath(category.slug),
  });
}

export default async function BestCardsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = bestCardsCategoryBySlug(slug);
  if (!category) notFound();

  const offers = await getCreditCardOffers();
  const path = bestCardsPath(category.slug);

  // Mục mà thẻ của nó đã rụng hết khỏi Contentful thì không render ra một
  // tiêu đề trống — `assertBestCardPicksExist` chặn ca này lúc build, đây là
  // lưới thứ hai cho lúc entry bị unpublish tay giữa hai lượt revalidate.
  const sections = category.picks
    .map((pick) => ({ pick, cards: pickOffers(pick, offers) }))
    .filter(({ cards }) => cards.length > 0);

  // Không còn mục nào dựng được thì trang này không còn là trang.
  //
  // Đoạn mở đầu và đoạn kết vẫn render được, nhưng đoạn kết GỌI TÊN và nhắc
  // CON SỐ của chính những thẻ vừa bị loại ("RBC® Avion® 70,000 điểm là offer
  // mình sẽ nhìn đầu tiên") — một trang chỉ còn hai khối chữ nói về những tấm
  // thẻ không hiện ở đâu cả thì tệ hơn 404. Chỉ xảy ra khi mọi thẻ của mọi
  // pick cùng rơi khỏi Contentful giữa hai lượt revalidate.
  if (sections.length === 0) notFound();

  // Vòng, không phải "ba mục đầu": với bốn mục thì lấy ba mục đầu sẽ để mục
  // thứ tư không có một link nội bộ nào ngoài trang tổng trỏ vào. Cùng lý do
  // đã ghi ở `siblingCardsInProgram`.
  const siblings = ringAfter(
    BEST_CARDS_CATEGORIES,
    (other) => other.slug === category.slug,
    BEST_CARDS_CATEGORIES.length - 1,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbCreditCards"), path: "/credit-cards" },
        { name: seo("breadcrumbBestCards"), path: BEST_CARDS_BASE },
        { name: category.navTitleVi, path },
      ]),
      {
        "@type": "ItemList",
        name: category.titleVi,
        description: category.metaDescriptionVi,
        // MỌI thẻ trang này vẽ ra, không phải mỗi mục một thẻ: hai mục ghép
        // hai thẻ, nên đếm theo mục thì trang `offers` khai 5 item cho 7 thẻ
        // đang hiển thị và hai thẻ Platinum/Gold biến mất khỏi dữ liệu có cấu
        // trúc. `creditCardJsonLd` là nguồn schema chung của site — dùng lại nó
        // chứ không dựng một hình dạng thứ hai ở đây.
        itemListElement: sections
          .flatMap(({ cards }) => cards)
          .map((card, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(`/credit-cards/${card.slug}`),
            item: creditCardJsonLd(card),
          })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader
        eyebrow={best("eyebrow")}
        title={category.titleVi}
        subtitle={category.subtitleVi}
        width="article"
      />

      {/* Từ `xl`: chữ trái, mục lục dính bên phải — cùng bố cục với
          `/blog/[slug]`, và vì lý do giống hệt. Dưới `xl` không đổi gì.

          Mục lục KHÔNG bị nhân đôi ra hai bản (một cho mobile, một cho
          desktop): nó nằm đúng một chỗ trong DOM, giữa đoạn dẫn và các mục
          thẻ, rồi `xl:row-span-full` kéo nó sang cột phải. Nhân đôi thì hai
          `id="best-toc"` cùng tồn tại, và `aria-labelledby` của cái thứ hai
          lặng lẽ trỏ về cái thứ nhất. */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 xl:max-w-[68rem]">
        <Link
          href={BEST_CARDS_BASE}
          className="text-sm font-semibold text-primary hover:underline"
        >
          &larr; {best("backToHub")}
        </Link>

        {/* `grid-rows` khai TƯỜNG MINH: mục lục span cả hai hàng, và nếu để
            hàng nào cũng `auto` thì trình duyệt kéo giãn hàng đầu tiên cho vừa
            chiều cao mục lục — đo được 434px cho một đoạn dẫn cao 150px, tức
            gần 300px trống giữa đoạn dẫn và mục thẻ đầu tiên. */}
        <div className="xl:grid xl:grid-cols-[minmax(0,44rem)_17rem] xl:grid-rows-[min-content_1fr] xl:gap-x-12">
          <div className="mt-8 space-y-4 leading-relaxed text-foreground/90 xl:col-start-1 xl:self-start">
            {category.introVi.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>

          {/* Mục lục: sáu mục thẻ là quá dài để cuộn tìm, và tiêu đề mỗi mục
            mang sẵn tên thẻ nên danh sách này cũng là câu trả lời nhanh cho
            "trang này nói về những thẻ nào". */}
          {/* Ẩn hẳn khi không còn mục nào dựng được — `pickOffers` bỏ cả pick khi
            thiếu thẻ (xem chú thích của nó), nên về lý thuyết phần thẻ của cả
            trang có thể rỗng. Một khung "Trong trang này" trống thì tệ hơn là
            không có khung. */}
          {sections.length > 0 && (
            <div className="mt-8 xl:col-start-2 xl:row-span-full">
              <nav
                aria-labelledby="best-toc"
                className="rounded-xl border border-border bg-secondary p-4 xl:sticky xl:top-24"
              >
                <p
                  id="best-toc"
                  className="text-sm font-semibold text-foreground"
                >
                  {best("inThisPage")}
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {sections.map(({ pick, cards }) => (
                    <li key={pick.slug}>
                      <a
                        href={`#${pick.slug}`}
                        className="text-primary hover:underline"
                      >
                        {pickHeading(
                          pick,
                          cards,
                          category.bonusInHeading ?? false,
                        )}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          )}

          <div className="xl:col-start-1">
            <div className="mt-10 space-y-10">
              {sections.map(({ pick, cards }) => (
                <BestCardPickSection
                  key={pick.slug}
                  pick={pick}
                  cards={cards}
                  bonusInHeading={category.bonusInHeading}
                  placement={`best_cards_${category.slug}`}
                />
              ))}
            </div>

            <section className="mt-10 border-t border-border pt-10">
              <h2 className="font-display text-xl font-bold text-foreground">
                {category.closingHeadingVi}
              </h2>
              <div className="mt-4 space-y-4 leading-relaxed text-foreground/90">
                {category.closingVi.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>

            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              {best("verifiedNote")}
            </p>

            <OfferDisclosure className="mt-4" />

            <NextSteps
              title={best("otherCategories")}
              className="mt-10 border-t border-border pt-8"
            >
              {siblings.map((sibling) => (
                <StepLink
                  key={sibling.slug}
                  href={bestCardsPath(sibling.slug)}
                  label={sibling.titleVi}
                  description={sibling.metaDescriptionVi}
                />
              ))}
              <StepLink
                href="/credit-cards"
                label={best("allCardsLabel")}
                description={best("allCardsDescription")}
              />
            </NextSteps>
          </div>
        </div>

        <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          <Link href="/" className="underline">
            {common("backHome")}
          </Link>
        </p>
      </div>
    </>
  );
}
