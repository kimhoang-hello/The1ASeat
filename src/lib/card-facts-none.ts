import type { Sourced } from "./recommendation/types.ts";

/**
 * Dòng Thông tin nhanh mà trang chính chủ của ngân hàng cho thấy là KHÔNG CÓ
 * (đọc 04/10/2026). Tách khỏi dữ liệu engine vì engine không cần biết "không
 * có" — quyền lợi vắng mặt đã đủ cho nó — còn trang thẻ thì cần phân biệt
 * "đã kiểm, không có" với "chưa kiểm": không có dòng ở đây thì trang ghi
 * "Chưa kiểm", có thì ghi "Không có".
 *
 * Thẻ thêm quyền lợi về sau (dòng `product-benefits.ts` mới) thì dữ kiện thắng,
 * và `audit:reco-data` báo lỗi để xoá dòng ở đây. Quá 180 ngày chưa kiểm lại
 * thì audit cảnh báo, như mọi dữ kiện nguồn ngân hàng khác.
 *
 * `insurance` nghĩa là không có loại nào trong sáu loại bảng theo dõi (y tế du
 * lịch, huỷ chuyến, trễ chuyến, hành lý, thiết bị di động, thuê xe) — thẻ vẫn
 * có thể có bảo vệ mua sắm hay bảo hành mở rộng.
 */
export interface VerifiedNone extends Sourced {
  /** Slug entry Contentful của thẻ. */
  slug: string;
  key: "lounge" | "insurance";
}

const CHECKED = "2026-10-04";

const none = (slug: string, key: VerifiedNone["key"], sourceUrl: string): VerifiedNone => ({
  slug,
  key,
  sourceUrl,
  sourceKind: "issuer",
  verifiedAt: CHECKED,
  recordedAt: CHECKED,
  confidence: "verified",
});

const amexUrl = (path: string) => `https://www.americanexpress.com/en-ca/${path}/`;
const tdUrl = (path: string) => `https://www.td.com/ca/en/personal-banking/products/credit-cards/${path}`;
const rbcUrl = (path: string) => `https://www.rbcroyalbank.com/credit-cards/travel/${path}.html`;
const cibcUrl = (path: string) => `https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/${path}.html`;
const scotiaUrl = (path: string) => `https://www.scotiabank.com/ca/en/personal/credit-cards/${path}.html`;

export const VERIFIED_NONE: VerifiedNone[] = [
  none("amex-green", "lounge", amexUrl("credit-cards/green-card")),
  // Chỉ có Buyer's Assurance® và Purchase Protection®.
  none("amex-green", "insurance", amexUrl("credit-cards/green-card")),
  none("amex-cobalt", "lounge", amexUrl("credit-cards/cobalt-card")),
  none("amex-aeroplan", "lounge", amexUrl("charge-cards/aeroplan-card")),
  none("amex-marriott-bonvoy", "lounge", amexUrl("credit-cards/marriott-bonvoy-card")),
  none("amex-marriott-bonvoy-business", "lounge", amexUrl("credit-cards/marriott-bonvoy-business-card")),
  none("amex-business-gold", "lounge", amexUrl("charge-cards/small-business-gold-card")),
  none("scotiabank-momentum-visa-infinite-plus", "lounge", scotiaUrl("visa/momentum-infinite-card")),
  // Trang Scotiabank® Scene+™ Visa (bản cho sinh viên mở cùng thẻ này).
  none("scotiabank-scene-plus-visa-students", "lounge", scotiaUrl("visa/scene-card")),
  none("scotiabank-scene-plus-visa-students", "insurance", scotiaUrl("visa/scene-card")),
  none("td-aeroplan-visa-infinite", "lounge", tdUrl("aeroplan/aeroplan-visa-infinite-card")),
  none("td-aeroplan-visa-platinum", "lounge", tdUrl("aeroplan/aeroplan-visa-platinum-card")),
  none("td-cash-back-visa-infinite", "lounge", tdUrl("cash-back/cash-back-visa-infinite-card")),
  none("rbc-avion-visa-infinite", "lounge", rbcUrl("rbc-avion-visa-infinite")),
  none("rbc-avion-visa-platinum", "lounge", rbcUrl("rbc-avion-visa-platinum")),
  none("cibc-aeroplan-visa", "lounge", cibcUrl("aeroplan-visa-card")),
  none("cibc-aeroplan-visa-infinite", "lounge", cibcUrl("aeroplan-visa-infinite-card")),
  // Bảng so sánh trên wealthsimple.com: "Airport lounge access — N/A".
  none("wealthsimple-visa-infinite-plus", "lounge", "https://www.wealthsimple.com/en-ca/wealthsimple-visa-infinite-card"),
  none("united-mileageplus-neo-world-elite-mastercard", "lounge", "https://www.neofinancial.com/credit-cards/neo-united-mastercard"),
];
