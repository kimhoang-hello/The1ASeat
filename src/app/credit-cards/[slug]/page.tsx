import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCreditCardOfferBySlug,
  getCreditCardOffers,
  getPosts,
} from "@/lib/content";
import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
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
    /* Từ `xl` trang tách hai cột: ảnh thẻ dính bên trái, mọi thứ còn lại bên
       phải. Dưới `xl` giữ nguyên một cột 42rem như trước.

       THỨ TỰ DOM KHÔNG ĐỔI MỘT DÒNG NÀO. Ảnh thẻ là thứ DUY NHẤT tách sang
       cột trái, chính vì nó là thứ duy nhất đứng đầu sẵn — gom thêm
       `OfferStats` hay nút Apply vào đó thì trên điện thoại chúng nhảy lên
       trước cả tên thẻ. Nút Apply thì có thêm một cái NỮA trong cột trái —
       thêm chứ không di chuyển, và chỉ từ `xl`; xem chú thích tại chỗ. */
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 xl:max-w-[68rem]">
      <JsonLd data={jsonLd} />
      <Link
        href="/credit-cards"
        className="text-sm font-semibold text-primary hover:underline"
      >
        &larr; {offers("viewAll")}
      </Link>

      <div className="xl:grid xl:grid-cols-[22rem_minmax(0,1fr)] xl:gap-12">
        <div className="mt-6 xl:sticky xl:top-24 xl:self-start">
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
            className="h-56 w-full rounded-2xl"
            {...applyOverlay(offer.applyUrl, "card_detail", offer.slug)}
            preload
          />

          {/* Nút Apply thứ hai, CHỈ ở cột trái và CHỈ từ `xl`. Cột này dính
              theo màn hình, nên nút đi cùng người đọc suốt bài thay vì nằm
              sau danh sách quyền lợi — trước đây muốn bấm phải cuộn qua cả
              editor's take và quyền lợi chính.

              KHÔNG hiện dưới `xl`: ở đó không có cột trái, nút sẽ rơi vào
              giữa ảnh thẻ và tên thẻ — tức người đọc gặp "Apply ngay" trước
              khi biết đang đọc thẻ nào.

              `placement` KHÁC nút dưới thân bài. Hai nút cùng khai
              `card_detail` thì `apply_clicked` gộp làm một và không còn trả
              lời được câu hỏi chính: nút mới có thật sự lấy được click hay
              chỉ chia lại số click của nút cũ. */}
          {offer.applyUrl && (
            <div className="mt-6 hidden xl:block">
              <ApplyButton
                href={offer.applyUrl}
                affiliate={isReferralUrl(offer.applyUrl)}
                placement="card_detail_rail"
                product={offer.slug}
                className="w-full text-center"
              />
              {isReferralUrl(offer.applyUrl) && (
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
              offer={offer}
              cardType={offer.cardType}
              elevatedBonusLabel={offers("elevatedBonus")}
              expiresOnLabel={offers("expiresOn")}
            />
          </div>

          <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">
            {offer.name}
          </h1>
          <OfferStats offer={offer} className="mt-4" />

          {/* Ngay dưới con số, vì nó nói về chính con số đó. Không hiện gì khi
          chưa đủ lịch sử để nói. */}
          <OfferHistoryNote offer={offer} className="mt-4" />

          <p className="mt-4 text-lg leading-relaxed text-foreground/90">
            {offer.headline}
          </p>

          <EditorsTake editorsTake={offer.editorsTake} className="mt-6" />

          <h2 className="mt-8 font-display text-xl font-bold text-foreground">
            {offers("keyBenefits")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
            {offer.keyBenefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>

          {/* Không render nút khi `applyUrl` bị loại vì không phải http(s) — xem
          `safeApplyUrl`. Nút trỏ `href=""` sẽ mở lại chính trang này ở tab mới
          VÀ vẫn bắn `apply_clicked`, tức vừa hỏng vừa làm sai số đo doanh thu. */}
          {offer.applyUrl && (
            <ApplyButton
              href={offer.applyUrl}
              affiliate={isReferralUrl(offer.applyUrl)}
              className="mt-8"
              placement="card_detail"
              product={offer.slug}
            />
          )}

          <OfferDisclosure className="mt-8" />

          {/* Đặt SAU nút apply và phần công bố: khối này là đường đi tiếp cho người
          chưa quyết, không phải thứ chen ngang giữa họ và nút bấm. */}
          <CardNextSteps
            offer={offer}
            offers={allOffers}
            posts={posts}
            className="mt-12"
          />

          <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            <Link href="/" className="underline">
              {common("backHome")}
            </Link>
          </p>
        </div>
      </div>
    </article>
  );
}
