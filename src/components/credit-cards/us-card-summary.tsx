import Link from "next/link";
import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { CardTags } from "@/components/credit-cards/card-tags";
import { ApplyButton } from "@/components/ui/apply-button";
import { isReferralUrl } from "@/lib/affiliate-links";
import { spendRequirement, usCardPath, type UsCreditCardOffer } from "@/lib/us-credit-cards";
import { formatDate, hasExpired } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const offers_t = translate("offers");
const us = translate("usCards");

/**
 * Một thẻ Mỹ trong danh sách. Dựng từ ĐÚNG các mảnh của thẻ trên
 * `/credit-cards` — khung `article`, `CardImage`, `CardBadges`, `OfferStats` —
 * để hai trang trông là một site. Khác ở ba chỗ, đều có lý do:
 *
 * - Dòng "Điều kiện" dưới dải số liệu. Thẻ Canada viết điều kiện chi tiêu
 *   trong headline; thẻ Mỹ tách nó ra một field có số USD thật, và người đọc
 *   Canada cần thấy ngay con số đó là đô Mỹ.
 * - Vài tag quyền lợi thay cho khối "Quyền lợi chính" mở ra được: trang này
 *   để lướt tìm thẻ, chi tiết nằm ở trang riêng của thẻ.
 * - Hàng nút giống thẻ Canada: link "Xem chi tiết" bên cạnh "Apply ngay", và
 *   ảnh thẻ bấm được sang trang apply. Trước 29/09/2026 chỉ có "Xem chi tiết"
 *   để người Canada đọc khối "Góc nhìn từ Canada" trước khi apply; tác giả
 *   chốt thêm nút Apply cho khớp trang Canada — khối đó vẫn nằm ở trang chi
 *   tiết, ngay cạnh.
 */
export function UsCardSummary({ card }: { card: UsCreditCardOffer }) {
  const requirement = spendRequirement(card);
  const href = usCardPath(card.slug);

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row">
      <CardImage
        image={card.cardImage}
        name={card.name}
        placeholderIcon={card.image}
        className="h-32 w-full shrink-0 self-start rounded-xl sm:h-32 sm:w-40 xl:h-36 xl:w-44"
        {...applyOverlay(card.applyUrl, "us_card_list", card.slug)}
        sizes="176px"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CardBadges
          offer={card}
          cardType={card.cardType}
          elevatedBonusLabel={offers_t("elevatedBonus")}
          expiresOnLabel={offers_t("expiresOn")}
        />

        {/* `wrap-anywhere`: tên thẻ Mỹ rất dài, và ở màn 320px một từ không
            ngắt được đẩy cả trang trượt ngang — cùng cái bẫy trang Ngân hàng
            đã gặp.

            Đừng viết ví dụ tên thẻ ở đây và đừng để tên thẻ bị NGẮT DÒNG trong
            comment: `audit:trademarks` học thương hiệu bằng cách lùi về trước
            dấu ®, nên một dòng mở đầu bằng tên chương trình điểm kèm dấu ® sẽ
            dạy nó rằng chính từ đó là một thương hiệu — và nó đi báo nhầm 12 chỗ trong nội dung Canada. */}
        <h3 className="mt-1.5 wrap-anywhere font-display text-lg font-bold text-foreground">
          <Link href={href} className="cursor-pointer hover:text-primary">
            {card.name}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{card.issuer}</p>

        <OfferStats offer={card} className="mt-3" />

        {requirement && (
          <p className="mt-2 text-sm text-foreground/90">
            <span className="font-semibold text-foreground">{us("requirementLabel")}:</span>{" "}
            {requirement}
          </p>
        )}

        <CardTags tags={card.us.tags} className="mt-3" />

        {card.us.needsVerification && (
          <p className="mt-3 text-xs font-medium text-amber-700">{us("sampleBadge")}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
          <Link
            href={href}
            className="cursor-pointer py-3 text-sm font-semibold text-foreground/80 hover:text-primary hover:underline"
          >
            {us("viewDetails")} &rarr;
          </Link>
          {card.applyUrl && (
            <ApplyButton
              href={card.applyUrl}
              affiliate={isReferralUrl(card.applyUrl)}
              placement="us_card_list"
              product={card.slug}
            />
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Một thẻ trong mục "🔥 Elevated Offers" ở dạng gọn: ảnh nhỏ, tên (link sang
 * trang thẻ), welcome bonus, ngày hết hạn.
 *
 * Gọn vì hai lý do. Mọi thẻ ở mục này đều có mặt lần nữa, ở dạng đầy đủ, trong
 * "Tất cả thẻ Mỹ" ngay bên dưới — nên dạng đầy đủ ở đây là in cùng một thẻ hai
 * lần. Và đo 30/09/2026 trên màn 375px: tám thẻ dạng đầy đủ đẩy danh sách xuống
 * 7,500px, gần mười màn điện thoại trước khi người đọc thấy hàng ngân hàng.
 *
 * Ảnh vẫn bấm được sang trang apply như mọi ảnh thẻ khác, với `placement`
 * riêng để GA4 tách được click từ mục này.
 */
export function UsCardElevated({ card }: { card: UsCreditCardOffer }) {
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 sm:gap-4 sm:p-4">
      <CardImage
        image={card.cardImage}
        name={card.name}
        placeholderIcon={card.image}
        className="h-16 w-24 shrink-0 rounded-lg sm:h-20 sm:w-32"
        {...applyOverlay(card.applyUrl, "us_card_elevated", card.slug)}
        sizes="128px"
      />

      {/* Không có `CardBadges`: "Elevated offer", "US Card" và loại thẻ nói
          cùng một điều cho mọi thẻ trong mục này — chỉ còn ngày hết hạn là
          thông tin riêng của từng thẻ. */}
      <div className="min-w-0 flex-1">
        <h3 className="wrap-anywhere font-display text-[15px] font-bold leading-snug text-foreground sm:text-base">
          <Link href={usCardPath(card.slug)} className="cursor-pointer hover:text-primary">
            {card.name}
          </Link>
        </h3>
        {card.welcomeBonus && (
          <p className="mt-1 text-sm font-semibold leading-snug text-primary">{card.welcomeBonus}</p>
        )}
        {card.expiresAt && !hasExpired(card.expiresAt) && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            {offers_t("expiresOn")} {formatDate(card.expiresAt)}
          </p>
        )}
      </div>
    </article>
  );
}
