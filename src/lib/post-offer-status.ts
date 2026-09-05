import type { BlogPost } from "./content";
import { hasExpired } from "./format-date";

/**
 * Bài viết về một ưu đãi CÓ HẠN — và ưu đãi đó hết hạn ngày nào.
 *
 * VÌ SAO CẦN: bài "Marriott Bonvoy®: Transfer Bonus 30%" nói ngay trong thân
 * bài rằng chương trình chạy "từ 04/08 đến 03/09/2026". Qua ngày 03/09 thì
 * trang vẫn nguyên như hôm đăng: không một chữ nào nói ưu đãi đã kết thúc, và
 * không một đường nào dẫn sang thứ đang chạy. Người đọc tới từ Google đọc hết
 * bài rồi mới biết — nếu họ tự để ý ngày tháng trong câu chữ.
 *
 * VÌ SAO NẰM TRONG CODE, KHÔNG NẰM TRONG CONTENTFUL: content model `blogPost`
 * không có trường ngày hết hạn, và thêm một trường là đổi mô hình nội dung của
 * cả site. Bảng này là bản vá đọc được ngay; ngày nào thêm trường thật thì
 * `postOfferStatus` đọc trường đó trước và bảng này rỗng dần.
 *
 * BẢNG NÀY MỤC RẤT DỄ: một bài Deals mới đăng mà không ai nhớ thêm vào đây là
 * đúng con bug ở trên quay lại. Nên `audit:health` đòi MỌI bài thuộc chuyên
 * mục Deals phải có tên trong đúng một trong hai bảng dưới đây — quên là job
 * đỏ, chứ không phải trang lặng lẽ sai.
 */

/** Nơi người đọc nên tới khi ưu đãi trong bài đã kết thúc. */
export type OfferCta = "transferBonuses" | "creditCards" | "bankAccounts";

export interface PostOffer {
  /** Ngày CUỐI CÙNG còn hiệu lực, đọc y như `expiresAt` của thẻ và của bonus. */
  endsOn: string;
  cta: OfferCta;
}

export const POST_OFFER_DEADLINES: Record<string, PostOffer> = {
  // "Từ 04/08 đến 03/09/2026" — nguyên văn trong thân bài.
  "marriott-bonvoy-transfer-bonus-30-amex-mr": { endsOn: "2026-09-03", cta: "transferBonuses" },
};

/**
 * Bài Deals KHÔNG có hạn chót, khai báo ra để `audit:health` phân biệt được
 * "đã cân nhắc" với "quên mất".
 */
export const POSTS_WITHOUT_DEADLINE: Record<string, string> = {
  // Ba promo HISA đều tính thời hạn theo số ngày kể từ lúc mở tài khoản
  // (120 ngày, 153 ngày), không có một ngày chốt chung nào cho cả bài.
  "top-hisa-promo-lai-suat-cao-canada-thang-8-2026":
    "promo tính theo số ngày kể từ lúc mở tài khoản, không có ngày chốt",
};

export interface OfferStatus extends PostOffer {
  /** Ngày chốt đã qua chưa — tính theo giờ Toronto, xem `hasExpired`. */
  ended: boolean;
}

/**
 * Ngày viết đúng dạng YYYY-MM-DD VÀ có thật trên lịch. `hasExpired` không khớp
 * được chuỗi hỏng thì trả `false`, tức bài sẽ khoe "còn hiệu lực đến hết
 * 2026-99-99" — một nhãn sai đứng ngay đầu bài. Thà không hiện gì (và để
 * `audit:health` đỏ) còn hơn hiện một câu nói sai.
 */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

/** Trạng thái ưu đãi của một bài, hoặc `undefined` nếu bài không nói về ưu đãi
 *  có hạn nào — hoặc ngày khai trong bảng không đọc được. */
export function postOfferStatus(post: BlogPost): OfferStatus | undefined {
  const offer = POST_OFFER_DEADLINES[post.slug];
  if (!offer || !isCalendarDate(offer.endsOn)) return undefined;
  return { ...offer, ended: hasExpired(offer.endsOn) };
}

/** Dùng chung với `audit:health`, để cửa canh ở đó nói đúng cái luật mà trang
 *  đang áp dụng thay vì một bản chép tay thứ hai. */
export const isOfferDeadline = isCalendarDate;
