/**
 * Lịch sử offer của một sản phẩm, đọc từ nhật ký trong repo.
 *
 * Tách khỏi `source.ts` vì file kia import `@/lib/content` — tức `next/cache`
 * — và `unstable_cache` không chạy được ngoài runtime của Next. CLI debugger
 * (`npm run reco:debug`) cần ĐÚNG lịch sử production dùng, nên nó phải gọi
 * ĐÚNG hàm này, không phải một bản chép lại cho CLI: hai phép dịch nhật ký
 * thành `OfferHistoryPoint` là hai chỗ lệch được, và lệch ở đây là percentile
 * §12 của debugger khác percentile của site.
 */

import { amountIn, historyFor, unitOf } from "@/lib/offer-history";
import { dedupeHistory, type OfferHistoryPoint } from "./offer-history.ts";
import { PRODUCTS } from "./data/index.ts";

export function repoOfferHistory(productId: string): OfferHistoryPoint[] {
  const product = PRODUCTS.find((row) => row.id === productId);
  if (product === undefined) return [];
  // Gộp lịch sử dưới MỌI slug thẻ này từng mang. Nhật ký gốc đánh khoá bằng
  // slug đang dùng lúc ghi, nên sau một lần đổi tên nó nằm ở hai chỗ.
  const slugs = [...product.previousSlugs, product.slug];
  // Đưa CẢ dòng thời gian thô vào, kể cả những lần thẻ không có welcome
  // bonus — chúng là vạch ngăn giữa hai đợt offer, và chúng mang ngày. Lọc
  // chúng ra trước khi gộp sẽ nhập hai đợt 70,000 rời nhau thành một, và
  // vứt ngày của chúng đi sẽ làm `until` của đợt trước nhảy qua cả khoảng
  // trống. Xem `dedupeHistory`.
  return dedupeHistory(
    slugs
      .flatMap((slug) => historyFor(slug))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map((entry) => ({
        at: entry.at,
        bonus:
          entry.welcomeBonus === undefined
            ? null
            : {
                label: entry.welcomeBonus,
                amount: amountIn(entry.welcomeBonus),
                unit: unitOf(entry.welcomeBonus),
              },
      })),
  );
}
