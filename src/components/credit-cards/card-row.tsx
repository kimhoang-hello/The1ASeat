import Link from "next/link";
import type { CreditCardOffer } from "@/lib/content";
import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { CardBadges } from "@/components/credit-cards/card-badges";
import { RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import { isReferralUrl } from "@/lib/affiliate-links";
import { splitAnnualFee } from "@/lib/annual-fee";
import { t as translate } from "@/lib/t";

const offers = translate("offers");

/**
 * Một thẻ trong danh sách, dạng DÒNG GỌN — dùng chung cho `/credit-cards`,
 * `/us-credit-cards` và bốn thẻ ở trang chủ, để ba nơi vẫn trông là một site.
 *
 * Thay cho ô thẻ cũ từ 03/10/2026 (audit UX/UI): ảnh thẻ rộng hết bề ngang
 * điện thoại, dải số liệu chữ 24px, headline, tag và khối "Quyền lợi chính" —
 * trung bình ~715px một thẻ ở 375px, danh sách 35 thẻ dài 32.8 màn hình. Dòng
 * gọn giữ đúng những dữ kiện để QUYẾT ĐỊNH: bonus, annual fee kèm ghi chú phí
 * (miễn năm đầu, thẻ phụ, phí sắp tăng), hạn offer, rebate, một câu headline.
 * Quyền lợi đầy đủ và nhận định ở trang thẻ.
 *
 * Ghi chú phí KHÔNG được cắt dù dài tới 150 ký tự: "miễn phí năm đầu" và
 * "từ 12/01/2027: $799/năm" đổi hẳn phép tính của người đọc, nên rút gọn dòng
 * thẻ mà giấu chúng là đổi thông tin lấy chiều cao.
 *
 * Bố cục: trên điện thoại ảnh nhỏ đứng cạnh tên, mọi thứ còn lại chạy hết bề
 * ngang bên dưới — headline nằm trong cột hẹp cạnh ảnh sẽ gãy 5–6 dòng. Từ
 * `sm` ảnh thành cột riêng bên trái. Ba hàng `auto 1fr auto` giữ hàng nút ở
 * đáy ô khi lưới hai cột kéo hai ô cạnh nhau cao bằng nhau.
 */
export function CardRow({
  offer,
  href,
  placement,
  detailsLabel,
  heading: Heading = "h2",
  subtitle,
  showHeadline = true,
  children,
}: {
  offer: CreditCardOffer;
  /** Trang của thẻ trên site này. */
  href: string;
  /** Bề mặt cho GA4, dùng cho cả nút Apply lẫn ảnh thẻ (`<placement>_image`). */
  placement: string;
  /** Chữ của link sang trang thẻ, đứng cạnh nút Apply. */
  detailsLabel: string;
  /** `h3` khi danh sách nằm dưới một tiêu đề mục `h2`. */
  heading?: "h2" | "h3";
  /** Dòng nhỏ dưới tên — thẻ Mỹ in tên ngân hàng phát hành. */
  subtitle?: string;
  showHeadline?: boolean;
  /** Dòng riêng của từng nơi dùng: tag, điều kiện chi tiêu, HOT TIP. */
  children?: React.ReactNode;
}) {
  const fee = splitAnnualFee(offer.annualFee);

  return (
    <article className="grid grid-cols-[5rem_minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-x-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-5 sm:p-5">
      <CardImage
        image={offer.cardImage}
        name={offer.name}
        placeholderIcon={offer.image}
        className="aspect-[1.586] w-full self-start rounded-md sm:row-span-3 sm:rounded-lg"
        {...applyOverlay(offer.applyUrl, placement, offer.slug)}
        sizes="(min-width: 640px) 144px, 80px"
      />

      <div className="min-w-0 self-center sm:self-start">
        <CardBadges
          offer={offer}
          cardType={offer.cardType}
          elevatedBonusLabel={offers("elevatedBonus")}
          expiresOnLabel={offers("expiresOn")}
        />
        {/* `wrap-anywhere`: tên thẻ Mỹ rất dài, và ở màn 320px một từ không
            ngắt được đẩy cả trang trượt ngang.

            Đừng viết ví dụ tên thẻ kèm dấu ® trong comment file này:
            `audit:trademarks` học thương hiệu bằng cách lùi về trước dấu ®,
            nên một dòng comment mở đầu bằng tên chương trình điểm kèm ® dạy
            nó một thương hiệu sai — đã báo nhầm 12 chỗ một lần. */}
        <Heading className="mt-1 wrap-anywhere font-display text-base font-bold leading-snug text-foreground sm:text-lg">
          <Link href={href} className="cursor-pointer hover:text-primary">
            {offer.name}
          </Link>
        </Heading>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="col-span-2 mt-3 min-w-0 sm:col-span-1 sm:col-start-2">
        {/* Được bao nhiêu, mất bao nhiêu — cùng thứ tự với dải số liệu ở
            trang thẻ. Hai con số là hai phần tử flex chứ không phải chữ nối
            tiếp: chữ nối tiếp thì "50,000 điểm" ở dòng trên, "Scene+™ Annual
            fee $120/năm" ở dòng dưới. Không có welcome bonus (thẻ cashback,
            thẻ bán tỷ lệ tích điểm) thì annual fee lên làm số chính, như
            `OfferStats` vẫn làm. Ghi chú phí đứng NGAY dưới phí, rebate đứng
            sau cùng — chip chen vào giữa thì "thẻ phụ: $30/năm" đọc như điều
            kiện của rebate. */}
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 leading-snug">
          {offer.welcomeBonus && (
            <span className="font-display text-base font-bold text-primary">{offer.welcomeBonus}</span>
          )}
          <span className="whitespace-nowrap text-sm">
            <span className="text-muted-foreground">{offers("annualFee")}</span>{" "}
            <span
              className={
                offer.welcomeBonus
                  ? "font-semibold text-foreground"
                  : "font-display text-base font-bold text-foreground"
              }
            >
              {fee.amount}
            </span>
          </span>
        </p>
        {fee.note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{fee.note}</p>}
        {offer.rebate && (
          <div className="mt-2">
            <RebateChip amount={offer.rebate} label={offers("rebate")} />
          </div>
        )}

        {showHeadline && offer.headline && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{offer.headline}</p>
        )}

        {children}
      </div>

      {/* Link trái, nút phải: nút Apply luôn ở cùng một mép, chỗ ngón cái tìm
          tới. Link cao 44px THẬT (`py-3`) — đứng cạnh nút ra trang ngân hàng,
          chạm hụt là rời site (DESIGN-SYSTEM.md 5.4). */}
      <div className="col-span-2 mt-2 flex flex-wrap items-center justify-between gap-x-4 sm:col-span-1 sm:col-start-2">
        <Link
          href={href}
          className="cursor-pointer py-3 text-sm font-semibold text-primary hover:underline"
        >
          {detailsLabel} &rarr;
        </Link>
        {offer.applyUrl && (
          <ApplyButton
            href={offer.applyUrl}
            affiliate={isReferralUrl(offer.applyUrl)}
            placement={placement}
            product={offer.slug}
          />
        )}
      </div>
    </article>
  );
}
