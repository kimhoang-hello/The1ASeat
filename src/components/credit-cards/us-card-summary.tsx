import Link from "next/link";
import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { CardRow } from "@/components/credit-cards/card-row";
import { CardTags } from "@/components/credit-cards/card-tags";
import { spendRequirement, usCardPath, type UsCreditCardOffer } from "@/lib/us-credit-cards";
import { formatDate, hasExpired } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const offers_t = translate("offers");
const us = translate("usCards");

/**
 * Một thẻ Mỹ trong danh sách: CHÍNH dòng gọn của `/credit-cards` (`CardRow`),
 * để hai trang trông là một site. Khác ở ba chỗ, đều có lý do:
 *
 * - Tên ngân hàng phát hành dưới tên thẻ: người đọc Canada không quen hết các
 *   ngân hàng Mỹ, và bộ lọc theo ngân hàng ở ngay trên danh sách.
 * - Dòng "Điều kiện" thay cho headline. Thẻ Canada viết điều kiện chi tiêu
 *   trong headline; thẻ Mỹ tách nó ra một field có số USD thật, và người đọc
 *   Canada cần thấy ngay con số đó là đô Mỹ.
 * - Link "Xem chi tiết" giữ chữ cũ của trang này. Trước 29/09/2026 đó là nút
 *   duy nhất, để người Canada đọc khối "Góc nhìn từ Canada" trước khi apply;
 *   tác giả chốt thêm nút Apply cho khớp trang Canada.
 */
export function UsCardSummary({ card }: { card: UsCreditCardOffer }) {
  const requirement = spendRequirement(card);

  return (
    <CardRow
      offer={card}
      href={usCardPath(card.slug)}
      placement="us_card_list"
      detailsLabel={us("viewDetails")}
      heading="h3"
      subtitle={card.issuer}
      showHeadline={false}
    >
      {requirement && (
        <p className="mt-2 text-sm text-foreground/90">
          <span className="font-semibold text-foreground">{us("requirementLabel")}:</span>{" "}
          {requirement}
        </p>
      )}

      <CardTags tags={card.us.tags} className="mt-3" />

      {card.us.needsVerification && (
        <p className="mt-3 text-xs font-medium text-warning">{us("sampleBadge")}</p>
      )}
    </CardRow>
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
          <p className="mt-1 text-xs font-medium text-warning">
            {offers_t("expiresOn")} {formatDate(card.expiresAt)}
          </p>
        )}
      </div>
    </article>
  );
}
