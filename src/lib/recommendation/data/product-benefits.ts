import {
  makeId,
  type BenefitId,
  type ProductBenefit,
  type ProductBenefitId,
} from "../types.ts";
import { productIdFor } from "./products.ts";

/**
 * Quyền lợi của từng thẻ, ở dạng có cấu trúc.
 *
 * NGUỒN: `keyBenefitsVi` của entry Contentful. Chỉ seed quyền lợi site NÓI RA
 * — không suy ra từ hiểu biết chung về thẻ. "Ưu tiên hành lý" trên Amex®
 * Aeroplan®* Reserve chẳng hạn KHÔNG được ghi thành `free_checked_bag`, vì
 * site viết "ưu tiên", và ưu tiên với miễn phí là hai chuyện khác nhau.
 *
 * `numericValue` là mặt SỐ của quyền lợi và mỗi quyền lợi có một đơn vị riêng:
 * số lượt (lounge), số đô (credit), số người đi cùng (hành lý), số đêm (Elite
 * Night). Đơn vị nằm trong `Benefit.name`, không lặp lại ở đây.
 *
 * `null` ở `numericValue` nghĩa là quyền lợi CÓ mà không có mặt số nào site
 * nêu — không phải bằng 0. Priority Pass của Scotiabank® Gold là ví dụ: có
 * thẻ hội viên, site không nói mấy lượt.
 */

const VERIFIED_ON = "2026-09-07";
/**
 * Ngày các dòng này được ĐƯA VÀO kho. ĐỘC LẬP với `VERIFIED_ON`, và không được
 * đổi khi kiểm lại: kiểm lại một dữ kiện không đổi ngày nó vào kho, còn buộc
 * hai thứ vào nhau thì mỗi lần kiểm lại sẽ làm các lượt chạy TRƯỚC đó trông
 * như chưa từng biết dòng này.
 */
const RECORDED_ON = "2026-09-07";

type BenefitSeed = [
  benefit: string,
  numericValue?: number | null,
  opts?: {
    text?: string;
    minimumAnnualSpend?: number;
    provider?: string;
    /** Hạn của chính quyền lợi (khác `to`, là hạn của PHIÊN BẢN bản ghi). */
    endsOn?: string;
  /**
   * Hiệu lực của CHÍNH dòng này. Vắng thì lấy hằng mặc định của file.
   *
   * Có mặt vì đổi một sự thật là THÊM một phiên bản, không phải sửa số tại
   * chỗ. Không có nó thì mọi dòng dùng chung một hằng của file, và cách duy
   * nhất ghi lại một lần thay đổi là sửa hằng đó — tức ghi đè ngày hiệu lực
   * của MỌI dòng cùng lúc, xoá sạch lịch sử. Đây đúng là lỗi đã sửa cho phí
   * thường niên nhưng chưa lan sang các thực thể còn lại.
   */
  from?: string;
  to?: string;
  /** Ngày kiểm lại. Vắng thì lấy `from`. ĐỘC LẬP với ngày vào kho. */
  verifiedAt?: string;
  },
];

/**
 * Hãng mà quyền lợi hàng không của thẻ này gắn vào.
 *
 * Suy từ sản phẩm vì gần như mọi quyền lợi hàng không của một thẻ đều thuộc
 * cùng một hãng — thẻ Aeroplan® cho hành lý Air Canada®, thẻ United® cho hành
 * lý United®. Ghi đè bằng `opts.provider` khi một thẻ có quyền lợi của hãng
 * khác.
 *
 * `undefined` = thẻ không gắn hãng nào; quyền lợi của nó (travel credit, bảo
 * hiểm) không cần phân biệt nhà cung cấp.
 */
const PROVIDER_BY_PRODUCT: Record<string, string> = {
  "amex-aeroplan": "Air Canada®",
  "amex-aeroplan-reserve": "Air Canada®",
  "amex-aeroplan-business-reserve": "Air Canada®",
  "td-aeroplan-visa-infinite": "Air Canada®",
  "td-aeroplan-visa-infinite-privilege": "Air Canada®",
  "td-aeroplan-visa-platinum": "Air Canada®",
  "cibc-aeroplan-visa": "Air Canada®",
  "cibc-aeroplan-visa-infinite": "Air Canada®",
  "cibc-aeroplan-visa-infinite-privilege": "Air Canada®",
  "westjet-rbc-world-elite-mastercard": "WestJet®",
  "bmo-viporter-world-elite-mastercard": "Porter®",
  "united-mileageplus-neo-world-elite-mastercard": "United®",
  "amex-marriott-bonvoy": "Marriott Bonvoy®",
  "amex-marriott-bonvoy-business": "Marriott Bonvoy®",
};

/**
 * Quyền lợi gắn với một hãng cụ thể. Ngoài danh sách này thì `provider` là
 * `null` — bảo hiểm, travel credit, miễn phí thẻ phụ không thuộc về hãng nào,
 * và gán hãng cho chúng sẽ làm hai thẻ khác hãng trông như có hai quyền lợi
 * khác nhau.
 */
const PROVIDER_SCOPED = new Set([
  "free-checked-bag",
  "maple-leaf-lounge",
  "priority-boarding",
  "preferred-aeroplan-pricing",
  "companion-pass",
  "airline-status-credits",
  "hotel-status",
  "free-night-award",
  "elite-night-credits",
]);

function providerFor(slug: string, benefit: string): string | null {
  if (!PROVIDER_SCOPED.has(benefit)) return null;
  return PROVIDER_BY_PRODUCT[slug] ?? null;
}

const BY_PRODUCT: Record<string, BenefitSeed[]> = {
  "amex-green": [["free-supplementary-card"]],

  "amex-gold-rewards": [
    ["travel-credit", 100, { text: "Đặt qua American Express® Travel Online" }],
    ["nexus-credit", 50, { text: "Mỗi 4 năm" }],
    ["airport-lounge-passes", 4, { text: "Plaza Premium tại Canada" }],
    ["trip-cancellation-insurance", 1500],
    ["travel-medical-insurance", null, { text: "15 ngày, dưới 65 tuổi" }],
    ["rental-car-insurance"],
    ["free-supplementary-card", 1, { text: "Thẻ phụ đầu tiên" }],
  ],

  "amex-cobalt": [
    ["mobile-device-insurance", 1000],
    ["travel-medical-insurance", null, { text: "15 ngày tới $5 triệu, dưới 65 tuổi" }],
    ["free-supplementary-card"],
  ],

  "scotiabank-momentum-visa-infinite-plus": [
    ["travel-medical-insurance"],
    ["trip-cancellation-insurance"],
    ["mobile-device-insurance"],
  ],

  "cibc-aventura-gold-visa": [
    ["airport-lounge-passes", 4, { text: "Visa Airport Companion Program" }],
    ["nexus-credit", 160, { text: "4 năm một lần" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
  ],

  "scotiabank-gold-amex": [
    ["no-fx-fee"],
    ["airport-lounge-passes", null, { text: "Priority Pass — site không nêu số lượt" }],
    ["annual-fee-waiver-conditional", null, { text: "Khi có gói ngân hàng phù hợp" }],
  ],

  "scotiabank-scene-plus-visa-students": [["free-supplementary-card"]],

  "westjet-rbc-world-elite-mastercard": [
    // Voucher cấp lại MỖI NĂM khi chi đủ $5,000 — nên nó là quyền lợi có điều
    // kiện chi tiêu, không phải quyền lợi đương nhiên. Người chi $200/tháng
    // không bao giờ chạm tới, và `conditions` là chỗ duy nhất nói được điều đó.
    ["companion-pass", 119, { text: "Khứ hồi từ $119 chưa gồm thuế phí", minimumAnnualSpend: 5000 }],
    ["free-checked-bag", 8, { text: "Chủ thẻ và tối đa 8 người cùng booking" }],
    ["airport-lounge-passes", null, { text: "Mastercard® Travel Pass qua DragonPass" }],
    ["airline-status-credits", null, { text: "$200 tier qualifying spend cho mỗi $5,000 chi tiêu" }],
    ["travel-medical-insurance"],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
  ],

  "amex-aeroplan-reserve": [
    ["maple-leaf-lounge"],
    ["airport-lounge-passes", null, { text: "Priority Pass" }],
    ["priority-boarding", 8, { text: "Check-in, boarding và hành lý cho tối đa 8 người đi cùng" }],
    ["companion-pass", null, { minimumAnnualSpend: 25000 }],
    ["travel-medical-insurance", 5000000],
  ],

  "td-aeroplan-visa-infinite-privilege": [
    ["maple-leaf-lounge", 1, { text: "Không giới hạn, kèm 1 khách" }],
    ["airport-lounge-passes", 6, { text: "Visa Airport Companion Program" }],
    ["free-checked-bag", 8],
    ["nexus-credit", 100, { text: "Mỗi 48 tháng" }],
    ["travel-medical-insurance", null, { text: "31 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 2500],
  ],

  "td-aeroplan-visa-infinite": [
    ["free-checked-bag", 8],
    ["nexus-credit", 100, { text: "Mỗi 48 tháng" }],
    ["travel-medical-insurance", null, { text: "21 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 1500],
  ],

  "td-first-class-travel-visa-infinite": [
    ["travel-credit", 100, { text: "Khi đặt từ $500 qua Expedia® For TD" }],
    ["airport-lounge-passes", 4, { text: "Visa Airport Companion" }],
  ],

  "cibc-aventura-visa-infinite": [
    ["airport-lounge-passes", 4, { text: "Visa Airport Companion Program" }],
    ["nexus-credit", 160, { text: "4 năm một lần" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
  ],

  "amex-aeroplan-business-reserve": [
    ["maple-leaf-lounge", 1, { text: "Không giới hạn cho chủ thẻ và 1 khách, kèm Air Canada® Café" }],
    ["free-checked-bag", 8],
    ["nexus-credit", 100, { text: "Mỗi 4 năm" }],
    ["companion-pass", 99, { text: "Worldwide Companion Pass từ $99", minimumAnnualSpend: 25000 }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $5,000 chi tiêu, tối đa 25,000/năm" }],
  ],

  "amex-marriott-bonvoy-business": [
    ["free-night-award", 1],
    ["elite-night-credits", 15],
    ["hotel-status", null, { text: "Đủ điều kiện lên Gold Elite" }],
  ],

  "national-bank-world-elite-mastercard": [
    ["travel-credit", 150],
    ["airport-lounge-passes", null, { text: "Phòng chờ National Bank® tại Montréal-Trudeau, không giới hạn" }],
    ["travel-medical-insurance", null, { text: "60 ngày, dưới 55 tuổi" }],
    ["trip-cancellation-insurance", 2500],
    ["mobile-device-insurance", 1000],
  ],

  "td-cash-back-visa-infinite": [
    ["travel-medical-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
  ],

  "wealthsimple-visa-infinite-privilege": [
    ["airport-lounge-passes", 6, { text: "DragonPass" }],
    ["no-fx-fee"],
    ["rental-car-insurance", 65000, { text: "31 ngày, xe đến $65,000" }],
    ["trip-cancellation-insurance", 1500],
    ["travel-medical-insurance", 2000000, { text: "14 ngày, dưới 65 tuổi" }],
    ["annual-fee-waiver-conditional", null, { text: "Hạng Premium/Generation hoặc chuyển ≥$4,000/tháng" }],
  ],

  "wealthsimple-visa-infinite-plus": [
    ["no-fx-fee"],
    ["travel-medical-insurance", 2000000, { text: "14 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 1000],
    ["mobile-device-insurance", 1000],
    ["annual-fee-waiver-conditional", null, { text: "Hạng Premium/Generation hoặc chuyển ≥$4,000/tháng" }],
    ["free-supplementary-card"],
  ],

  "rbc-avion-visa-infinite-privilege": [
    ["airport-lounge-passes", 6, { text: "DragonPass" }],
    ["travel-medical-insurance", null, { text: "31 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 2500],
  ],

  // TD® Aeroplan® Visa Platinum*: site chỉ nêu bảo hiểm trễ chuyến, thất lạc
  // hành lý và bảo vệ mua sắm — chưa quyền lợi nào trong từ điển. Để trống
  // thay vì gán bừa vào một slug gần đúng.
  "td-aeroplan-visa-platinum": [],

  "amex-aeroplan": [
    ["free-checked-bag", 9, { text: "Đến 23kg, tối đa 9 người trên cùng booking" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $20,000 chi tiêu, tối đa 25,000/năm" }],
  ],

  "bmo-viporter-world-elite-mastercard": [
    ["companion-pass", null, { text: "Khứ hồi $0 base fare trên Porter", minimumAnnualSpend: 9000 }],
    ["free-checked-bag", 8, { text: "Ký gửi và xách tay, tối đa 8 khách đi cùng" }],
    ["airport-lounge-passes", null, { text: "Mastercard® Travel Pass" }],
  ],

  "united-mileageplus-neo-world-elite-mastercard": [
    ["free-checked-bag", 1, { text: "Chỉ chủ thẻ chính, trên chuyến bay United®" }],
    ["priority-boarding", null, { text: "Nhóm 2, cho chủ thẻ và người cùng đặt vé" }],
  ],

  "amex-marriott-bonvoy": [
    ["hotel-status", null, { text: "Silver Elite; Gold Elite khi chi $30,000/năm" }],
    ["free-night-award", 1],
    ["elite-night-credits", 15],
  ],

  "scotiabank-passport-visa-infinite": [
    ["no-fx-fee"],
    ["airport-lounge-passes", 6, { text: "Visa Airport Companion Program" }],
    ["free-supplementary-card", 1, { text: "Thẻ phụ đầu tiên" }],
    ["travel-medical-insurance", null, { text: "Cho chủ thẻ đến 75 tuổi" }],
  ],

  "rbc-avion-visa-infinite": [
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp không giới hạn" }],
  ],

  // RBC® Avion® Visa Platinum: site không nêu quyền lợi nào ngoài cách đổi
  // điểm và điều kiện thu nhập.
  "rbc-avion-visa-platinum": [],

  "amex-platinum": [
    ["airport-lounge-passes", null, { text: "Global Lounge Collection™, hơn 1,400 phòng chờ" }],
    ["travel-credit", 200],
    ["nexus-credit", 100, { text: "Mỗi 4 năm" }],
    ["hotel-status", null, { text: "Hilton Honors™ Gold và Marriott Bonvoy™ Gold" }],
    ["travel-medical-insurance", null, { text: "15 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 2500],
  ],

  "amex-business-platinum": [
    ["airport-lounge-passes", null, { text: "Global Lounge Collection™, hơn 1,400 phòng chờ" }],
    ["travel-credit", 200],
    ["nexus-credit", 100, { text: "Mỗi 4 năm" }],
    ["hotel-status", null, { text: "Marriott Bonvoy® Gold Elite khi chi $30,000 hoặc ở 10 đêm", provider: "Marriott Bonvoy®", minimumAnnualSpend: 30000 }],
    ["elite-night-credits", 15, { provider: "Marriott Bonvoy®" }],
    ["free-night-award", 1, { text: "Tới 35,000 điểm Bonvoy®", provider: "Marriott Bonvoy®" }],
    ["travel-medical-insurance", 5000000, { text: "15 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 1500],
    ["mobile-device-insurance", 1500],
    ["rental-car-insurance", 85000],
  ],

  "amex-business-gold": [
    ["mobile-device-insurance", 1000],
    ["rental-car-insurance"],
  ],

  "cibc-aeroplan-visa": [["rental-car-insurance"]],

  "cibc-aeroplan-visa-infinite": [
    ["free-checked-bag", 8, { text: "Chủ thẻ, thẻ phụ và tối đa 8 người đi cùng" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $20,000 chi tiêu, tối đa 25,000/năm" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
  ],

  "cibc-aeroplan-visa-infinite-privilege": [
    // Hạn 31/12/2026 nằm trong `effectiveTo`, KHÔNG chỉ trong chữ: một quyền
    // lợi hết hạn mà `effectiveTo: null` sẽ được engine cộng vào giá trị thẻ
    // mãi mãi, và không phép kiểm nào thấy vì hạn đó chỉ là một câu tiếng Việt.
    ["maple-leaf-lounge", 1, { text: "Kèm 1 khách", endsOn: "2026-12-31" }],
    ["airport-lounge-passes", 6, { text: "Visa Airport Companion Program, mỗi chủ thẻ" }],
    ["free-checked-bag", 8, { text: "Kèm Priority Check-in, Boarding và Baggage" }],
    ["companion-pass", 99, { text: "Toàn cầu, từ $99 đến tối đa $599 chưa gồm thuế phí", minimumAnnualSpend: 25000 }],
    ["nexus-credit", 160, { text: "Mỗi 4 năm" }],
    ["hotel-status", null, { text: "World of Hyatt® Discoverist, kèm 5 đêm tính hạng mỗi năm" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $5,000 chi tiêu, tối đa 25,000/năm" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
  ],
};

export const PRODUCT_BENEFITS: ProductBenefit[] = Object.entries(BY_PRODUCT).flatMap(
  ([slug, seeds]) =>
    seeds.map(([benefit, numericValue, opts]) => ({
      // Id mang NGÀY HIỆU LỰC: quyền lợi đổi thì bản mới nằm cạnh bản cũ, và
      // không có ngày trong id thì hai bản trùng id — hoặc validator đỏ, hoặc
      // người sửa lặng lẽ đè lên bản cũ. Xem "LUẬT VỀ ID" trong types.ts.
      id: makeId<ProductBenefitId>("pb", productIdFor(slug), benefit, opts?.from ?? VERIFIED_ON),
      productId: productIdFor(slug),
      benefitId: benefit as BenefitId,
      numericValue: numericValue ?? null,
      textValue: opts?.text ?? null,
      conditions:
        opts?.minimumAnnualSpend === undefined
          ? null
          : { minimumAnnualSpend: opts.minimumAnnualSpend },
      // Hãng cấp quyền lợi. Hai thẻ cùng cho "miễn hành lý ký gửi" nhưng khác
      // hãng thì KHÔNG trùng nhau — xem chú thích `ProductBenefit.provider`.
      // CHỈ gán cho quyền lợi thật sự gắn với một hãng. Bản trước rải
      // `PROVIDER_BY_PRODUCT[slug]` lên MỌI quyền lợi của thẻ, nên bảo hiểm y
      // tế du lịch của thẻ TD® Aeroplan® mang provider "Air Canada®" — vô
      // nghĩa, và tệ hơn: hai thẻ khác hãng có cùng bảo hiểm sẽ trông như hai
      // quyền lợi KHÁC nhau, nên engine cộng cả hai vào giá trị gia tăng.
      provider: opts?.provider ?? providerFor(slug, benefit),
      effectiveFrom: opts?.from ?? VERIFIED_ON,
      // `to` đóng PHIÊN BẢN bản ghi (quyền lợi đổi giá trị); `endsOn` là hạn
      // của chính quyền lợi. Cái nào tới trước thì thắng.
      effectiveTo:
        opts?.to !== undefined && opts?.endsOn !== undefined
          ? opts.to < opts.endsOn
            ? opts.to
            : opts.endsOn
          : (opts?.to ?? opts?.endsOn ?? null),
      sourceUrl: `https://ghe1a.com/credit-cards/${slug}`,
      sourceKind: "ghe1a",
      verifiedAt: opts?.verifiedAt ?? opts?.from ?? VERIFIED_ON,
      recordedAt: opts?.from ?? RECORDED_ON,
      confidence: "verified",
    })),
);
