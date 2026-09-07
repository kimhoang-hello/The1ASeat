import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { CardImage } from "@/components/credit-cards/card-image";
import { getCreditCardOffers } from "@/lib/content";
import {
  BEST_CARDS_BASE,
  BEST_CARDS_CATEGORIES,
  bestCardsPath,
  pickOffers,
} from "@/lib/best-cards";
import { COMPARE_PATH } from "@/lib/card-compare";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const best = translate("bestCards");
const offers_t = translate("offers");
const seo = translate("seo");
const next = translate("nextSteps");

export const metadata: Metadata = pageMetadata({
  title: seo("bestCardsTitle"),
  description: seo("bestCardsDescription"),
  path: BEST_CARDS_BASE,
});

// Trang đọc danh sách thẻ từ Contentful để lấy ảnh và tên — cùng cửa sổ ISR
// với `/credit-cards`, nếu không thì Next giao cho CDN một `s-maxage` một năm
// và bốn ô này giữ ảnh của offer cũ mãi.
export const revalidate = 60;

export default async function BestCardsHubPage() {
  const offers = await getCreditCardOffers();

  const rows = BEST_CARDS_CATEGORIES.map((category) => {
    // Đếm thẻ THẬT SỰ dựng được, không đếm cấu hình: trang mục bỏ hẳn một pick
    // khi thiếu thẻ (xem `pickOffers`), nên đếm theo `pickSlugs` sẽ hứa "7 thẻ"
    // rồi mở ra thấy 5. Ô này và trang nó dẫn tới phải nói cùng một con số.
    const cards = category.picks.flatMap((pick) => pickOffers(pick, offers));
    // Ba ảnh đầu, đủ để ô nói được nó chứa thẻ nào mà không thành một hàng ảnh
    // tí hon.
    return { category, cards: cards.slice(0, 3), count: cards.length };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbCreditCards"), path: "/credit-cards" },
        { name: seo("breadcrumbBestCards"), path: BEST_CARDS_BASE },
      ]),
      {
        "@type": "ItemList",
        name: seo("bestCardsTitle"),
        itemListElement: BEST_CARDS_CATEGORIES.map((category, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: category.titleVi,
          url: absoluteUrl(bestCardsPath(category.slug)),
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader
        eyebrow={best("eyebrow")}
        title={best("hubTitle")}
        subtitle={best("hubSubtitle")}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/credit-cards" className="text-sm font-semibold text-primary hover:underline">
          &larr; {offers_t("viewAll")}
        </Link>

        <div className="mt-8 space-y-4 leading-relaxed text-foreground/90">
          <p>{best("hubIntro1")}</p>
          <p>{best("hubIntro2")}</p>
        </div>

        <h2 className="mt-10 font-display text-xl font-bold text-foreground">
          {best("hubListHeading")}
        </h2>

        <ul className="mt-4 space-y-4">
          {rows.map(({ category, cards, count }) => (
            <li key={category.slug}>
              <Link
                href={bestCardsPath(category.slug)}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="font-display text-lg font-bold text-foreground">
                    {category.titleVi}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {category.metaDescriptionVi}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-primary">
                    {best("cardCount", { count })} &rarr;
                  </p>
                </div>

                {/* Ảnh thẻ thay cho một dòng liệt kê tên: ở lưới bốn ô, tên
                    thẻ viết đủ dài để nhận ra sẽ chiếm hết chỗ của chính câu
                    mô tả mục. `aria-hidden` vì tên thẻ đã nằm trong trang
                    đích, và ở đây chúng chỉ là hình. */}
                <div className="flex shrink-0 gap-2" aria-hidden>
                  {cards.map((card) => (
                    <CardImage
                      key={card.slug}
                      image={card.cardImage}
                      name=""
                      placeholderIcon={card.image}
                      className="h-14 w-20 rounded-lg"
                      sizes="80px"
                    />
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <OfferDisclosure className="mt-8" />

        <NextSteps title={next("title")} className="mt-10 border-t border-border pt-8">
          <StepLink
            href="/credit-cards"
            label={best("allCardsLabel")}
            description={best("allCardsDescription")}
          />
          <StepLink
            href={COMPARE_PATH}
            label={offers_t("compare")}
            description={next("cardsDescription")}
          />
          <StepLink
            href="/bat-dau"
            label={next("startHereLabel")}
            description={next("startHereDescription")}
          />
        </NextSteps>
      </div>
    </>
  );
}
