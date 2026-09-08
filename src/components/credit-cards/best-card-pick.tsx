import { CardSpotlight } from "@/components/credit-cards/card-spotlight";
import type { CreditCardOffer } from "@/lib/content";
import { pickHeading, resolveProse, type BestCardPick } from "@/lib/best-cards";
import { t as translate } from "@/lib/t";

const best = translate("bestCards");

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
          <CardSpotlight key={card.slug} card={card} placement={placement} />
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
