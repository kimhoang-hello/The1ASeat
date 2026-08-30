import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreditCardOfferBySlug, getCreditCardOffers, getPosts } from "@/lib/content";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { CardNextSteps } from "@/components/credit-cards/card-next-steps";
import { assertNoSlugClash } from "@/lib/card-compare";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { EditorsTake } from "@/components/credit-cards/editors-take";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { OfferHistoryNote } from "@/components/credit-cards/offer-history-note";
import { RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import { isReferralUrl } from "@/lib/affiliate-links";
import { JsonLd } from "@/components/seo/json-ld";
import { creditCardJsonLd } from "@/lib/credit-card-schema";
import { t as translate } from "@/lib/t";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

const offers = translate("offers");
const common = translate("common");
const seo = translate("seo");

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  const offers = await getCreditCardOffers();
  // Cửa canh phải nằm ở ĐÂY, không nằm trong trang so sánh: trang đó `await
  // searchParams` nên là route động, thân nó không chạy lúc `next build` và
  // một `throw` trong đó không bao giờ làm build đỏ. `generateStaticParams`
  // thì chạy lúc build, nên thẻ mang slug trùng đoạn tĩnh của trang so sánh
  // làm hỏng deploy ngay — đúng lúc còn sửa được, thay vì im lặng mất trang
  // chi tiết của thẻ đó trên production.
  assertNoSlugClash(offers);
  return offers.map((offer) => ({ slug: offer.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const offer = await getCreditCardOfferBySlug(slug);
  if (!offer) return {};

  return pageMetadata({
    title: offer.name,
    description: offer.headline,
    path: `/credit-cards/${offer.slug}`,
    image: offer.cardImage || undefined,
  });
}

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // `allOffers`, không phải `offers`: tên đó đã là hàm dịch namespace "offers"
  // ở đầu file.
  const [offer, allOffers, posts] = await Promise.all([
    getCreditCardOfferBySlug(slug),
    getCreditCardOffers(),
    getPosts(),
  ]);

  if (!offer) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbCreditCards"), path: "/credit-cards" },
        { name: offer.name, path: `/credit-cards/${offer.slug}` },
      ]),
      creditCardJsonLd(offer),
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />
      <Link href="/credit-cards" className="text-sm font-semibold text-primary hover:underline">
        &larr; {offers("viewAll")}
      </Link>

      <CardImage
        image={offer.cardImage}
        name={offer.name}
        placeholderIcon={offer.image}
        badge={
          offer.rebate && (
            <RebateChip
              amount={offer.rebate}
              label={offers("rebate")}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 shadow-sm"
            />
          )
        }
        className="mt-6 h-56 w-full rounded-2xl"
        applyUrl={offer.applyUrl}
        priority
      />

      <div className="mt-6">
        <CardBadges
          offer={offer}
          cardType={offer.cardType}
          elevatedBonusLabel={offers("elevatedBonus")}
          expiresOnLabel={offers("expiresOn")}
        />
      </div>

      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">{offer.name}</h1>
      <OfferStats offer={offer} className="mt-4" />

      {/* Ngay dưới con số, vì nó nói về chính con số đó. Không hiện gì khi
          chưa đủ lịch sử để nói. */}
      <OfferHistoryNote offer={offer} className="mt-4" />

      <p className="mt-4 text-lg leading-relaxed text-foreground/90">{offer.headline}</p>

      <EditorsTake editorsTake={offer.editorsTake} className="mt-6" />

      <h2 className="mt-8 font-display text-xl font-bold text-foreground">{offers("keyBenefits")}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
        {offer.keyBenefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <ApplyButton href={offer.applyUrl} affiliate={isReferralUrl(offer.applyUrl)} className="mt-8" />

      <OfferDisclosure className="mt-8" />

      {/* Đặt SAU nút apply và phần công bố: khối này là đường đi tiếp cho người
          chưa quyết, không phải thứ chen ngang giữa họ và nút bấm. */}
      <CardNextSteps offer={offer} offers={allOffers} posts={posts} className="mt-12" />

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href="/" className="underline">
          {common("backHome")}
        </Link>
      </p>
    </article>
  );
}
