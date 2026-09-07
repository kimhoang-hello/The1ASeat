import Link from "next/link";

import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import { isReferralUrl } from "@/lib/affiliate-links";
import type { CreditCardOffer } from "@/lib/content";
import { pickHeading, resolveProse, type BestCardPick } from "@/lib/best-cards";
import { t as translate } from "@/lib/t";

const offers_t = translate("offers");
const best = translate("bestCards");

/**
 * Một thẻ trong danh sách "tốt nhất", ở dạng gọn.
 *
 * KHÔNG chép lại `article` của `/credit-cards`: ở đó thẻ đứng một mình nên nó
 * mang cả headline lẫn khối quyền lợi mở ra được. Ở đây ngay bên dưới đã là
 * đoạn viết tay nói đúng những điều đó bằng lời của tác giả, nên lặp lại là
 * người đọc phải đọc hai lần cùng một nội dung. Cái còn lại — ảnh thẻ, dải số
 * liệu, huy hiệu hết hạn, nút apply — là thứ đoạn văn không nói được và cũng
 * là thứ phải luôn khớp Contentful.
 */
function PickCard({ card, placement }: { card: CreditCardOffer; placement: string }) {
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

export function BestCardPickSection({
  pick,
  cards,
  bonusInHeading = false,
  placement,
}: {
  pick: BestCardPick;
  cards: CreditCardOffer[];
  bonusInHeading?: boolean;
  placement: string;
}) {
  return (
    /* `scroll-mt` vì mục lục ở đầu trang nhảy tới đây bằng `#id`, và thanh
       điều hướng của site dính trên cùng — thiếu nó thì tiêu đề mục nằm khuất
       dưới thanh đó sau mỗi lần nhảy. */
    <section id={pick.slug} className="scroll-mt-24 border-t border-border pt-10">
      <h2 className="text-balance font-display text-xl font-bold text-foreground">
        {pickHeading(pick, cards, bonusInHeading)}
      </h2>

      <div className="mt-4 space-y-4">
        {cards.map((card) => (
          <PickCard key={card.slug} card={card} placement={placement} />
        ))}
      </div>

      {/* Lọc SAU `resolveProse`, không phải trước: một đoạn chỉ gồm câu nói về
          ngày hết hạn sẽ rỗng đi khi thẻ không còn `expiresAt`, và một `<p>`
          rỗng vẫn ăn cả một khoảng `space-y-4` giữa hai đoạn thật. */}
      <div className="mt-5 space-y-4 leading-relaxed text-foreground/90">
        {pick.bodyVi
          .map((paragraph) => resolveProse(paragraph, cards[0]))
          .filter(Boolean)
          .map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
      </div>

      <p className="mt-5 rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold text-foreground">{best("bestFor")}: </span>
        {pick.bestForVi}
      </p>
    </section>
  );
}
