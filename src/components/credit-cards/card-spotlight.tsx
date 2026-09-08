import Link from "next/link";

import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import { isReferralUrl } from "@/lib/affiliate-links";
import type { CreditCardOffer } from "@/lib/content";
import { t as translate } from "@/lib/t";

const offers_t = translate("offers");
const best = translate("bestCards");

/**
 * Một tấm thẻ ở dạng gọn: ảnh, huy hiệu, dải số liệu, hai đường đi tiếp.
 *
 * Dùng ở HAI chỗ, và đó là lý do nó đứng riêng: bốn trang "Các thẻ tốt nhất",
 * và giữa thân bài viết mỗi khi bài nhắc tới một thẻ có trên site. Hai chỗ đó
 * phải trông giống hệt nhau — người đọc gặp cùng một tấm thẻ ở hai nơi mà nó
 * hiện ra hai kiểu thì lần thứ hai họ phải đọc lại từ đầu.
 *
 * KHÔNG chép lại `article` của `/credit-cards`: ở đó thẻ đứng một mình nên nó
 * mang cả headline lẫn khối quyền lợi mở ra được. Ở đây ngay cạnh đã là chữ
 * của tác giả nói đúng những điều đó, nên lặp lại là bắt người đọc đọc hai lần
 * cùng một nội dung. Cái còn lại — ảnh thẻ, dải số liệu, huy hiệu hết hạn, nút
 * apply — là thứ đoạn văn không nói được và cũng là thứ phải luôn khớp
 * Contentful.
 *
 * `placement` là bề mặt phát ra click trong GA4, và người gọi truyền vào chứ
 * không cố định ở đây: khối trong bài viết và khối trên trang "tốt nhất" phải
 * đếm riêng, nếu không thì không trả lời được câu "bài viết có ra tiền không".
 */
export function CardSpotlight({
  card,
  placement,
}: {
  card: CreditCardOffer;
  placement: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row">
      <CardImage
        image={card.cardImage}
        name={card.name}
        placeholderIcon={card.image}
        badge={
          card.rebate && (
            <RebateChip
              amount={card.rebate}
              label={offers_t("rebate")}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 shadow-sm"
            />
          )
        }
        className="h-32 w-full shrink-0 self-start rounded-xl sm:h-28 sm:w-36"
        {...applyOverlay(card.applyUrl, placement, card.slug)}
        sizes="144px"
      />

      <div className="flex flex-1 flex-col">
        <CardBadges
          offer={card}
          cardType={card.cardType}
          elevatedBonusLabel={offers_t("elevatedBonus")}
          expiresOnLabel={offers_t("expiresOn")}
        />

        <h3 className="mt-1.5 font-display text-base font-bold text-foreground">
          <Link href={`/credit-cards/${card.slug}`} className="cursor-pointer hover:text-primary">
            {card.name}
          </Link>
        </h3>

        <OfferStats offer={card} className="mt-3" />

        <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
          <Link
            href={`/credit-cards/${card.slug}`}
            className="cursor-pointer text-sm font-semibold text-foreground/80 hover:text-primary hover:underline"
          >
            {best("viewCard")} &rarr;
          </Link>
          {card.applyUrl && (
            <ApplyButton
              href={card.applyUrl}
              affiliate={isReferralUrl(card.applyUrl)}
              placement={placement}
              product={card.slug}
            />
          )}
        </div>
      </div>
    </div>
  );
}
