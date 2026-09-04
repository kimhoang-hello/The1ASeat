import type { CreditCardOffer } from "./content/types";
import { hasExpired } from "./format-date";

/**
 * Thẻ này có đang thật sự chạy elevated offer không.
 *
 * Cờ `elevatedBonus` một mình là KHÔNG đủ. Job `expire-offers` là thứ hạ cờ
 * đó xuống, mà nó ghi bằng `updateEntry` — ghi draft xong mới publish. Một lần
 * publish hỏng để lại bản đang phục vụ với cờ còn bật VÀ `expiresAt` đã qua
 * (xem AGENTS.md; job nay báo trạng thái này ra `errors`, nhưng báo là chuyện
 * của job, còn trang vẫn đang vẽ trong lúc chờ người xử lý).
 *
 * Trước đây `CardBadges` giấu ngày hết hạn đã qua, nhưng huy hiệu "Elevated
 * offer", tab "Elevated offers", thứ tự ưu tiên trang chủ và banner chạy trên
 * đầu mọi trang đều vẫn tin mỗi cái cờ — nên kết quả tệ hơn: offer chết vẫn
 * được quảng bá, mà dấu hiệu duy nhất cho biết nó chết thì đã bị giấu đi.
 *
 * Một hàm cho cả năm chỗ, cùng kiểu lưới an toàn lúc render mà
 * `/transfer-bonuses` đã dùng.
 */
export function isElevatedLive(offer: CreditCardOffer): boolean {
  if (!offer.elevatedBonus) return false;
  return !(offer.expiresAt && hasExpired(offer.expiresAt));
}
