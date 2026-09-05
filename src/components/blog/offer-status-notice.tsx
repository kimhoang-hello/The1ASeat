import Link from "next/link";
import { Info, Prohibit } from "@phosphor-icons/react/ssr";
import { formatDate } from "@/lib/format-date";
import type { OfferCta, OfferStatus } from "@/lib/post-offer-status";
import { t } from "@/lib/t";

const posts_t = t("posts");

/**
 * Nơi đi tiếp khi ưu đãi trong bài đã kết thúc — ba mặt hàng có ưu đãi của
 * site. Href để ở đây chứ không để trong `post-offer-status.ts`: file đó là
 * dữ liệu biên tập, còn đây là chỗ biết trang nào đang ở URL nào.
 *
 * `transferBonuses` rẽ theo DỮ LIỆU THẬT. Transfer bonus là thứ có lúc không
 * còn cái nào (05/09/2026: đúng 0 bonus đang chạy) — mà câu "Xem Transfer Bonus
 * đang chạy" thì hứa là có. Người vừa đọc một ưu đãi đã đóng mà bấm tiếp vào
 * một trang rỗng là đóng hai lần liên tiếp. Hết bonus thì dẫn thẳng sang bảng
 * tỷ lệ chuyển điểm — thứ luôn có và là câu trả lời gần nhất, đúng chỗ mà
 * trạng thái rỗng của /transfer-bonuses cũng dẫn tới.
 */
const CTA = (hasLiveTransferBonus: boolean): Record<OfferCta, { href: string; labelKey: string }> => ({
  transferBonuses: hasLiveTransferBonus
    ? { href: "/transfer-bonuses", labelKey: "offerCtaTransferBonuses" }
    : { href: "/transfer-partners", labelKey: "offerCtaTransferPartners" },
  creditCards: { href: "/credit-cards?type=noi-bat", labelKey: "offerCtaCreditCards" },
  bankAccounts: { href: "/bank-accounts", labelKey: "offerCtaBankAccounts" },
});

/**
 * Trạng thái của ưu đãi mà bài đang nói tới, đặt ngay dưới dòng tác giả — trước
 * chữ đầu tiên của thân bài.
 *
 * Hai trạng thái, không phải một. Chỉ hiện khi đã kết thúc thì suốt thời gian
 * ưu đãi còn chạy, thứ duy nhất nói hạn chót vẫn là một câu nằm giữa thân bài;
 * còn khi hộp đỏ xuất hiện thì nó xuất hiện từ hư không. Hiện cả hai nghĩa là
 * người đọc thấy cùng một chỗ, cùng một hình dạng, và chỉ đổi nội dung.
 *
 * Ngày in ra bằng `formatDate` như mọi ngày khác trên site (dd/MM/yyyy) và
 * `hasExpired` so theo ngày Toronto — bài không được "hết hạn" sớm một hôm chỉ
 * vì máy chủ Hostinger chạy giờ UTC.
 */
export function OfferStatusNotice({
  status,
  hasLiveTransferBonus,
}: {
  status: OfferStatus;
  /** Có transfer bonus nào đang chạy không — quyết định nút "đi tiếp" trỏ đâu. */
  hasLiveTransferBonus: boolean;
}) {
  const cta = CTA(hasLiveTransferBonus)[status.cta];
  const date = formatDate(status.endsOn);

  if (!status.ended) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-relaxed text-foreground/90">
        <Info size={18} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <span>{posts_t("offerLive", { date })}</span>
      </p>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
      <Prohibit size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
      <p>
        <span className="font-semibold">{posts_t("offerEnded", { date })}</span>{" "}
        <Link href={cta.href} className="font-semibold text-primary hover:underline">
          {posts_t(cta.labelKey)} &rarr;
        </Link>
      </p>
    </div>
  );
}
