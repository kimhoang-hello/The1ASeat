import Link from "next/link";
import { CardImage } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { OfferStats } from "@/components/credit-cards/offer-stats";
import { spendRequirement, usCardPath, type UsCreditCardOffer } from "@/lib/us-credit-cards";
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
 * - Nút là "Xem chi tiết", không phải "Apply ngay": khối "Góc nhìn từ Canada"
 *   (ITIN, US address, credit history) nằm ở trang chi tiết, và người Canada
 *   cần đọc nó trước khi bấm sang trang ngân hàng Mỹ.
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
        sizes="176px"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CardBadges
          offer={card}
          cardType={card.cardType}
          elevatedBonusLabel={offers_t("elevatedBonus")}
          expiresOnLabel={offers_t("expiresOn")}
        />

        {/* `wrap-anywhere`: tên thẻ Mỹ dài ("Bank of America® Premium
            Rewards® Credit Card"), và ở màn 320px một từ không ngắt được đẩy
            cả trang trượt ngang — cùng cái bẫy trang Ngân hàng đã gặp. */}
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

        {card.us.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {card.us.tags.map((tag) => (
              <li
                key={tag}
                className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        {card.us.needsVerification && (
          <p className="mt-3 text-xs font-medium text-amber-700">{us("sampleBadge")}</p>
        )}

        <div className="mt-auto pt-4">
          <Link
            href={href}
            className="inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            {us("viewDetails")} &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}
