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
 * — không suy ra từ hiểu biết chung về thẻ. NGOẠI LỆ duy nhất: dòng có `source`
 * là dòng đọc THẲNG từ trang chính chủ của ngân hàng (`sourceKind: "issuer"`),
 * thêm 04/10/2026 để lấp các ô "Chưa kiểm" của Thông tin nhanh. Vẫn không suy
 * đoán: trang ngân hàng không nêu số thì `numericValue` để `null`. "Ưu tiên hành lý" trên Amex®
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
  /**
   * URL trang chính chủ mà dòng này được đọc từ đó. Có thì `sourceKind` là
   * `issuer` — `audit:reco-data` không đòi số của dòng này có trong Contentful
   * (nó chưa bao giờ đến từ đó) mà canh bằng ngày kiểm.
   */
  source?: string;
  },
];

/** Ngày kiểm tại trang chính chủ của đợt lấp "Chưa kiểm" (04/10/2026). */
const ISSUER_CHECK = "2026-10-04";
/** Ngày cuối của bản ghi cũ khi đợt kiểm đó SỬA một dòng: bản cũ đóng lại,
 *  bản mới nằm cạnh — xem chú thích `from` ở trên. */
const BEFORE_ISSUER_CHECK = "2026-10-03";

type SeedOpts = NonNullable<BenefitSeed[2]>;
/** Một dòng đọc từ trang ngân hàng ngày `ISSUER_CHECK`. */
const issuer = (url: string, extra: Omit<SeedOpts, "source" | "from"> = {}): SeedOpts => ({
  ...extra,
  source: url,
  from: ISSUER_CHECK,
});

const amexUrl = (path: string) => `https://www.americanexpress.com/en-ca/${path}/`;
const scotiaUrl = (path: string) => `https://www.scotiabank.com/ca/en/personal/credit-cards/${path}.html`;
const tdUrl = (path: string) => `https://www.td.com/ca/en/personal-banking/products/credit-cards/${path}`;
const rbcUrl = (path: string) => `https://www.rbcroyalbank.com/credit-cards/travel/${path}.html`;
const cibcUrl = (path: string) => `https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/${path}.html`;

const SRC = {
  amexGold: amexUrl("credit-cards/gold-rewards-card"),
  amexCobalt: amexUrl("credit-cards/cobalt-card"),
  amexAeroplanReserve: amexUrl("credit-cards/aeroplan-reserve"),
  amexAeroplan: amexUrl("charge-cards/aeroplan-card"),
  amexBonvoy: amexUrl("credit-cards/marriott-bonvoy-card"),
  amexAeroplanBizReserve: amexUrl("credit-cards/aeroplan-business-reserve-card"),
  amexBonvoyBiz: amexUrl("credit-cards/marriott-bonvoy-business-card"),
  amexBizGold: amexUrl("charge-cards/small-business-gold-card"),
  amexPlatinum: amexUrl("charge-cards/the-platinum-card"),
  amexBizPlatinum: amexUrl("charge-cards/small-business-platinum-card"),
  scotiaGold: scotiaUrl("american-express/gold-card"),
  scotiaMomentum: scotiaUrl("visa/momentum-infinite-card"),
  scotiaPassport: scotiaUrl("visa/passport-infinite-card"),
  tdAeroplanInfinite: tdUrl("aeroplan/aeroplan-visa-infinite-card"),
  tdAeroplanPrivilege: tdUrl("aeroplan/aeroplan-visa-infinite-privilege-card"),
  tdAeroplanPlatinum: tdUrl("aeroplan/aeroplan-visa-platinum-card"),
  tdFirstClass: tdUrl("travel-rewards/first-class-travel-visa-infinite-card"),
  tdCashBack: tdUrl("cash-back/cash-back-visa-infinite-card"),
  westjetRbc: rbcUrl("westjet-rbc-world-elite-mastercard"),
  avionInfinite: rbcUrl("rbc-avion-visa-infinite"),
  avionPlatinum: rbcUrl("rbc-avion-visa-platinum"),
  avionPrivilege: rbcUrl("rbc-avion-visa-infinite-privilege"),
  cibcAeroplanInfinite: cibcUrl("aeroplan-visa-infinite-card"),
  cibcAeroplanPrivilege: cibcUrl("aeroplan-visa-infinite-privilege-card"),
  cibcAventuraGold: cibcUrl("aventura-gold-visa-card"),
  cibcAventuraInfinite: cibcUrl("aventura-visa-infinite-card"),
  // Số bảo hiểm của BMO® lấy từ bản tóm tắt bảo hiểm chính chủ (PDF), trang thẻ
  // chỉ liệt kê tên.
  viporter: "https://www.bmo.com/en-ca/main/personal/credit-cards/bmo-viporter-world-elite-mastercard/",
  viporterInsurance: "https://www.bmo.com/pdf/VIPorter_WE_Product-Summary-en.pdf",
  neoUnited: "https://www.neofinancial.com/credit-cards/neo-united-mastercard",
  wealthsimple: "https://www.wealthsimple.com/en-ca/wealthsimple-visa-infinite-card",
  nationalBank: "https://www.nbc.ca/personal/mastercard-credit-cards/world-elite.html",
  tangerine: "https://www.tangerine.ca/en/personal/spend/credit-cards/world-elite-mastercard",
};

/** Xe thuê của thẻ Amex®: MSRP tới $85,000, tối đa 48 ngày (cùng một mức). */
const AMEX_RENTAL = { text: "xe tới $85,000, tối đa 48 ngày" };

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
    ["flight-delay-insurance", 500, issuer(SRC.amexGold, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 500, issuer(SRC.amexGold, { text: "thất lạc, mỗi chuyến" })],
  ],

  "amex-cobalt": [
    ["mobile-device-insurance", 1000],
    ["travel-medical-insurance", null, { text: "15 ngày tới $5 triệu, dưới 65 tuổi" }],
    ["free-supplementary-card"],
    ["flight-delay-insurance", 500, issuer(SRC.amexCobalt, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 500, issuer(SRC.amexCobalt, { text: "thất lạc, mỗi chuyến" })],
    ["rental-car-insurance", 85000, issuer(SRC.amexCobalt, AMEX_RENTAL)],
  ],

  "scotiabank-momentum-visa-infinite-plus": [
    ["travel-medical-insurance"],
    ["trip-cancellation-insurance"],
    ["mobile-device-insurance"],
    ["flight-delay-insurance", 500, issuer(SRC.scotiaMomentum)],
    ["baggage-insurance", 500, issuer(SRC.scotiaMomentum, { text: "trễ hoặc thất lạc" })],
    ["rental-car-insurance", null, issuer(SRC.scotiaMomentum)],
  ],

  "cibc-aventura-gold-visa": [
    ["airport-lounge-passes", 4, { text: "Visa Airport Companion Program" }],
    ["nexus-credit", 160, { text: "4 năm một lần" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
    ["flight-delay-insurance", null, issuer(SRC.cibcAventuraGold)],
    ["baggage-insurance", null, issuer(SRC.cibcAventuraGold)],
  ],

  "scotiabank-gold-amex": [
    ["no-fx-fee"],
    ["airport-lounge-passes", null, { text: "Priority Pass — site không nêu số lượt", to: BEFORE_ISSUER_CHECK }],
    // Trang Scotiabank®: chủ thẻ được GIẢM GIÁ thẻ hội viên Priority Pass — thẻ
    // không kèm lượt miễn phí nào.
    ["airport-lounge-passes", 0, issuer(SRC.scotiaGold, { text: "Giảm giá thẻ hội viên Priority Pass" })],
    ["annual-fee-waiver-conditional", null, { text: "Khi có gói ngân hàng phù hợp" }],
    ["travel-medical-insurance", 1000000, issuer(SRC.scotiaGold, { text: "25 ngày nếu dưới 65 tuổi, 3 ngày từ 65 tuổi" })],
    ["trip-cancellation-insurance", 1500, issuer(SRC.scotiaGold)],
    ["flight-delay-insurance", 500, issuer(SRC.scotiaGold)],
    ["baggage-insurance", 1000, issuer(SRC.scotiaGold, { text: "trễ hoặc thất lạc" })],
    ["rental-car-insurance", null, issuer(SRC.scotiaGold)],
    ["mobile-device-insurance", 1000, issuer(SRC.scotiaGold)],
  ],

  "scotiabank-scene-plus-visa-students": [["free-supplementary-card"]],

  "westjet-rbc-world-elite-mastercard": [
    // Voucher cấp lại MỖI NĂM khi chi đủ $5,000 — nên nó là quyền lợi có điều
    // kiện chi tiêu, không phải quyền lợi đương nhiên. Người chi $200/tháng
    // không bao giờ chạm tới, và `conditions` là chỗ duy nhất nói được điều đó.
    ["companion-pass", 119, { text: "Khứ hồi từ $119 chưa gồm thuế phí", minimumAnnualSpend: 5000 }],
    ["free-checked-bag", 8, { text: "Chủ thẻ và tối đa 8 người cùng booking" }],
    ["airport-lounge-passes", null, { text: "Mastercard® Travel Pass qua DragonPass", to: BEFORE_ISSUER_CHECK }],
    // Điều khoản RBC®: vào phòng chờ DragonPass mất US$32 mỗi người mỗi lượt.
    ["airport-lounge-passes", 0, issuer(SRC.westjetRbc, { text: "Mastercard® Travel Pass qua DragonPass" })],
    ["airline-status-credits", null, { text: "$200 tier qualifying spend cho mỗi $5,000 chi tiêu" }],
    ["travel-medical-insurance"],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
    ["flight-delay-insurance", null, issuer(SRC.westjetRbc)],
    ["baggage-insurance", null, issuer(SRC.westjetRbc, { text: "chỉ khi trễ" })],
  ],

  "amex-aeroplan-reserve": [
    ["maple-leaf-lounge", 1, { text: "Không giới hạn tại Bắc Mỹ, kèm 1 khách và Air Canada® Café" }],
    ["airport-lounge-passes", null, { text: "Priority Pass — site không nêu số lượt", to: BEFORE_ISSUER_CHECK }],
    // amex.ca: miễn phí thẻ hội viên Priority Pass US$99, "each lounge visit is
    // subject to a usage fee".
    ["airport-lounge-passes", 0, issuer(SRC.amexAeroplanReserve, { text: "Priority Pass" })],
    ["priority-boarding", 8, { text: "Check-in, boarding và hành lý cho tối đa 8 người đi cùng" }],
    ["free-checked-bag", 8],
    ["companion-pass", 99, { text: "Toàn cầu, từ $99 đến tối đa $599 chưa gồm thuế phí", minimumAnnualSpend: 25000 }],
    ["nexus-credit", 100, { text: "Mỗi 4 năm" }],
    ["hotel-status", null, { text: "World of Hyatt® Discoverist, kèm 5 đêm tính hạng mỗi năm" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $5,000 chi tiêu, tối đa 25,000/năm" }],
    ["travel-medical-insurance", 5000000],
    ["trip-cancellation-insurance", 1500, issuer(SRC.amexAeroplanReserve)],
    ["flight-delay-insurance", 1000, issuer(SRC.amexAeroplanReserve, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 1000, issuer(SRC.amexAeroplanReserve, { text: "thất lạc, mỗi chuyến" })],
    ["rental-car-insurance", 85000, issuer(SRC.amexAeroplanReserve, AMEX_RENTAL)],
  ],

  "td-aeroplan-visa-infinite-privilege": [
    ["maple-leaf-lounge", 1, { text: "Không giới hạn, kèm 1 khách" }],
    ["airport-lounge-passes", 6, { text: "Visa Airport Companion Program" }],
    ["free-checked-bag", 8],
    ["nexus-credit", 100, { text: "Mỗi 48 tháng" }],
    ["travel-medical-insurance", null, { text: "31 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 2500],
    ["flight-delay-insurance", 1000, issuer(SRC.tdAeroplanPrivilege)],
    ["baggage-insurance", 2500, issuer(SRC.tdAeroplanPrivilege, { text: "thất lạc; trễ tới $1,000" })],
  ],

  "td-aeroplan-visa-infinite": [
    ["free-checked-bag", 8],
    ["nexus-credit", 100, { text: "Mỗi 48 tháng" }],
    ["travel-medical-insurance", null, { text: "21 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 1500],
    ["flight-delay-insurance", 500, issuer(SRC.tdAeroplanInfinite)],
    ["baggage-insurance", 1000, issuer(SRC.tdAeroplanInfinite, { text: "trễ hoặc thất lạc" })],
    ["rental-car-insurance", null, issuer(SRC.tdAeroplanInfinite, { text: "tối đa 48 ngày" })],
    ["mobile-device-insurance", 1000, issuer(SRC.tdAeroplanInfinite)],
  ],

  "td-first-class-travel-visa-infinite": [
    ["travel-credit", 100, { text: "Khi đặt từ $500 qua Expedia® For TD" }],
    ["airport-lounge-passes", 4, { text: "Visa Airport Companion" }],
    ["travel-medical-insurance", 2000000, issuer(SRC.tdFirstClass, { text: "21 ngày đầu; 4 ngày nếu từ 65 tuổi" })],
    ["trip-cancellation-insurance", 1500, issuer(SRC.tdFirstClass)],
    ["flight-delay-insurance", 500, issuer(SRC.tdFirstClass)],
    ["baggage-insurance", 1000, issuer(SRC.tdFirstClass, { text: "trễ hoặc thất lạc" })],
    ["rental-car-insurance", null, issuer(SRC.tdFirstClass, { text: "tối đa 48 ngày" })],
    ["mobile-device-insurance", 1000, issuer(SRC.tdFirstClass)],
  ],

  "cibc-aventura-visa-infinite": [
    ["airport-lounge-passes", 4, { text: "Visa Airport Companion Program" }],
    ["nexus-credit", 160, { text: "4 năm một lần" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
    ["flight-delay-insurance", null, issuer(SRC.cibcAventuraInfinite)],
    ["baggage-insurance", null, issuer(SRC.cibcAventuraInfinite)],
  ],

  "amex-aeroplan-business-reserve": [
    // "Không giới hạn" là số LƯỢT, không phải số lounge: amex.ca viết "select
    // Air Canada Maple Leaf Lounges", còn trang co-brand của Air Canada® viết
    // thẳng "Unlimited Maple Leaf Lounge Access in North America". Hai câu
    // không chọi nhau — vào không giới hạn lượt, ở nhóm lounge Bắc Mỹ. Đã gỡ
    // nhầm chữ "không giới hạn" ngày 08/09/2026 rồi trả lại cùng ngày.
    ["maple-leaf-lounge", 1, { text: "Không giới hạn tại Bắc Mỹ, kèm 1 khách và Air Canada® Café" }],
    ["airport-lounge-passes", null, { text: "Priority Pass — site không nêu số lượt", to: BEFORE_ISSUER_CHECK }],
    // Điều khoản Priority Pass trên amex.ca: "All lounge visits are subject to
    // a usage fee at the prevailing rate".
    ["airport-lounge-passes", 0, issuer(SRC.amexAeroplanBizReserve, { text: "Priority Pass" })],
    ["free-checked-bag", 8],
    ["nexus-credit", 100, { text: "Mỗi 4 năm" }],
    ["companion-pass", 99, { text: "Worldwide Companion Pass từ $99", minimumAnnualSpend: 25000 }],
    ["hotel-status", null, { text: "World of Hyatt® Discoverist, kèm 5 đêm tính hạng mỗi năm" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $5,000 chi tiêu, tối đa 25,000/năm" }],
    ["travel-medical-insurance", 5000000, issuer(SRC.amexAeroplanBizReserve, { text: "15 ngày, dưới 65 tuổi" })],
    ["trip-cancellation-insurance", 1500, issuer(SRC.amexAeroplanBizReserve)],
    ["flight-delay-insurance", 1000, issuer(SRC.amexAeroplanBizReserve, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 1000, issuer(SRC.amexAeroplanBizReserve, { text: "thất lạc, mỗi chuyến" })],
    ["rental-car-insurance", 85000, issuer(SRC.amexAeroplanBizReserve, AMEX_RENTAL)],
  ],

  "amex-marriott-bonvoy-business": [
    ["free-night-award", 1],
    ["elite-night-credits", 15],
    ["hotel-status", null, { text: "Đủ điều kiện lên Gold Elite" }],
    ["flight-delay-insurance", 500, issuer(SRC.amexBonvoyBiz, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 500, issuer(SRC.amexBonvoyBiz, { text: "thất lạc, mỗi chuyến" })],
    ["rental-car-insurance", 85000, issuer(SRC.amexBonvoyBiz, AMEX_RENTAL)],
  ],

  "national-bank-world-elite-mastercard": [
    ["travel-credit", 150],
    ["airport-lounge-passes", null, { text: "Phòng chờ National Bank® tại Montréal-Trudeau, không giới hạn" }],
    ["travel-medical-insurance", null, { text: "60 ngày, dưới 55 tuổi" }],
    ["trip-cancellation-insurance", 2500],
    ["mobile-device-insurance", 1000],
    ["flight-delay-insurance", 500, issuer(SRC.nationalBank)],
    ["baggage-insurance", 1000, issuer(SRC.nationalBank, { text: "mất cắp hoặc thất lạc; trễ tới $500" })],
  ],

  "td-cash-back-visa-infinite": [
    ["travel-medical-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
    ["baggage-insurance", 1000, issuer(SRC.tdCashBack, { text: "trễ hoặc thất lạc" })],
  ],

  "wealthsimple-visa-infinite-privilege": [
    ["airport-lounge-passes", 6, { text: "DragonPass" }],
    ["no-fx-fee"],
    ["rental-car-insurance", 65000, { text: "31 ngày, xe đến $65,000" }],
    ["trip-cancellation-insurance", 1500],
    ["travel-medical-insurance", 2000000, { text: "14 ngày, dưới 65 tuổi" }],
    ["annual-fee-waiver-conditional", null, { text: "Hạng Premium/Generation hoặc chuyển ≥$4,000/tháng" }],
    ["baggage-insurance", 1250, issuer(SRC.wealthsimple, { text: "trễ hoặc thất lạc, mỗi chuyến" })],
  ],

  "wealthsimple-visa-infinite-plus": [
    ["no-fx-fee"],
    // Nội dung site ghi $2M (bản của thẻ Privilege). Bảng so sánh trên
    // wealthsimple.com 04/10/2026: Visa Infinite + là $1,000,000, Privilege
    // $2,000,000. Bản cũ đóng lại; `keyBenefitsVi` sửa theo cùng ngày.
    ["travel-medical-insurance", 2000000, { text: "14 ngày, dưới 65 tuổi", to: BEFORE_ISSUER_CHECK }],
    ["travel-medical-insurance", 1000000, issuer(SRC.wealthsimple)],
    ["baggage-insurance", 1000, issuer(SRC.wealthsimple, { text: "trễ hoặc thất lạc, mỗi chuyến" })],
    ["trip-cancellation-insurance", 1000],
    ["mobile-device-insurance", 1000],
    ["annual-fee-waiver-conditional", null, { text: "Hạng Premium/Generation hoặc chuyển ≥$4,000/tháng" }],
    ["free-supplementary-card"],
  ],

  "rbc-avion-visa-infinite-privilege": [
    ["airport-lounge-passes", 6, { text: "DragonPass" }],
    ["travel-medical-insurance", null, { text: "31 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 2500],
    ["flight-delay-insurance", null, issuer(SRC.avionPrivilege)],
    ["baggage-insurance", null, issuer(SRC.avionPrivilege, { text: "chỉ khi trễ" })],
  ],

  // TD® Aeroplan® Visa Platinum*: y tế du lịch và huỷ chuyến chỉ là bảo hiểm
  // MUA THÊM, không đi kèm thẻ — nên không có dòng nào cho hai loại đó.
  "td-aeroplan-visa-platinum": [
    ["flight-delay-insurance", 500, issuer(SRC.tdAeroplanPlatinum)],
    ["baggage-insurance", 1000, issuer(SRC.tdAeroplanPlatinum, { text: "trễ hoặc thất lạc" })],
    ["rental-car-insurance", null, issuer(SRC.tdAeroplanPlatinum, { text: "tối đa 48 ngày" })],
    ["mobile-device-insurance", 1000, issuer(SRC.tdAeroplanPlatinum)],
  ],

  "amex-aeroplan": [
    ["free-checked-bag", 9, { text: "Đến 23kg, tối đa 9 người trên cùng booking" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $20,000 chi tiêu, tối đa 25,000/năm" }],
    ["flight-delay-insurance", 500, issuer(SRC.amexAeroplan, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 500, issuer(SRC.amexAeroplan, { text: "thất lạc, mỗi chuyến" })],
    ["rental-car-insurance", 85000, issuer(SRC.amexAeroplan, AMEX_RENTAL)],
  ],

  "bmo-viporter-world-elite-mastercard": [
    ["companion-pass", null, { text: "Khứ hồi $0 base fare trên Porter®", minimumAnnualSpend: 9000 }],
    ["free-checked-bag", 8, { text: "Ký gửi và xách tay, tối đa 8 khách đi cùng" }],
    ["airport-lounge-passes", null, { text: "Mastercard® Travel Pass", to: BEFORE_ISSUER_CHECK }],
    // Trang BMO®: "lounge access for a fee of just US$32 per person, per visit".
    ["airport-lounge-passes", 0, issuer(SRC.viporter, { text: "Mastercard® Travel Pass qua DragonPass" })],
    ["travel-medical-insurance", 5000000, issuer(SRC.viporterInsurance, { text: "21 ngày, từ 64 tuổi trở xuống" })],
    ["trip-cancellation-insurance", 1500, issuer(SRC.viporterInsurance)],
    ["flight-delay-insurance", 500, issuer(SRC.viporterInsurance)],
    ["baggage-insurance", 500, issuer(SRC.viporterInsurance, { text: "thất lạc, tối đa $1,000 mỗi chuyến" })],
    ["rental-car-insurance", 65000, issuer(SRC.viporterInsurance, { text: "xe tới $65,000, tối đa 48 ngày" })],
  ],

  "united-mileageplus-neo-world-elite-mastercard": [
    ["free-checked-bag", 1, { text: "Chỉ chủ thẻ chính, trên chuyến bay United®" }],
    ["priority-boarding", null, { text: "Nhóm 2, cho chủ thẻ và người cùng đặt vé" }],
    // Trang Neo chỉ liệt kê tên, không nêu hạn mức; bảo hiểm không áp dụng ở
    // Quebec.
    ["travel-medical-insurance", null, issuer(SRC.neoUnited, { text: "không áp dụng ở Quebec" })],
    ["trip-cancellation-insurance", null, issuer(SRC.neoUnited, { text: "Neo™ gọi là trip protection" })],
    ["baggage-insurance", null, issuer(SRC.neoUnited, { text: "trễ hoặc thất lạc" })],
    ["rental-car-insurance", null, issuer(SRC.neoUnited)],
  ],

  "amex-marriott-bonvoy": [
    ["hotel-status", null, { text: "Silver Elite; Gold Elite khi chi $30,000/năm" }],
    ["free-night-award", 1],
    ["elite-night-credits", 15],
    ["flight-delay-insurance", 500, issuer(SRC.amexBonvoy, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 500, issuer(SRC.amexBonvoy, { text: "thất lạc, mỗi chuyến" })],
    ["rental-car-insurance", 85000, issuer(SRC.amexBonvoy, AMEX_RENTAL)],
  ],

  "scotiabank-passport-visa-infinite": [
    ["no-fx-fee"],
    ["airport-lounge-passes", 6, { text: "Visa Airport Companion Program" }],
    ["free-supplementary-card", 1, { text: "Thẻ phụ đầu tiên" }],
    ["travel-medical-insurance", null, { text: "Cho chủ thẻ đến 75 tuổi" }],
    ["flight-delay-insurance", 500, issuer(SRC.scotiaPassport)],
    ["baggage-insurance", 1000, issuer(SRC.scotiaPassport, { text: "trễ hoặc thất lạc" })],
  ],

  "tangerine-rewards-world-elite-mastercard": [
    ["airport-lounge-passes", 4, { text: "DragonPass qua Mastercard® Travel Pass", from: "2026-09-25" }],
    ["travel-medical-insurance", null, { text: "15 ngày tới $5,000,000, dưới 65 tuổi", from: "2026-09-25" }],
    ["trip-cancellation-insurance", 2000, { from: "2026-09-25" }],
    ["rental-car-insurance", null, { from: "2026-09-25" }],
    ["mobile-device-insurance", null, { from: "2026-09-25" }],
    ["flight-delay-insurance", null, issuer(SRC.tangerine)],
    ["baggage-insurance", null, issuer(SRC.tangerine, { text: "trễ hoặc thất lạc" })],
  ],

  "rbc-avion-visa-infinite": [
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp không giới hạn" }],
    ["trip-cancellation-insurance", null, issuer(SRC.avionInfinite)],
    ["flight-delay-insurance", null, issuer(SRC.avionInfinite)],
    ["baggage-insurance", null, issuer(SRC.avionInfinite, { text: "chỉ khi trễ" })],
    ["rental-car-insurance", null, issuer(SRC.avionInfinite)],
    ["mobile-device-insurance", null, issuer(SRC.avionInfinite)],
  ],

  // RBC® Avion® Visa Platinum: không có y tế du lịch; trang RBC® liệt kê tên
  // các bảo hiểm còn lại, không nêu hạn mức.
  "rbc-avion-visa-platinum": [
    ["trip-cancellation-insurance", null, issuer(SRC.avionPlatinum)],
    ["flight-delay-insurance", null, issuer(SRC.avionPlatinum)],
    ["baggage-insurance", null, issuer(SRC.avionPlatinum, { text: "chỉ khi trễ" })],
    ["rental-car-insurance", null, issuer(SRC.avionPlatinum)],
    ["mobile-device-insurance", null, issuer(SRC.avionPlatinum)],
  ],

  "amex-platinum": [
    ["airport-lounge-passes", null, { text: "Global Lounge Collection™, hơn 1,400 phòng chờ" }],
    ["travel-credit", 200],
    ["nexus-credit", 100, { text: "Mỗi 4 năm" }],
    ["hotel-status", null, { text: "Hilton Honors™ Gold và Marriott Bonvoy™ Gold" }],
    ["travel-medical-insurance", null, { text: "15 ngày, dưới 65 tuổi" }],
    ["trip-cancellation-insurance", 2500],
    ["flight-delay-insurance", null, issuer(SRC.amexPlatinum)],
    ["baggage-insurance", null, issuer(SRC.amexPlatinum, { text: "trễ hoặc thất lạc" })],
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
    ["flight-delay-insurance", null, issuer(SRC.amexBizPlatinum)],
    ["baggage-insurance", null, issuer(SRC.amexBizPlatinum, { text: "trễ hoặc thất lạc" })],
  ],

  "amex-business-gold": [
    ["mobile-device-insurance", 1000],
    ["rental-car-insurance"],
    ["flight-delay-insurance", 500, issuer(SRC.amexBizGold, { text: "gộp với trễ hành lý" })],
    ["baggage-insurance", 500, issuer(SRC.amexBizGold, { text: "thất lạc, mỗi chuyến" })],
  ],

  "cibc-aeroplan-visa": [["rental-car-insurance"]],

  "cibc-aeroplan-visa-infinite": [
    ["free-checked-bag", 8, { text: "Chủ thẻ, thẻ phụ và tối đa 8 người đi cùng" }],
    ["airline-status-credits", 25000, { text: "1,000 SQC cho mỗi $20,000 chi tiêu, tối đa 25,000/năm" }],
    ["travel-medical-insurance", null, { text: "Y tế khẩn cấp ngoài tỉnh" }],
    ["trip-cancellation-insurance"],
    ["rental-car-insurance"],
    ["mobile-device-insurance"],
    ["flight-delay-insurance", null, issuer(SRC.cibcAeroplanInfinite)],
    ["baggage-insurance", null, issuer(SRC.cibcAeroplanInfinite)],
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
    ["flight-delay-insurance", null, issuer(SRC.cibcAeroplanPrivilege)],
    ["baggage-insurance", null, issuer(SRC.cibcAeroplanPrivilege)],
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
      sourceUrl: opts?.source ?? `https://ghe1a.com/credit-cards/${slug}`,
      sourceKind: opts?.source ? "issuer" : "ghe1a",
      verifiedAt: opts?.verifiedAt ?? opts?.from ?? VERIFIED_ON,
      recordedAt: opts?.from ?? RECORDED_ON,
      confidence: "verified",
    })),
);
