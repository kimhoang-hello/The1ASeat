import type { CreditCardOffer } from "@/lib/content";
import { formatDate, hasExpired } from "@/lib/format-date";
import { isElevatedLive } from "@/lib/credit-card-state";
import { t } from "@/lib/t";

const usCards = t("usCards");

export function CardBadges({
  offer,
  cardType,
  elevatedBonusLabel,
  expiresOnLabel,
}: {
  offer: CreditCardOffer;
  cardType: string;
  elevatedBonusLabel: string;
  expiresOnLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isElevatedLive(offer) && (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          + {elevatedBonusLabel}
        </span>
      )}
      {/* Không có huy hiệu "CA": Canada là mặc định của site, nên nó gắn giống
          hệt nhau lên mọi thẻ và không phân biệt được gì. Thẻ MỸ thì ngược lại
          — đứng một mình trên trang chi tiết hay trong kết quả tìm kiếm, huy
          hiệu này là thứ duy nhất nói ngay rằng đây không phải thẻ mở được ở
          Canada. */}
      {offer.country === "US" && (
        <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
          {usCards("usBadge")}
        </span>
      )}
      <span className="text-xs font-medium text-muted-foreground">{cardType}</span>
      {/* Ngày đã qua thì không in ra. `expire-offers` cố ý GIỮ `expiresAt` khi
          lượt viết lại copy hỏng, để lượt sau còn tìm thấy thẻ mà thử lại —
          nhưng "Hết hạn 01/08/2026" đập vào mắt người đọc thì vừa sai vừa
          làm họ nghĩ offer đang hiện cũng đã chết. Cùng một lưới an toàn
          `/transfer-bonuses` đã dùng. */}
      {offer.expiresAt && !hasExpired(offer.expiresAt) && expiresOnLabel && (
        <span className="text-xs font-medium text-amber-700">
          {expiresOnLabel} {formatDate(offer.expiresAt)}
        </span>
      )}
    </div>
  );
}
