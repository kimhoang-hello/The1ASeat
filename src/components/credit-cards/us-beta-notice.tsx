import { BetaBadge } from "@/components/ui/beta-badge";
import { US_CARDS_PUBLISHED } from "@/lib/feature-flags";
import { t as translate } from "@/lib/t";

const us = translate("usCards");

/**
 * Dải Beta của mục Thẻ Mỹ — cùng hình dạng và cùng hai trạng thái với công cụ
 * Gợi ý thẻ (`/credit-cards/goi-y`).
 *
 * Còn sau cờ thì đây là bản nháp không ai ngoài tác giả nên đọc; đã công bố
 * thì nó là bản BETA: số liệu thẻ Mỹ không có job nào canh như thẻ Canada
 * (welcome offer Mỹ đổi liên tục, xem AGENTS.md), nên người đọc có quyền biết
 * mục này còn mới và phải tự kiểm lại với ngân hàng trước khi apply.
 *
 * Full-bleed, nên nó phải đứng NGOÀI khung nội dung của trang — dải nằm trong
 * `max-w-page` trông như một hộp cảnh báo của riêng một mục, không phải lời
 * nói về cả trang.
 */
export function UsCardsBetaNotice() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 sm:px-6 lg:px-8">
      <BetaBadge className="bg-amber-100 text-amber-900" />
      {US_CARDS_PUBLISHED ? us("betaNotice") : us("draftNotice")}
    </p>
  );
}
