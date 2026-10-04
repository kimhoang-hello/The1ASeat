import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { EditorsTake } from "@/components/credit-cards/editors-take";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { CardTags } from "@/components/credit-cards/card-tags";
import { CanadianPerspective } from "@/components/credit-cards/canadian-perspective";
import { UsCardsBetaNotice } from "@/components/credit-cards/us-beta-notice";
import { ApplyButton } from "@/components/ui/apply-button";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { JsonLd } from "@/components/seo/json-ld";
import { isReferralUrl } from "@/lib/affiliate-links";
import { creditCardJsonLd, creditCardMetaDescription } from "@/lib/credit-card-schema";
import { US_CARDS_PUBLISHED } from "@/lib/feature-flags";
import { formatDate } from "@/lib/format-date";
import {
  US_CARDS_BASE,
  getUsCreditCards,
  spendRequirement,
  usCardPath,
  usCardSiblings,
} from "@/lib/us-credit-cards";
import { usCardsGuideHref } from "@/lib/us-cards-guide";
import { t as translate } from "@/lib/t";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

const offers = translate("offers");
const us = translate("usCards");
const common = translate("common");
const seo = translate("seo");

export const revalidate = 60;

/** Nhãn của từng nhóm lọc, cùng chữ với viên pill trên trang tổng. */
const FILTER_LABEL_KEYS = {
  travel: "filterTravel",
  airline: "filterAirline",
  hotel: "filterHotel",
  cashback: "filterCashback",
  business: "filterBusiness",
} as const;

// Chỉ những thẻ `getUsCreditCards()` cho hiện. Thẻ ẩn, thẻ còn số liệu mẫu hay
// slug lạ đều 404 nhờ `notFound()` trong trang — KHÔNG dùng
// `dynamicParams = false`. Đo 30/09/2026 trên Next 16.3: route có cờ đó, sau
// `revalidatePath("/", "layout")` (webhook Contentful gọi ở MỌI lần publish),
// dựng lại cả 33 trang thành 404 và cache luôn bản 404 — mục Thẻ Mỹ chết sạch
// tới lần deploy sau, còn trang danh sách vẫn sống nên không ai thấy.
export function generateStaticParams() {
  return getUsCreditCards().map((card) => ({ slug: card.slug }));
}

function findCard(slug: string) {
  return getUsCreditCards().find((card) => card.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = findCard(slug);
  if (!card) return {};

  return {
    ...pageMetadata({
      title: card.name,
      description: creditCardMetaDescription(card),
      path: usCardPath(card.slug),
      image: card.cardImage || undefined,
    }),
    ...(US_CARDS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
  };
}

/**
 * Trang của một thẻ Mỹ. Bố cục chép đúng trang thẻ Canada
 * (`/credit-cards/[slug]`): hai cột từ `xl` với ảnh thẻ và nút Apply dính bên
 * trái, một cột dưới đó, thứ tự DOM giữ nguyên để trên điện thoại tên thẻ luôn
 * đứng trước nút bấm. Xem chú thích dài ở trang đó cho từng quyết định.
 *
 * Khác trang Canada ở đúng những chỗ thẻ Mỹ cần:
 * - dòng "Điều kiện" với số USD dưới dải số liệu;
 * - khối "Góc nhìn từ Canada" sau quyền lợi chính, TRƯỚC nút Apply — người
 *   Canada cần đọc chuyện ITIN và US address trước khi sang trang ngân hàng;
 * - không có `OfferHistoryNote` và `CardNextSteps`: hai khối đó đọc lịch sử
 *   offer và danh sách thẻ Canada, không có nghĩa gì với thẻ Mỹ.
 *
 * `placement` mang tiền tố `us_` để GA4 tách được click thẻ Mỹ khỏi thẻ Canada
 * mà không phải lọc theo từng slug.
 */
export default async function UsCreditCardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = findCard(slug);
  if (!card) notFound();

  const guideHref = await usCardsGuideHref();
  const requirement = spendRequirement(card);
  const { sameCurrency, filter, sameFilter } = usCardSiblings(card, getUsCreditCards());

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbUsCards"), path: US_CARDS_BASE },
        { name: card.name, path: usCardPath(card.slug) },
      ]),
      creditCardJsonLd(card),
    ],
  };

  return (
    <>
      {/* Dải Beta chạy hết bề ngang nên phải đứng NGOÀI `article`, như trang tổng. */}
      <UsCardsBetaNotice />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 xl:max-w-[68rem]">
        <JsonLd data={jsonLd} />
        <Breadcrumbs items={[{ label: seo("breadcrumbUsCards"), href: US_CARDS_BASE }]} />

        <div className="xl:grid xl:grid-cols-[22rem_minmax(0,1fr)] xl:gap-12">
          <div className="mt-6 xl:self-start xl:tall:sticky xl:tall:top-chrome">
            <CardImage
              image={card.cardImage}
              name={card.name}
              placeholderIcon={card.image}
              className="h-56 w-full rounded-2xl"
              {...applyOverlay(card.applyUrl, "us_card_detail", card.slug)}
              preload
            />

            {card.applyUrl && (
              <div className="mt-6 hidden xl:block">
                <ApplyButton
                  href={card.applyUrl}
                  affiliate={isReferralUrl(card.applyUrl)}
                  placement="us_card_detail_rail"
                  product={card.slug}
                  className="w-full text-center"
                />
                {isReferralUrl(card.applyUrl) && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {offers("applyAffiliateNote")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="mt-6">
              <CardBadges
                offer={card}
                cardType={card.cardType}
                elevatedBonusLabel={offers("elevatedBonus")}
                expiresOnLabel={offers("expiresOn")}
              />
            </div>

            <h1 className="mt-2 wrap-anywhere font-display text-3xl font-bold text-foreground">
              {card.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.issuer} · {us("rewardsCurrency")}: {card.us.rewardsCurrency}
            </p>

            <OfferStats offer={card} className="mt-4" />
            {requirement && (
              <p className="mt-3 text-sm text-foreground/90">
                <span className="font-semibold text-foreground">{us("requirementLabel")}:</span>{" "}
                {requirement}
              </p>
            )}

            {/* Nút Apply sớm dưới `xl`, sau khối bonus + điều kiện chi — cùng
                lý do và cùng luật với `card_detail_top` ở trang thẻ Canada
                (`credit-cards/[slug]/page.tsx`). */}
            {card.applyUrl && (
              <div className="mt-5 xl:hidden">
                <ApplyButton
                  href={card.applyUrl}
                  affiliate={isReferralUrl(card.applyUrl)}
                  placement="us_card_detail_top"
                  product={card.slug}
                  className="w-full text-center sm:w-auto"
                />
                {isReferralUrl(card.applyUrl) && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {offers("applyAffiliateNote")}
                  </p>
                )}
              </div>
            )}

            <p className="mt-4 text-lg leading-relaxed text-foreground/90">{card.headline}</p>

            <CardTags tags={card.us.tags} className="mt-4" />

            <EditorsTake editorsTake={card.editorsTake} className="mt-6" />

            <h2 className="mt-8 font-display text-xl font-bold text-foreground">
              {offers("keyBenefits")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
              {card.keyBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>

            <CanadianPerspective perspective={card.us.canada} guideHref={guideHref} className="mt-8" />

            {card.applyUrl && (
              <ApplyButton
                href={card.applyUrl}
                affiliate={isReferralUrl(card.applyUrl)}
                className="mt-8"
                placement="us_card_detail"
                product={card.slug}
              />
            )}

            <p
              className={`mt-4 text-xs ${
                card.us.needsVerification ? "font-medium text-warning" : "text-muted-foreground"
              }`}
            >
              {card.us.verifiedOn
                ? us("verifiedOn", { date: formatDate(card.us.verifiedOn) })
                : us("sampleNote", { date: formatDate(card.us.lastUpdated) })}
            </p>

            <OfferDisclosure className="mt-8" />

            {/* Đặt SAU nút apply và phần công bố như trang thẻ Canada: đường đi
                tiếp cho người chưa quyết. Link THẲNG sang từng thẻ, không phải
                link lọc — xem `usCardSiblings`. */}
            {sameCurrency.length > 0 && (
              <NextSteps
                title={us("siblingsCurrencyTitle", { currency: card.us.rewardsCurrency })}
                compact
                className="mt-12"
              >
                {sameCurrency.map((sibling) => (
                  <StepLink
                    key={sibling.slug}
                    href={usCardPath(sibling.slug)}
                    label={sibling.name}
                    description={`${sibling.issuer} · ${sibling.annualFee}`}
                  />
                ))}
              </NextSteps>
            )}
            {sameFilter.length > 0 && (
              <NextSteps
                title={us("siblingsFilterTitle", { filter: us(FILTER_LABEL_KEYS[filter]) })}
                compact
                className={sameCurrency.length > 0 ? "mt-8" : "mt-12"}
              >
                {sameFilter.map((sibling) => (
                  <StepLink
                    key={sibling.slug}
                    href={usCardPath(sibling.slug)}
                    label={sibling.name}
                    description={`${sibling.issuer} · ${sibling.annualFee}`}
                  />
                ))}
              </NextSteps>
            )}

            <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
              <Link href="/" className="underline">
                {common("backHome")}
              </Link>
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
