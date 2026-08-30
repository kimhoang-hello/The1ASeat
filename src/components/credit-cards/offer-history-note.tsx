import { ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import type { CreditCardOffer } from "@/lib/content";
import { welcomeBonusPeak } from "@/lib/offer-history";
import { formatDate } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const t = translate("offerHistory");

/**
 * "70,000 điểm" — cao hay thường?
 *
 * Câu đó quyết định mở thẻ ngay hay chờ, và cho tới giờ site không trả lời
 * được: job `check-rebates` ghi đè số mới lên số cũ, nên không chỗ nào giữ lại
 * mức trước đó. `data/offer-history.json` giờ giữ, và đây là chỗ nó lên tiếng.
 *
 * KHÔNG hiện gì khi chưa đủ dữ liệu — `welcomeBonusPeak` đòi ít nhất hai mức
 * khác nhau. Ngày đầu bật tính năng này, mọi thẻ chỉ mới có đúng một mức, nên
 * không thẻ nào hiện dòng nào cả. Đúng ý đồ: "cao nhất từng thấy" khi mới thấy
 * đúng một lần là một câu nói như có bằng chứng trong khi không có.
 */
export function OfferHistoryNote({
  offer,
  className = "",
}: {
  offer: CreditCardOffer;
  className?: string;
}) {
  const peak = welcomeBonusPeak(offer.slug, offer.welcomeBonus);
  if (!peak) return null;

  return (
    <p
      className={`flex items-start gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-foreground/90 ${className}`}
    >
      <ClockCounterClockwise size={18} className="mt-0.5 shrink-0 text-primary" />
      <span>
        {peak.isCurrent
          ? t("peakIsCurrent", { since: formatDate(peak.trackedSince) })
          : t("peakHigher", { label: peak.label, at: formatDate(peak.at) })}
      </span>
    </p>
  );
}
