// Thẻ tín dụng MỸ — mục riêng `/us-credit-cards`, dành cho người Canada chơi
// Miles & Points muốn mở thêm thẻ US. Dựng 21/09/2026.
//
// VÌ SAO NẰM TRONG REPO, KHÔNG NẰM TRONG CONTENTFUL: thẻ Canada sống ở
// Contentful và mọi trang Canada đọc chúng qua `getCreditCardOffers()`. Nếu thẻ
// Mỹ vào cùng content type đó thì mọi chỗ đang gọi hàm ấy — danh sách
// `/credit-cards`, trang so sánh, công cụ gợi ý, "Các thẻ tốt nhất", khối
// "đi tiếp", banner offer, sitemap — đều phải học cách loại chúng ra, và quên
// một chỗ là thẻ Mỹ lọt vào trang Canada. Ở đây chúng không bao giờ đi qua hàm
// đó. Chúng vẫn mang ĐÚNG kiểu `CreditCardOffer` (`country: "US"`), nên mọi
// component thẻ — ảnh, huy hiệu, dải số liệu, nút apply — dùng lại nguyên vẹn.
// Muốn chuyển sang Contentful sau này: thêm các field của `UsCardDetails` vào
// content type, rồi thay `US_CARD_DATA` bằng một fetch lọc `country = US`.
//
// QUY ƯỚC TIỀN: mọi số tiền trên thẻ Mỹ viết "$95 USD", không phải "$95" —
// `$` trần trên site này là đô Canada. Số tiền trong dữ liệu là SỐ
// (`annualFeeUsd`, `minimumSpendUsd`) và chuỗi hiển thị dựng bằng `formatUsd`,
// nên không có chỗ nào quên được chữ USD. Chuỗi viết tay (quyền lợi, ghi chú)
// thì `us-credit-cards.test.ts` canh: mọi `$X` phải có ` USD` đi sau.
//
// SỐ LIỆU: đối chiếu với trang chính thức của ngân hàng ngày 21/09/2026 (xem
// ghi chú nguồn ngay trên `US_CARD_DATA`). Thẻ nào còn là số liệu mẫu thì
// mang `needsVerification: true`: trong lúc `US_CARDS_PUBLISHED` còn tắt, trang
// hiện chúng kèm nhãn "Số liệu mẫu"; bật cờ lên thì `getUsCreditCards()` tự
// bỏ chúng — không có đường nào để số liệu mẫu hiện ra như offer thật.
import type { CreditCardOffer } from "./content/types.ts";
import { US_CARDS_PUBLISHED } from "./feature-flags.ts";
import { US_CARDS_BASE } from "./us-cards-path.ts";
import { ringAfter } from "./ring.ts";

export { US_CARDS_BASE };

/** `id` của khu "Tất cả thẻ Mỹ" — mọi link lọc nhảy thẳng về đây. */
export const US_CARDS_LIST_ANCHOR = "tat-ca-the-my";

/**
 * Các bài hướng dẫn chơi thẻ Mỹ từ Canada, theo thứ tự người mới nên đọc:
 * vì sao chơi → apply thế nào → mở tài khoản ngân hàng → trả tiền thẻ.
 *
 * Slug chứ không phải id: trang tự tìm chúng trong Contentful lúc render, nên
 * một bài bị unpublish thì link tự biến mất thay vì thành 404 (xem
 * `usCardsGuides`). Thêm bài mới thì thêm slug vào đây, không phải sửa JSX.
 */
export const US_CARDS_GUIDE_SLUGS = [
  "4-ly-do-canadians-nen-play-us-game",
  "apply-us-credit-card-tu-canada",
  "mo-chase-bank-account-tu-canada",
  "thanh-toan-us-credit-card-nhu-the-nao",
];

/**
 * Bài mà mọi nút "Xem hướng dẫn" trỏ tới — KHÔNG phải bài đầu danh sách.
 *
 * Hai thứ này tách nhau từ 24/09/2026, khi bài "4 lý do Canadians nên play US
 * game" lên đầu danh sách: chữ quanh các nút đó nói về ITIN, thẻ US đầu tiên và
 * US credit history, nên chúng phải trỏ bài hướng dẫn apply, không phải bài nói
 * vì sao nên chơi. Đổi thứ tự đọc không được kéo theo đích của nút.
 */
export const US_CARDS_BEGINNER_SLUG = "apply-us-credit-card-tu-canada";

export type UsIssuerId =
  | "amex"
  | "chase"
  | "capital-one"
  | "citi"
  | "bilt"
  | "bank-of-america";

export type UsIssuer = { id: UsIssuerId; name: string };

/** Thứ tự này là thứ tự các ô "Khám Phá Theo Ngân Hàng" và hàng chip lọc. */
export const US_ISSUERS: UsIssuer[] = [
  { id: "amex", name: "American Express®" },
  { id: "chase", name: "Chase®" },
  { id: "capital-one", name: "Capital One®" },
  { id: "citi", name: "Citi®" },
  { id: "bilt", name: "Bilt" },
  { id: "bank-of-america", name: "Bank of America®" },
];

export function usIssuerById(id: UsIssuerId): UsIssuer {
  return US_ISSUERS.find((issuer) => issuer.id === id)!;
}

/** Loại thẻ theo thứ người đọc định làm với điểm. Thẻ doanh nghiệp là một
 *  trục riêng (`business`), nên một thẻ vừa Travel vừa Business được. */
export type UsCardCategory = "travel" | "airline" | "hotel" | "cashback";

/**
 * Một câu trả lời trong khối "Góc nhìn từ Canada". Cố ý KHÔNG phải yes/no:
 * ngân hàng Mỹ gần như không công bố điều kiện cho người không cư trú, nên
 * câu trả lời trung thực thường là "Tuỳ trường hợp" kèm một câu giải thích.
 * `short` là chữ in đậm đọc lướt được, `note` là phần giải thích.
 */
export type CanadianAnswer = { short: string; note?: string };

export type UsCardCanadianPerspective = {
  itin: CanadianAnswer;
  usCreditHistory: CanadianAnswer;
  usAddress: CanadianAnswer;
  foreignTransactionFee: CanadianAnswer;
  pointsFromCanada: CanadianAnswer;
  watchOut: string;
};

/** Phần chỉ thẻ Mỹ có, gắn vào `CreditCardOffer` dưới khoá `us`. */
export type UsCardDetails = {
  issuerId: UsIssuerId;
  currency: "USD";
  category: UsCardCategory;
  business: boolean;
  rewardsCurrency: string;
  annualFeeUsd: number;
  /** Điều kiện nhận welcome bonus. Vắng khi thẻ không có welcome bonus. */
  minimumSpendUsd?: number;
  offerPeriod?: string;
  /** Elevated offer ngân hàng ghi "Limited-Time" nhưng không công bố ngày kết thúc. */
  offerEndUnannounced?: true;
  /** Vài quyền lợi ngắn làm tag trên thẻ trong danh sách. */
  tags: string[];
  canada: UsCardCanadianPerspective;
  /** Ngày sửa dữ liệu gần nhất (YYYY-MM-DD). */
  lastUpdated: string;
  /** Ngày đối chiếu với trang ngân hàng. Vắng khi còn là số liệu mẫu. */
  verifiedOn?: string;
  /** Trang sản phẩm của ngân hàng khi `applyUrl` là link ref. Vắng thì nguồn chính là `applyUrl`. */
  sourceUrl?: string;
  /** `true` = số liệu mẫu, chưa kiểm. Không bao giờ hiện khi đã công bố. */
  needsVerification: boolean;
  /** Tạm ẩn khỏi site — xem `hidden` ở `UsCardData`. */
  hidden?: true;
};

export type UsCreditCardOffer = CreditCardOffer & { country: "US"; us: UsCardDetails };

type UsCardData = {
  slug: string;
  name: string;
  issuerId: UsIssuerId;
  category: UsCardCategory;
  business: boolean;
  /**
   * Offer đang cao hơn mức thường — CHỈ bật khi chính trang ngân hàng ghi offer
   * có thời hạn ("Limited Time Offer", "Offer ends…"), kèm `expiresAt`. Mục
   * "Elevated Offers" trên trang tổng lấy đúng những thẻ này, cùng luật
   * `isElevatedLive` với thẻ Canada: qua `expiresAt` là tự rời mục.
   */
  elevatedBonus: boolean;
  /**
   * Ngân hàng ghi offer có thời hạn nhưng không công bố ngày (Capital One®).
   * Thay cho `expiresAt`, nên thẻ KHÔNG tự rời mục Elevated — mỗi lượt rà phải
   * mở lại trang ngân hàng, hết chữ "Limited-Time" thì tắt tay.
   */
  offerEndUnannounced?: true;
  cardImage?: string;
  /** Như `welcomeBonus` của thẻ Canada: "75,000 điểm Ultimate Rewards®". */
  welcomeBonus?: string;
  minimumSpendUsd?: number;
  offerPeriod?: string;
  annualFeeUsd: number;
  annualFeeNote?: string;
  rewardsCurrency: string;
  /** Hạn của welcome offer (YYYY-MM-DD), khi ngân hàng công bố. */
  expiresAt?: string;
  headline: string;
  editorsTake: string;
  keyBenefits: string[];
  tags: string[];
  canada: UsCardCanadianPerspective;
  applyUrl?: string;
  sourceUrl?: string;
  lastUpdated: string;
  verifiedOn?: string;
  needsVerification: boolean;
  /**
   * Tạm ẩn thẻ khỏi site mà không xoá dữ liệu: `getUsCreditCards()` bỏ nó, nên
   * thẻ rời danh sách, trang chi tiết (404), sitemap và ô tìm kiếm cùng lúc.
   * Job canh offer cũng bỏ qua. Muốn hiện lại thì xoá dòng `hidden`.
   */
  hidden?: true;
};

/** "$95 USD", "$4,000 USD". Dấu phẩy ngăn nghìn kiểu Anh như mọi số trên site. */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")} USD`;
}

/** Cùng dạng "$X/năm (ghi chú)" mà `splitAnnualFee` tách ra hai dòng. */
function annualFeeText(amountUsd: number, note?: string): string {
  return `${formatUsd(amountUsd)}/năm${note ? ` (${note})` : ""}`;
}

/** "Chi $4,000 USD trong 3 tháng đầu" — hoặc `undefined` khi không có điều kiện. */
export function spendRequirement(offer: UsCreditCardOffer): string | undefined {
  const { minimumSpendUsd, offerPeriod } = offer.us;
  if (minimumSpendUsd === undefined) return undefined;
  return offerPeriod
    ? `Chi ${formatUsd(minimumSpendUsd)} trong ${offerPeriod}`
    : `Chi ${formatUsd(minimumSpendUsd)}`;
}

// Các câu trả lời lặp lại nhiều lần. Viết một chỗ để chúng không lệch nhau
// giữa các thẻ cùng ngân hàng.
const NO_FTF: CanadianAnswer = {
  short: "Không",
  note: "Không tính phí giao dịch ngoại tệ, nên quẹt ở Canada cũng không mất thêm 2.5%.",
};

// Ba câu trả lời giống nhau cho MỌI thẻ Mỹ — tác giả chốt 30/09/2026: apply thẻ
// Mỹ từ Canada thì ITIN (hoặc SSN), lịch sử tín dụng ở Mỹ và địa chỉ ở Mỹ đều
// là điều kiện cần, không có ngoại lệ theo ngân hàng hay theo thẻ.
const ITIN_REQUIRED: CanadianAnswer = {
  short: "Cần",
  note: "Cần ITIN (hoặc SSN) để apply.",
};
const HISTORY_REQUIRED: CanadianAnswer = {
  short: "Cần",
  note: "Cần lịch sử tín dụng ở Mỹ. Credit score Canada không tự chuyển sang Mỹ.",
};
const ADDRESS_REQUIRED: CanadianAnswer = {
  short: "Cần",
  note: "Cần địa chỉ ở Mỹ để nhận thẻ và thư từ ngân hàng.",
};
const ADDRESS_REQUIRED_BUSINESS: CanadianAnswer = {
  short: "Cần",
  note: "Doanh nghiệp phải có địa chỉ ở Mỹ.",
};

// Nguồn: trang sản phẩm chính thức của từng ngân hàng, đọc trực tiếp ngày
// 21/09/2026 (URL chính là `sourceUrl`, hoặc `applyUrl` khi thẻ không có link ref). Welcome offer Mỹ đổi thường
// xuyên và nhiều offer của American Express® là "as high as" — con số ghi ở
// đây là mức cao nhất trang công bố, không phải mức mọi người đều nhận.
const VERIFIED = "2026-09-21";
/** Đợt thẻ thêm ngày 23/09/2026 — thẻ phổ biến của các ngân hàng lớn. */
const VERIFIED_2 = "2026-09-23";
/** Đợt thẻ thêm ngày 24/09/2026. */
const VERIFIED_3 = "2026-09-24";
/**
 * Ngày công bố mục (30/09/2026): mở lại trang ngân hàng của mọi thẻ đang hiện,
 * bonus + mức chi + annual fee đều khớp. Citi® không nằm trong đợt này — trang
 * không in số welcome bonus cho browser tự động (xem AGENTS.md).
 */
const REVERIFIED = "2026-09-30";
/** Đợt thẻ thêm ngày 01/10/2026: bốn thẻ IHG® (sau đợt đổi cùng ngày) và thẻ Aeroplan® của Chase®. */
const VERIFIED_4 = "2026-10-01";

const AMEX_FTF_27: CanadianAnswer = {
  short: "Có — 2.7%",
  note: "Theo bảng phí của American Express®: 2.7% mỗi giao dịch sau khi quy ra đô la Mỹ.",
};

const MR_FROM_CANADA: CanadianAnswer = {
  short: "Có",
  note: "Membership Rewards® Mỹ chuyển được sang Aeroplan® và nhiều hãng bay khác.",
};

const HILTON_FROM_CANADA: CanadianAnswer = {
  short: "Có",
  note: "Hilton Honors® là chương trình toàn cầu; điểm dùng được ở khách sạn Canada.",
};

/**
 * Bank of America® KHÔNG in mức phí giao dịch ngoại tệ trên trang sản phẩm của
 * thẻ Ascent — bảng phí đầy đủ chỉ hiện trong luồng apply. Thẻ Summit và thẻ
 * doanh nghiệp thì trang nói thẳng là không có (rà lại 30/09/2026), nên chỉ
 * Ascent để ngỏ.
 */
const BOA_FTF_UNKNOWN: CanadianAnswer = {
  short: "Chưa rõ",
  note: "Trang sản phẩm của Bank of America® không công bố mức phí này; kiểm lại trong bảng phí lúc apply trước khi dùng thẻ ngoài nước Mỹ.",
};

const ATMOS_FROM_CANADA: CanadianAnswer = {
  short: "Tuỳ chặng bay",
  note: "Atmos™ Rewards là chương trình gộp của Alaska Airlines® và Hawaiian Airlines®; điểm dùng cho chuyến của hai hãng này và đối tác oneworld®, không chuyển sang Aeroplan®.",
};

/** Điểm Ultimate Rewards® của thẻ có quyền chuyển (Sapphire®, Ink Preferred®). */
const UR_FROM_CANADA: CanadianAnswer = {
  short: "Có",
  note: "Ultimate Rewards® chuyển được sang Aeroplan®.",
};

/** Thẻ cash back trong hệ Ultimate Rewards®: phải ghép với một thẻ có quyền chuyển. */
const UR_PAIRED_FROM_CANADA: CanadianAnswer = {
  short: "Có, nếu ghép thẻ",
  note: "Tự nó chỉ quy ra tiền. Gộp điểm sang Sapphire Preferred®, Sapphire Reserve® hoặc Ink Business Preferred® thì chuyển được sang Aeroplan®.",
};

const IHG_FROM_CANADA: CanadianAnswer = {
  short: "Có",
  note: "IHG® One Rewards là chương trình toàn cầu; điểm và đêm miễn phí dùng được ở khách sạn IHG® tại Canada.",
};

/**
 * Điều kiện in trên trang thẻ Premier và thẻ không annual fee (đọc sau đợt đổi
 * 01/10/2026): không đang giữ thẻ IHG® cá nhân nào, chưa nhận bonus trong 24
 * tháng, thẻ doanh nghiệp không tính. Thẻ Premier Select chỉ ghi điều kiện về
 * chính nó, nên có câu riêng.
 */
const IHG_PERSONAL_WATCH_OUT =
  "Thẻ này chịu luật 5/24 của Chase®. Chỉ mở được khi bạn không đang giữ thẻ IHG® cá nhân nào (kể cả Premier Select) và chưa nhận bonus thẻ IHG® cá nhân trong 24 tháng; thẻ doanh nghiệp không tính vào luật này.";

/**
 * Hạn của welcome offer ra mắt cả dòng thẻ IHG® ("Apply by 11/18/2026" trên cả
 * bốn trang Chase®). Qua ngày này bốn thẻ tự rời mục Elevated, nhưng số bonus
 * vẫn phải rà tay.
 */
const IHG_LAUNCH_OFFER_ENDS = "2026-11-18";

const BONVOY_FROM_CANADA: CanadianAnswer = {
  short: "Có",
  note: "Marriott Bonvoy® là một chương trình chung, nên điểm từ thẻ Mỹ dùng được ở khách sạn Canada.",
};

/**
 * Câu dùng chung cho mọi thẻ Chase® trả "cash back" trong hệ Ultimate Rewards®
 * (hai thẻ Ink không annual fee và ba thẻ Freedom). Một chỗ để năm thẻ không
 * nói khác nhau về cùng một cơ chế.
 */
const UR_CONVERT_NOTE =
  "Cash back của thẻ này thực chất là điểm Ultimate Rewards®: gộp được sang thẻ Chase® có quyền chuyển điểm (Sapphire Preferred®, Sapphire Reserve® hoặc Ink Business Preferred®) rồi chuyển tiếp sang đối tác như Aeroplan®.";

const INK_FTF: CanadianAnswer = {
  short: "Có — 3%",
  note: "Theo bảng phí của Chase®: 3% mỗi giao dịch quy ra đô la Mỹ. Đừng dùng thẻ này khi quẹt ở Canada.",
};

/**
 * Link ref của tác giả. Mỗi link chỉ mở một nhóm thẻ, nên CHỈ gắn cho thẻ có
 * mặt trên trang đích — thẻ khác của cùng ngân hàng giữ link công khai, nếu
 * không người đọc bấm "Apply" thẻ này lại rơi vào trang thẻ khác. Đã mở kiểm
 * ngày 29/09/2026:
 * - Chase® cá nhân: chỉ Sapphire Preferred® và Sapphire Reserve®.
 * - Chase® doanh nghiệp: bốn thẻ Ink và bản Sapphire Reserve® doanh nghiệp — không
 *   có World of Hyatt Business.
 * - Capital One®: cả Venture X và Venture.
 * Host của ba link nằm trong `REFERRAL_SOURCES` để nút mang `sponsored`.
 */
const CHASE_PERSONAL_REFERRAL = "https://www.referyourchasecard.com/19y/UZBI95X9X8";
const CHASE_BUSINESS_REFERRAL = "https://www.referyourchasecard.com/21h/X40C9Z2AN2";
const CAPITAL_ONE_REFERRAL = "https://i.capitalone.com/J2YmzuLB7";

const US_CARD_DATA: UsCardData[] = [
  {
    slug: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred® Card",
    issuerId: "chase",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-sapphire-preferred.png",
    welcomeBonus: "75,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 5_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ travel annual fee thấp của Chase®: nhân điểm ở du lịch và ăn uống, điểm Ultimate Rewards® chuyển được sang Aeroplan®.",
    editorsTake:
      "Với người đã có US credit history, đây là cửa vào hệ điểm Ultimate Rewards® với phí $95 USD. Điểm chuyển được sang Aeroplan® nên vẫn dùng tốt cho chuyến bay xuất phát từ Canada, và credit phí NEXUS™ là điểm cộng cho người hay qua biên giới.",
    keyBenefits: [
      "5x điểm khi đặt qua Chase® Travel; 3x ở nhà hàng, trạm xăng, streaming và siêu thị online; 2x ở du lịch khác",
      "Credit khách sạn tới $100 USD mỗi năm khi đặt qua Chase® Travel",
      "Credit phí Global Entry, TSA PreCheck® hoặc NEXUS™ tới $120 USD, 4 năm một lần",
      "Chuyển điểm sang 10 hãng bay (có Aeroplan®) và 3 chương trình khách sạn",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Travel", "Chuyển điểm", "Credit NEXUS™"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Ultimate Rewards® chuyển được sang Aeroplan®, nên điểm dùng được cho chuyến bay xuất phát từ Canada.",
      },
      watchOut:
        "Chase® thường từ chối người đã mở từ 5 thẻ (của mọi ngân hàng) trong 24 tháng — luật \"5/24\" không có trong điều khoản nhưng được nhiều người xác nhận. Welcome bonus cũng không dành cho người đang có thẻ này.",
    },
    applyUrl: CHASE_PERSONAL_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
    lastUpdated: VERIFIED,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "amex-gold-us",
    name: "American Express® Gold Card",
    issuerId: "amex",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/amex-gold-us.png",
    welcomeBonus: "Lên đến 100,000 điểm Membership Rewards®",
    minimumSpendUsd: 8_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 325,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Bản Mỹ của thẻ Gold: 4x điểm ở nhà hàng và siêu thị Mỹ, điểm Membership Rewards® chuyển được sang Aeroplan®.",
    editorsTake:
      "Thẻ American Express® Mỹ thường là cửa dễ nhất cho người đang có thẻ American Express® Canada. Welcome offer là \"lên đến\": American Express® chỉ báo mức của bạn sau khi apply, trước khi bạn nhận thẻ. Các credit hằng tháng chỉ đáng tiền nếu bạn tiêu ở Mỹ thường xuyên.",
    keyBenefits: [
      "4x điểm ở nhà hàng toàn cầu (tới $50,000 USD/năm) và siêu thị Mỹ (tới $25,000 USD/năm)",
      "5x điểm khách sạn trả trước và 3x vé máy bay qua AmexTravel.com",
      "Credit ăn uống $120 USD, Uber Cash $120 USD, Resy $100 USD và Dunkin' $84 USD mỗi năm (phải đăng ký)",
      "Chuyển điểm sang đối tác hàng không, có Aeroplan®",
    ],
    tags: ["Ăn uống", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: MR_FROM_CANADA,
      watchOut:
        "Mức welcome offer khác nhau theo từng người và bạn có thể không đủ điều kiện nhận. Credit ăn uống, Uber và Dunkin' chỉ dùng được ở Mỹ.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
    lastUpdated: VERIFIED,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "capital-one-venture-x",
    name: "Capital One® Venture X Card",
    issuerId: "capital-one",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/capital-one-venture-x.png",
    welcomeBonus: "75,000 miles Capital One®",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 395,
    rewardsCurrency: "Capital One® Miles",
    headline:
      "Thẻ travel cao cấp của Capital One®: credit du lịch $300 USD mỗi năm, lounge, và miles chuyển được sang Aeroplan®.",
    editorsTake:
      "Credit du lịch $300 USD cộng 10,000 miles mỗi năm gia hạn bù lại phần lớn annual fee — nếu bạn đặt vé qua Capital One® Travel. 2x miles cho mọi chi tiêu làm nó dễ dùng hơn các thẻ chia hạng mục.",
    keyBenefits: [
      "Credit du lịch $300 USD mỗi năm khi đặt qua Capital One® Travel",
      "10,000 miles mỗi năm gia hạn, bắt đầu từ năm thứ hai",
      "10x khách sạn và thuê xe, 5x vé máy bay qua Capital One® Travel; 2x mọi chi tiêu khác",
      "Vào Capital One® Lounge và hơn 1,300 lounge Priority Pass",
      "Credit Global Entry hoặc TSA PreCheck® tới $120 USD",
    ],
    tags: ["Lounge", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Capital One® Miles chuyển 1:1 sang Aeroplan®.",
      },
      watchOut: "Capital One® kéo báo cáo tín dụng từ cả ba credit bureau khi xét đơn.",
    },
    applyUrl: CAPITAL_ONE_REFERRAL,
    sourceUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    lastUpdated: VERIFIED,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "citi-strata-premier",
    name: "Citi Strata Premier® Card",
    issuerId: "citi",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/citi-strata-premier.webp",
    welcomeBonus: "60,000 điểm ThankYou®",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "ThankYou® Points",
    headline:
      "Thẻ travel annual fee thấp của Citi®: 3x điểm ở vé máy bay, khách sạn, nhà hàng, siêu thị và xăng.",
    editorsTake:
      "Hợp với người muốn thêm một hệ điểm chuyển được sang hãng bay ngoài Star Alliance®, như AAdvantage® hay Cathay. Điểm ThankYou® không chuyển được sang Aeroplan®.",
    keyBenefits: [
      "10x điểm khách sạn, thuê xe và vé tham quan qua cititravel.com",
      "3x điểm ở vé máy bay, khách sạn khác, nhà hàng, siêu thị, trạm xăng và sạc xe điện",
      "Giảm $100 USD mỗi năm cho một lần ở khách sạn từ $500 USD, đặt qua cititravel.com",
      "Chuyển điểm sang American Airlines®, Cathay, EVA Air®, Virgin Atlantic và các đối tác khác",
    ],
    tags: ["Travel", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Tuỳ chặng bay",
        note: "Không chuyển sang Aeroplan®. Dùng tốt nếu bạn bay American Airlines® hoặc oneworld® từ các sân bay Mỹ gần biên giới.",
      },
      watchOut:
        "Không nhận welcome bonus nếu đang có hoặc từng có thẻ Citi Strata Premier® hay Citi Premier®.",
    },
    applyUrl: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "bilt-palladium",
    name: "Bilt Palladium Card",
    issuerId: "bilt",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/bilt-palladium.png",
    welcomeBonus: "50,000 điểm Bilt + Gold Status",
    minimumSpendUsd: 4_000,
    offerPeriod: "90 ngày đầu (không tính tiền nhà)",
    annualFeeUsd: 495,
    rewardsCurrency: "Bilt Points",
    headline:
      "Thẻ cao cấp nhất của Bilt: tích điểm cả khi trả tiền thuê nhà hoặc tiền mortgage, và điểm Bilt chuyển được sang Aeroplan®.",
    editorsTake:
      "Bilt hiện có ba thẻ: Blue, Obsidian và Palladium. Palladium là thẻ duy nhất có welcome bonus bằng điểm; hai thẻ kia tặng Bilt Cash. Chỉ đáng nhìn tới nếu bạn trả tiền nhà ở Mỹ.",
    keyBenefits: [
      "Tích tới 1.25x điểm khi trả tiền thuê nhà hoặc mortgage, không mất phí giao dịch",
      "2x điểm mọi chi tiêu khác",
      "Credit khách sạn $400 USD mỗi năm qua Bilt Travel, cộng $200 USD Bilt Cash mỗi năm",
      "Priority Pass",
      "Chuyển điểm 1:1 sang Aeroplan®",
    ],
    tags: ["Tiền nhà", "Lounge", "Chuyển điểm"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Bilt Points chuyển 1:1 sang Aeroplan®.",
      },
      watchOut:
        "Điểm tiền nhà phụ thuộc chi tiêu thường ngày: tiêu dưới 25% số tiền nhà trong kỳ sao kê thì chỉ nhận 250 điểm cho khoản tiền nhà đó.",
    },
    applyUrl: "https://www.bilt.com/card",
    lastUpdated: VERIFIED,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "marriott-bonvoy-boundless",
    name: "Marriott Bonvoy Boundless® Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/marriott-bonvoy-boundless.png",
    welcomeBonus: "3 Free Night Awards",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ khách sạn Marriott Bonvoy® của Chase®: 3 đêm miễn phí khi mở thẻ, thêm một đêm mỗi năm gia hạn.",
    editorsTake:
      "Mỗi Free Night Award dùng được ở khách sạn tới 50,000 điểm/đêm. Đêm miễn phí hằng năm thường đáng hơn $95 USD annual fee nếu bạn ở Marriott Bonvoy® ít nhất một lần mỗi năm.",
    keyBenefits: [
      "Free Night Award (tới 35,000 điểm) mỗi năm gia hạn thẻ",
      "Hạng Silver Elite tự động và 15 Elite Night Credits mỗi năm",
      "6x điểm ở khách sạn Marriott Bonvoy®; 3x ở siêu thị, trạm xăng và nhà hàng (tới $6,000 USD/năm)",
      "Credit hãng bay tới $100 USD tới 30/06/2027",
    ],
    tags: ["Hotel", "Đêm miễn phí", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Marriott Bonvoy® là một chương trình chung, nên điểm và đêm miễn phí từ thẻ Mỹ dùng được ở khách sạn Canada.",
      },
      watchOut:
        "Thẻ này cũng chịu luật 5/24 của Chase®, và Marriott Bonvoy® giới hạn việc nhận bonus giữa các thẻ Marriott Bonvoy® khác nhau.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/boundless",
    lastUpdated: VERIFIED,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-ink-business-preferred",
    name: "Ink Business Preferred® Credit Card",
    issuerId: "chase",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-ink-business-preferred.png",
    welcomeBonus: "100,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 8_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ doanh nghiệp của Chase®: 100,000 điểm Ultimate Rewards®, 3x ở du lịch, vận chuyển, quảng cáo và internet.",
    editorsTake:
      "Welcome bonus lớn so với mức annual fee, nhưng chỉ dành cho người có doanh nghiệp ở Mỹ. Điểm cùng hệ Ultimate Rewards® với Sapphire Preferred® nên chuyển được sang Aeroplan®.",
    keyBenefits: [
      "3x điểm ở du lịch, vận chuyển, quảng cáo mạng xã hội và internet/điện thoại (tới $150,000 USD/năm)",
      "Thẻ nhân viên miễn phí",
      "Chuyển điểm sang đối tác của Ultimate Rewards®, có Aeroplan®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Business", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Ultimate Rewards® chuyển được sang Aeroplan®.",
      },
      watchOut: "Không nhận welcome bonus nếu đã từng có thẻ này.",
    },
    applyUrl: CHASE_BUSINESS_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/business-credit-cards/ink/business-preferred",
    lastUpdated: VERIFIED,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-sapphire-reserve",
    name: "Chase Sapphire Reserve® Card",
    issuerId: "chase",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-sapphire-reserve.png",
    welcomeBonus: "100,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 6_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 795,
    annualFeeNote: "thẻ phụ $195 USD/năm",
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ travel cao cấp của Chase®: 8x điểm qua Chase® Travel, credit du lịch $300 USD và lounge Priority Pass.",
    editorsTake:
      "Annual fee $795 USD chỉ đáng nếu bạn thật sự dùng hết credit du lịch $300 USD và các credit khách sạn. Điểm cùng hệ với Sapphire Preferred® nên vẫn chuyển được sang Aeroplan®.",
    keyBenefits: [
      "8x điểm khi đặt qua Chase® Travel, 4x vé máy bay và khách sạn đặt thẳng với hãng, 3x ăn uống",
      "Credit du lịch tới $300 USD mỗi năm gia hạn thẻ",
      "Credit khách sạn tới $500 USD mỗi năm cho các khách sạn thuộc The Edit℠",
      "Chuyển điểm sang đối tác của Ultimate Rewards®, có Aeroplan®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Travel", "Lounge", "Chuyển điểm"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Ultimate Rewards® chuyển được sang Aeroplan®.",
      },
      watchOut:
        "Cũng chịu luật 5/24 của Chase®, và phần lớn giá trị nằm ở các credit chỉ dùng được khi đặt qua hệ thống của Chase®.",
    },
    applyUrl: CHASE_PERSONAL_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
    lastUpdated: VERIFIED_2,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "amex-platinum-us",
    name: "American Express® Platinum Card",
    issuerId: "amex",
    category: "travel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/amex-platinum-us.png",
    welcomeBonus: "Lên đến 175,000 điểm Membership Rewards®",
    minimumSpendUsd: 12_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 895,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Bản Mỹ của thẻ Platinum: 5x điểm vé máy bay và khách sạn, mạng lưới lounge rộng nhất trong các thẻ American Express®.",
    editorsTake:
      "Welcome offer là \"lên đến\" và đòi chi $12,000 USD trong 6 tháng. Điểm Membership Rewards® Mỹ chuyển được sang Aeroplan® như bản Canada.",
    keyBenefits: [
      "5x điểm vé máy bay đặt thẳng với hãng hoặc qua American Express Travel® (tới $500,000 USD/năm)",
      "5x điểm khách sạn trả trước qua American Express Travel®",
      "Vào The Global Lounge Collection®, gồm Centurion® Lounge",
      "Chuyển điểm sang đối tác hàng không, có Aeroplan®",
    ],
    tags: ["Lounge", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: MR_FROM_CANADA,
      watchOut:
        "Phần lớn credit hằng năm chỉ dùng được ở Mỹ, nên giá trị thật với người sống ở Canada thấp hơn con số American Express® quảng cáo.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
    lastUpdated: VERIFIED_2,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "capital-one-venture",
    name: "Capital One® Venture Card",
    issuerId: "capital-one",
    category: "travel",
    business: false,
    elevatedBonus: true,
    offerEndUnannounced: true,
    cardImage: "/images/us-cards/capital-one-venture.png",
    welcomeBonus: "75,000 miles Capital One® + $300 USD credit",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Capital One® Miles",
    headline:
      "Bản annual fee thấp của Venture X: 2x miles cho mọi chi tiêu, miles chuyển được sang Aeroplan®.",
    editorsTake:
      "Cùng hệ miles với Venture X nhưng phí $95 USD thay vì $395 USD, đổi lại không có lounge. Capital One® đang chạy thêm credit khách sạn $300 USD nhưng không công bố ngày kết thúc — kiểm lại trên trang trước khi apply.",
    keyBenefits: [
      "2x miles cho mọi chi tiêu, không giới hạn",
      "5x miles khách sạn và thuê xe đặt qua Capital One® Travel",
      "Credit $300 USD cho khách sạn và nhà thuê qua Capital One® Travel trong năm đầu (offer giới hạn thời gian)",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Travel", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Capital One® Miles chuyển 1:1 sang Aeroplan®.",
      },
      watchOut: "Capital One® kéo báo cáo tín dụng từ cả ba credit bureau khi xét đơn.",
    },
    applyUrl: CAPITAL_ONE_REFERRAL,
    sourceUrl: "https://www.capitalone.com/credit-cards/venture/",
    lastUpdated: "2026-09-27",
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "united-explorer",
    name: "United℠ Explorer Card",
    issuerId: "chase",
    category: "airline",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/united-explorer.png",
    welcomeBonus: "Lên đến 60,000 miles United MileagePlus®",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 150,
    annualFeeNote: "năm đầu $0 USD",
    rewardsCurrency: "United MileagePlus®",
    headline:
      "Thẻ hãng bay United® của Chase®: hành lý ký gửi miễn phí, 2 lượt vào United Club℠ mỗi năm.",
    editorsTake:
      "50,000 miles sau khi chi $3,000 USD trong 3 tháng, cộng 10,000 miles nữa nếu thêm thẻ phụ trong 3 tháng đầu. United® là đối tác Star Alliance® nên miles dùng được cho chặng Air Canada®.",
    keyBenefits: [
      "Hành lý ký gửi đầu tiên miễn phí cho bạn và một người cùng chuyến",
      "2 lượt vào United Club℠ mỗi năm",
      "Ưu tiên lên máy bay trên chuyến United®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hành lý miễn phí", "United®", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Tuỳ chặng bay",
        note: "United MileagePlus® không chuyển sang Aeroplan®, nhưng dùng được cho chuyến Air Canada® và các hãng Star Alliance® khác.",
      },
      watchOut: "Thẻ này chịu luật 5/24 của Chase®.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/united/united-explorer",
    lastUpdated: VERIFIED_2,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-aeroplan",
    name: "Air Canada Aeroplan® Card",
    issuerId: "chase",
    category: "airline",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-aeroplan.png",
    welcomeBonus: "75,000 điểm Aeroplan® (tổng tới 115,000)",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 195,
    rewardsCurrency: "Aeroplan®",
    headline:
      "Thẻ Aeroplan® của Chase®: điểm vào thẳng tài khoản Aeroplan®, hạng 25K tự động và hành lý ký gửi miễn phí trên chuyến Air Canada®.",
    editorsTake:
      "Welcome bonus tới 115,000 điểm chia hai nấc: 75,000 điểm sau khi chi $4,000 USD trong 3 tháng, thêm 40,000 điểm khi tổng chi đạt $20,000 USD trong 12 tháng — Chase® gọi đây là offer tốt nhất từ trước tới nay của thẻ. Với người Canada, đây là thẻ Mỹ tích thẳng ra Aeroplan® mà không cần bước chuyển điểm, và hạng 25K tự động đáng giá nếu bạn hay bay Air Canada®.",
    keyBenefits: [
      "Hạng Aeroplan® 25K tự động khi còn giữ thẻ; chi $75,000 USD trong năm lên 35K",
      "3x điểm khi mua thẳng với Air Canada® và ở du lịch khác; 3x ở siêu thị và nhà hàng tới 31/12/2026 (sau đó 2x); 2x ở trạm xăng",
      "Hành lý ký gửi đầu tiên miễn phí cho bạn và tối đa 8 người cùng đặt chỗ trên chuyến Air Canada®",
      "Credit Air Canada® tới $100 USD mỗi năm (hai lần $50 USD) và giảm 15% vé đổi điểm của Air Canada®",
      "Tới 25,000 Status Qualifying Credits (SQC) mỗi năm theo mức chi tiêu",
      "Credit phí Global Entry, TSA PreCheck® hoặc NEXUS™ tới $120 USD, 4 năm một lần; không phí giao dịch ngoại tệ",
    ],
    tags: ["Aeroplan®", "Hành lý miễn phí", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Điểm tự chuyển vào tài khoản Aeroplan® gắn với thẻ sau mỗi kỳ sao kê. Aeroplan® không chia theo quốc gia, nên điểm dùng được cho chuyến bay xuất phát từ Canada như điểm từ thẻ Canada.",
      },
      watchOut:
        "Thẻ này chịu luật 5/24 của Chase®. Điều khoản của Chase® chỉ chặn người đang có thẻ này hoặc đã nhận bonus của nó trong 24 tháng — không nhắc tới thẻ Aeroplan® Canada. Nấc 40,000 điểm đòi tổng chi $20,000 USD trong 12 tháng, khó với người ít tiêu ở Mỹ.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/aircanada/aeroplan",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "world-of-hyatt",
    name: "World of Hyatt® Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/world-of-hyatt.png",
    welcomeBonus: "Lên đến 60,000 điểm World of Hyatt®",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "World of Hyatt®",
    headline:
      "Thẻ khách sạn World of Hyatt® của Chase®: một đêm miễn phí mỗi năm và 5 tier qualifying nights.",
    editorsTake:
      "30,000 điểm sau khi chi $3,000 USD trong 3 tháng, cộng tối đa 30,000 điểm nữa từ chi tiêu 6 tháng đầu. Điểm World of Hyatt® thường đổi ra giá trị cao nhất trong các chương trình khách sạn lớn.",
    keyBenefits: [
      "Một đêm miễn phí (hạng 1–4) mỗi năm gia hạn thẻ",
      "5 tier qualifying nights mỗi năm, cộng 2 nights cho mỗi $5,000 USD chi tiêu",
      "Tới 9x điểm ở khách sạn thuộc World of Hyatt®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Đêm miễn phí", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "World of Hyatt® là chương trình toàn cầu, điểm dùng được ở khách sạn Canada và mọi nơi khác.",
      },
      watchOut: "Thẻ này chịu luật 5/24 của Chase®; Hyatt® có ít khách sạn ở Canada hơn Marriott Bonvoy®.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/world-of-hyatt-credit-card",
    lastUpdated: VERIFIED_2,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "hilton-honors-amex",
    name: "Hilton Honors American Express® Card",
    issuerId: "amex",
    category: "hotel",
    business: false,
    elevatedBonus: true,
    expiresAt: "2027-01-13",
    cardImage: "/images/us-cards/hilton-honors-amex.png",
    welcomeBonus: "70,000 điểm Hilton Honors® + 1 Free Night Reward",
    minimumSpendUsd: 2_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Hilton Honors®",
    headline:
      "Thẻ khách sạn không annual fee: 7x điểm ở khách sạn Hilton® và hạng Silver tự động.",
    editorsTake:
      "American Express® đang chạy offer giới hạn thời gian tới 13/01/2027: thêm một Free Night Reward bên cạnh 70,000 điểm. Không annual fee nên thẻ này không tốn gì để giữ.",
    keyBenefits: [
      "7x điểm ở khách sạn và resort thuộc Hilton®",
      "5x điểm ở nhà hàng, siêu thị và trạm xăng tại Mỹ",
      "Hạng Hilton Honors™ Silver tự động",
      "Không annual fee",
    ],
    tags: ["Hotel", "Không annual fee", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: HILTON_FROM_CANADA,
      watchOut:
        "Điểm Hilton Honors® có giá trị mỗi điểm thấp hơn nhiều so với Aeroplan® hay World of Hyatt® — cần rất nhiều điểm cho một đêm.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/hilton-honors/",
    lastUpdated: VERIFIED_2,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-ink-business-unlimited",
    name: "Ink Business Unlimited® Credit Card",
    issuerId: "chase",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-ink-business-unlimited.png",
    welcomeBonus: "$750 USD cash back",
    minimumSpendUsd: 6_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ doanh nghiệp không annual fee của Chase®: 1.5% cash back cho mọi chi tiêu.",
    editorsTake:
      "Không annual fee mà welcome bonus $750 USD. " +
      UR_CONVERT_NOTE +
      " Lưu ý thẻ này CÓ phí giao dịch ngoại tệ 3%.",
    keyBenefits: [
      "1.5% cash back cho mọi chi tiêu, không giới hạn",
      "Không annual fee",
      "Thẻ nhân viên miễn phí",
      "Cash back quy đổi được sang điểm Ultimate Rewards® nếu có thẻ Chase® đủ điều kiện",
    ],
    tags: ["Business", "Không annual fee", "Có phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: INK_FTF,
      pointsFromCanada: UR_PAIRED_FROM_CANADA,
      watchOut: "Thẻ này chịu luật 5/24 của Chase®, và doanh nghiệp đăng ký ở Canada không dùng được.",
    },
    applyUrl: CHASE_BUSINESS_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/business-credit-cards/ink/unlimited",
    lastUpdated: VERIFIED_2,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-ink-business-cash",
    name: "Ink Business Cash® Credit Card",
    issuerId: "chase",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-ink-business-cash.png",
    welcomeBonus: "$750 USD cash back",
    minimumSpendUsd: 6_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ doanh nghiệp không annual fee của Chase®: 5% cash back ở văn phòng phẩm, internet, cable và điện thoại.",
    editorsTake:
      "Cùng welcome bonus $750 USD và cùng annual fee $0 USD với Ink Business Unlimited®, khác ở chỗ nhân theo hạng mục thay vì đều 1.5%. " +
      UR_CONVERT_NOTE +
      " Lưu ý thẻ này CÓ phí giao dịch ngoại tệ 3%.",
    keyBenefits: [
      "5% cash back ở văn phòng phẩm và dịch vụ internet, cable, điện thoại (tới $25,000 USD mỗi năm gia hạn thẻ)",
      "2% cash back ở trạm xăng và nhà hàng (tới $25,000 USD mỗi năm gia hạn thẻ)",
      "Không annual fee, thẻ nhân viên miễn phí",
      "Cash back quy đổi được sang điểm Ultimate Rewards® nếu có thẻ Chase® đủ điều kiện",
    ],
    tags: ["Business", "Không annual fee", "Có phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: INK_FTF,
      pointsFromCanada: UR_PAIRED_FROM_CANADA,
      watchOut:
        "Thẻ này chịu luật 5/24 của Chase®, và welcome bonus không dành cho người đã từng có bất kỳ thẻ doanh nghiệp Chase® không annual fee nào.",
    },
    applyUrl: CHASE_BUSINESS_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/business-credit-cards/ink/cash",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-sapphire-reserve-business",
    name: "Chase Sapphire Reserve® for Business Card",
    issuerId: "chase",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-sapphire-reserve-business.png",
    welcomeBonus: "200,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 30_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 795,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Bản doanh nghiệp của Sapphire Reserve®: 200,000 điểm Ultimate Rewards® khi mở thẻ, đổi lại mức chi tiêu lớn nhất trong các thẻ Chase® ở đây.",
    editorsTake:
      "200,000 điểm là con số rất lớn, nhưng phải chi $30,000 USD trong 6 tháng — chỉ hợp lý nếu doanh nghiệp bạn có dòng chi tiêu thật ở Mỹ. Chase® ghi đây là offer trở lại từ mức 150,000 điểm, không công bố ngày kết thúc.",
    keyBenefits: [
      "8x điểm khi đặt qua Chase® Travel",
      "Credit du lịch và credit dịch vụ doanh nghiệp hằng năm",
      "Thẻ nhân viên miễn phí",
      "Chuyển điểm sang đối tác của Ultimate Rewards®, có Aeroplan®",
    ],
    tags: ["Business", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: UR_FROM_CANADA,
      watchOut:
        "Là thẻ Pay in Full: dư nợ phải trả hết mỗi kỳ sao kê. Mức chi tiêu $30,000 USD trong 6 tháng là rào cản thật, không phải con số trang trí.",
    },
    applyUrl: CHASE_BUSINESS_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/business-credit-cards/sapphire/reserve",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-ink-business-premier",
    name: "Ink Business Premier® Credit Card",
    issuerId: "chase",
    category: "cashback",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-ink-business-premier.png",
    welcomeBonus: "$1,000 USD cash back",
    minimumSpendUsd: 10_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 195,
    rewardsCurrency: "Cash back",
    headline:
      "Thẻ doanh nghiệp trả 2.5% cash back cho giao dịch lớn, 2% cho mọi chi tiêu khác.",
    editorsTake:
      "Khác hai thẻ Ink không annual fee: cash back của Ink Business Premier® KHÔNG quy đổi được sang điểm Ultimate Rewards®, nên nó là thẻ tiền mặt thuần. Cũng là thẻ Pay in Full.",
    keyBenefits: [
      "2.5% cash back cho mỗi giao dịch từ $5,000 USD trở lên",
      "2% cash back cho mọi chi tiêu khác",
      "Thẻ nhân viên miễn phí",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Business", "Cash back", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Không",
        note: "Cash back của thẻ này không đổi sang điểm Ultimate Rewards® được, nên không có đường sang Aeroplan®.",
      },
      watchOut: "Thẻ Pay in Full và chịu luật 5/24 của Chase®.",
    },
    applyUrl: CHASE_BUSINESS_REFERRAL,
    sourceUrl: "https://creditcards.chase.com/business-credit-cards/ink/premier",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-freedom-unlimited",
    name: "Chase Freedom Unlimited® Credit Card",
    issuerId: "chase",
    category: "cashback",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-freedom-unlimited.png",
    welcomeBonus: "$200 USD cash back",
    minimumSpendUsd: 500,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ không annual fee: 1.5% cash back cho mọi chi tiêu, 3% ăn uống và nhà thuốc.",
    editorsTake:
      "Mức chi tiêu $500 USD trong 3 tháng là thấp nhất trong các thẻ ở đây, hợp làm thẻ Chase® đầu tiên. " +
      UR_CONVERT_NOTE,
    keyBenefits: [
      "1.5% cash back cho mọi chi tiêu",
      "3% ăn uống và nhà thuốc, 5% du lịch đặt qua Chase® Travel",
      "Không annual fee",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Cash back", "Không annual fee", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: UR_PAIRED_FROM_CANADA,
      watchOut: "Thẻ này chịu luật 5/24 của Chase®.",
    },
    applyUrl: "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited",
    lastUpdated: VERIFIED_3,
    verifiedOn: VERIFIED_3,
    needsVerification: false,
    // Tác giả yêu cầu tạm ẩn 30/09/2026.
    hidden: true,
  },
  {
    slug: "chase-freedom-flex",
    name: "Chase Freedom Flex® Credit Card",
    issuerId: "chase",
    category: "cashback",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-freedom-flex.png",
    welcomeBonus: "$250 USD cash back",
    minimumSpendUsd: 500,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ không annual fee với 5% cash back theo hạng mục xoay vòng mỗi quý (phải đăng ký).",
    editorsTake:
      "Chase® đang ghi đây là offer giới hạn thời gian, $250 USD thay cho $200 USD, nhưng không công bố ngày kết thúc. " +
      UR_CONVERT_NOTE,
    keyBenefits: [
      "5% cash back ở hạng mục xoay vòng mỗi quý, tới $1,500 USD chi tiêu mỗi quý (phải đăng ký)",
      "5% du lịch đặt qua Chase® Travel, 3% ăn uống và nhà thuốc",
      "Không annual fee",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Cash back", "Không annual fee", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: UR_PAIRED_FROM_CANADA,
      watchOut:
        "Hạng mục 5% phải đăng ký mỗi quý — quên là mất. Thẻ này cũng chịu luật 5/24 của Chase®.",
    },
    applyUrl: "https://creditcards.chase.com/cash-back-credit-cards/freedom/flex",
    lastUpdated: VERIFIED_3,
    verifiedOn: VERIFIED_3,
    needsVerification: false,
    // Tác giả yêu cầu tạm ẩn 30/09/2026.
    hidden: true,
  },
  {
    slug: "chase-freedom-rise",
    name: "Chase Freedom Rise® Credit Card",
    issuerId: "chase",
    category: "cashback",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/chase-freedom-rise.png",
    annualFeeUsd: 0,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ dành cho người chưa có lịch sử tín dụng ở Mỹ: 1.5% cash back, không annual fee.",
    editorsTake:
      "Thẻ đáng chú ý nhất trong nhóm này với người Canada mới sang: Chase® nói giữ ít nhất $250 USD trong tài khoản Chase® làm tăng khả năng được duyệt. Không có welcome bonus, chỉ $25 USD khi bật thanh toán tự động. Lưu ý thẻ này CÓ phí giao dịch ngoại tệ 3%.",
    keyBenefits: [
      "1.5% cash back cho mọi chi tiêu",
      "Không annual fee",
      "$25 USD khi bật thanh toán tự động",
      "Dành cho người mới bắt đầu xây credit ở Mỹ",
    ],
    tags: ["Cash back", "Người mới", "Có phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: {
        short: "Có — 3%",
        note: "Theo bảng phí của Chase®: 3% mỗi giao dịch quy ra đô la Mỹ.",
      },
      pointsFromCanada: UR_PAIRED_FROM_CANADA,
      watchOut:
        "Chase® ghi rõ có thể phải nộp thêm giấy tờ sau khi apply, trong đó có Social Security Card — điểm vướng với người chỉ có ITIN.",
    },
    applyUrl: "https://creditcards.chase.com/cash-back-credit-cards/freedom/rise",
    lastUpdated: VERIFIED_3,
    verifiedOn: VERIFIED_3,
    needsVerification: false,
    // Tác giả yêu cầu tạm ẩn 30/09/2026.
    hidden: true,
  },
  {
    slug: "marriott-bonvoy-bold",
    name: "Marriott Bonvoy Bold® Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/marriott-bonvoy-bold.png",
    welcomeBonus: "45,000 điểm Marriott Bonvoy®",
    minimumSpendUsd: 1_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ Marriott Bonvoy® không annual fee: hạng Silver Elite tự động và 5 Elite Night Credits mỗi năm.",
    editorsTake:
      "Mức chi tiêu thấp nhất trong ba thẻ Marriott Bonvoy® của Chase® và không tốn annual fee, đổi lại không có đêm miễn phí hằng năm.",
    keyBenefits: [
      "Tới 14x điểm ở khách sạn thuộc Marriott Bonvoy®",
      "Hạng Silver Elite tự động, 5 Elite Night Credits mỗi năm",
      "Không annual fee",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Không annual fee", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: BONVOY_FROM_CANADA,
      watchOut:
        "Thẻ này chịu luật 5/24 của Chase®, và Marriott Bonvoy® giới hạn việc nhận bonus giữa các thẻ Marriott Bonvoy® khác nhau.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/bold",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "marriott-bonvoy-bountiful",
    name: "Marriott Bonvoy Bountiful® Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/marriott-bonvoy-bountiful.png",
    welcomeBonus: "85,000 điểm Marriott Bonvoy®",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 250,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ Marriott Bonvoy® bậc giữa của Chase®: tới 18.5x điểm ở khách sạn Marriott Bonvoy® và 2x cho mọi chi tiêu khác.",
    editorsTake:
      "Trong ba thẻ Marriott Bonvoy® cá nhân của Chase®, đây là thẻ tặng nhiều điểm nhất khi mở — Boundless® tặng đêm miễn phí thay vì điểm. Annual fee $250 USD nên chỉ đáng nếu bạn ở Marriott Bonvoy® nhiều lần mỗi năm.",
    keyBenefits: [
      "Tới 18.5x điểm ở khách sạn thuộc Marriott Bonvoy®",
      "2x điểm cho mọi chi tiêu khác",
      "Hạng elite và Elite Night Credits hằng năm",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: BONVOY_FROM_CANADA,
      watchOut:
        "Thẻ này chịu luật 5/24 của Chase®, và Marriott Bonvoy® giới hạn việc nhận bonus giữa các thẻ Marriott Bonvoy® khác nhau.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/bountiful",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "world-of-hyatt-business",
    name: "World of Hyatt® Business Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/world-of-hyatt-business.png",
    welcomeBonus: "70,000 điểm World of Hyatt®",
    minimumSpendUsd: 7_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 199,
    rewardsCurrency: "World of Hyatt®",
    headline:
      "Bản doanh nghiệp của thẻ World of Hyatt®: 2x điểm ở ba hạng mục chi tiêu nhiều nhất mỗi quý.",
    editorsTake:
      "Welcome bonus cao hơn bản cá nhân nhưng đòi chi $7,000 USD trong 3 tháng. Điểm World of Hyatt® vẫn là hệ điểm khách sạn đổi ra giá trị cao.",
    keyBenefits: [
      "Tới 9x điểm ở khách sạn thuộc World of Hyatt®",
      "2x điểm ở ba hạng mục chi tiêu nhiều nhất mỗi quý",
      "Thẻ nhân viên miễn phí",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Business", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "World of Hyatt® là chương trình toàn cầu, điểm dùng được ở khách sạn Canada và mọi nơi khác.",
      },
      watchOut: "Thẻ doanh nghiệp nên không tính vào 5/24, nhưng Chase® vẫn xét 5/24 khi duyệt.",
    },
    applyUrl: "https://creditcards.chase.com/business-credit-cards/world-of-hyatt/hyatt-business-card",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "ihg-one-rewards-premier-select",
    name: "IHG® One Rewards Premier Select Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: true,
    cardImage: "/images/us-cards/ihg-one-rewards-premier-select.png",
    welcomeBonus: "200,000 điểm IHG® One Rewards",
    minimumSpendUsd: 5_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 350,
    rewardsCurrency: "IHG® One Rewards",
    expiresAt: IHG_LAUNCH_OFFER_ENDS,
    headline:
      "Thẻ IHG® cao cấp ra mắt 01/10/2026: hạng Platinum Elite tự động, đêm miễn phí tới 60,000 điểm mỗi năm và 20 Elite Night Credits.",
    editorsTake:
      "Welcome bonus 200,000 điểm sau khi chi $5,000 USD trong 3 tháng là offer ra mắt, chỉ apply tới 18/11/2026. Annual fee $350 USD chỉ hợp lý nếu bạn dùng hết credit ăn uống ở khách sạn IHG® và credit hãng bay — credit ăn uống chỉ dùng ở khách sạn IHG®, credit hãng bay đòi mua vé thẳng với hãng từ $250 USD mỗi năm.",
    keyBenefits: [
      "12x điểm ở khách sạn IHG®; 6x ở nhà hàng và mọi chi tiêu du lịch khác (kể cả rideshare); 3x cho mọi chi tiêu khác",
      "Đêm miễn phí mỗi năm gia hạn (khách sạn tới 60,000 điểm/đêm, bù thêm điểm được); chi $40,000 USD trong năm được thêm một đêm",
      "Hạng Platinum Elite tự động; chi $25,000 USD trong năm lên Diamond Elite",
      "Credit ăn uống tới $300 USD mỗi năm ở khách sạn IHG® ($75 USD mỗi quý) và credit hãng bay $200 USD khi mua vé thẳng với hãng từ $250 USD trong năm (tới 31/12/2027)",
      "20 Elite Night Credits mỗi năm, thêm 2 cho mỗi $5,000 USD chi tiêu; đổi điểm 3 đêm liên tiếp được tặng đêm thứ 4",
      "Credit phí Global Entry, TSA PreCheck® hoặc NEXUS™ tới $120 USD, 4 năm một lần; không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Đêm miễn phí", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: IHG_FROM_CANADA,
      watchOut:
        "Thẻ này chịu luật 5/24 của Chase®. Điều kiện in trên trang chỉ nói về chính thẻ này: không đang giữ nó và chưa nhận bonus của nó trong 24 tháng. Ngược lại, đang giữ thẻ này thì không mở được bản Premier hay bản không annual fee, vì hai thẻ đó đòi bạn không giữ thẻ IHG® cá nhân nào.",
    },
    applyUrl: "https://creditcards.chase.com/a1/ihg/PremierSelectNAEPQ410",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "ihg-one-rewards-premier",
    name: "IHG® One Rewards Premier Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: true,
    cardImage: "/images/us-cards/ihg-one-rewards-premier.png",
    welcomeBonus: "180,000 điểm IHG® One Rewards",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 150,
    rewardsCurrency: "IHG® One Rewards",
    expiresAt: IHG_LAUNCH_OFFER_ENDS,
    headline:
      "Thẻ IHG® bậc giữa của Chase®: hạng Gold Elite tự động, đêm miễn phí tới 50,000 điểm mỗi năm và 15 Elite Night Credits.",
    editorsTake:
      "Welcome bonus 180,000 điểm sau khi chi $3,000 USD trong 3 tháng — mức chi thấp so với số điểm, chỉ apply tới 18/11/2026. Thẻ mở mới từ 01/10/2026 có hạng Gold Elite (trước là Platinum) và annual fee $150 USD (trước là $99 USD; người đang giữ thẻ được điều chỉnh phí trong năm 2027), đổi lại đêm miễn phí hằng năm nâng lên 50,000 điểm.",
    keyBenefits: [
      "10x điểm ở khách sạn IHG®; 5x ở vé máy bay mua thẳng với hãng, thuê xe, nhà hàng, siêu thị và trạm xăng; 3x cho mọi chi tiêu khác",
      "Đêm miễn phí mỗi năm gia hạn (khách sạn tới 50,000 điểm/đêm, bù thêm điểm được)",
      "Hạng Gold Elite tự động; chi $15,000 USD trong năm lên Platinum Elite, $40,000 USD lên Diamond Elite",
      "Credit ăn uống tới $100 USD mỗi năm ở khách sạn IHG® ($25 USD mỗi quý) và credit hãng bay $100 USD khi mua vé thẳng với hãng từ $250 USD trong năm (tới 31/12/2027)",
      "15 Elite Night Credits mỗi năm, thêm 2 cho mỗi $5,000 USD chi tiêu; đổi điểm 3 đêm liên tiếp được tặng đêm thứ 4",
      "Credit phí Global Entry, TSA PreCheck® hoặc NEXUS™ tới $120 USD, 4 năm một lần; không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Đêm miễn phí", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: IHG_FROM_CANADA,
      watchOut: IHG_PERSONAL_WATCH_OUT,
    },
    applyUrl: "https://creditcards.chase.com/a1/ihg/PremierNAEPQ410",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "ihg-one-rewards",
    name: "IHG® One Rewards Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    elevatedBonus: true,
    cardImage: "/images/us-cards/ihg-one-rewards.png",
    welcomeBonus: "125,000 điểm IHG® One Rewards",
    minimumSpendUsd: 2_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "IHG® One Rewards",
    expiresAt: IHG_LAUNCH_OFFER_ENDS,
    headline:
      "Thẻ IHG® không annual fee của Chase® (trước 01/10/2026 tên là Traveler): hạng Silver Elite tự động và 5 Elite Night Credits mỗi năm.",
    editorsTake:
      "Welcome bonus 125,000 điểm sau khi chi $2,000 USD trong 3 tháng, không tốn annual fee, chỉ apply tới 18/11/2026. Đổi lại không có đêm miễn phí hằng năm, và từ 2027 ưu đãi đổi 3 đêm tặng đêm thứ 4 chỉ mở khi chi $5,000 USD trong một năm (dùng được hết năm đó và cả năm sau).",
    keyBenefits: [
      "5x điểm ở khách sạn IHG®; 3x ở nhà hàng, siêu thị và trạm xăng; 2x cho mọi chi tiêu khác",
      "Hạng Silver Elite tự động; chi $15,000 USD trong năm lên Gold Elite",
      "5 Elite Night Credits mỗi năm; chi $15,000 USD trong năm được 10,000 điểm",
      "Đổi điểm 3 đêm liên tiếp được tặng đêm thứ 4 (từ 2027: chi $5,000 USD trong năm để mở cho hết năm đó và cả năm sau)",
      "Không annual fee, không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Không annual fee", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: IHG_FROM_CANADA,
      watchOut: IHG_PERSONAL_WATCH_OUT,
    },
    applyUrl: "https://creditcards.chase.com/a1/ihg/OneRewardsNAEPQ410",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "ihg-one-rewards-business",
    name: "IHG® One Rewards Business Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: true,
    elevatedBonus: true,
    cardImage: "/images/us-cards/ihg-one-rewards-business.png",
    welcomeBonus: "190,000 điểm IHG® One Rewards",
    minimumSpendUsd: 5_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 200,
    rewardsCurrency: "IHG® One Rewards",
    expiresAt: IHG_LAUNCH_OFFER_ENDS,
    headline:
      "Thẻ IHG® doanh nghiệp của Chase® (trước 01/10/2026 tên là Premier Business): hạng Platinum Elite tự động và đêm miễn phí tới 50,000 điểm mỗi năm.",
    editorsTake:
      "Welcome bonus 190,000 điểm sau khi chi $5,000 USD trong 3 tháng, chỉ apply tới 18/11/2026. Giữ hạng Platinum Elite mà bản Premier cá nhân vừa mất, và điều kiện \"không giữ thẻ IHG® cá nhân nào\" của hai thẻ cá nhân ghi rõ không tính thẻ doanh nghiệp.",
    keyBenefits: [
      "10x điểm ở khách sạn IHG®; 5x ở vé máy bay mua thẳng với hãng, thuê xe, nhà hàng, quảng cáo mạng xã hội/tìm kiếm và trạm xăng; 3x cho mọi chi tiêu khác",
      "Đêm miễn phí mỗi năm gia hạn (khách sạn tới 50,000 điểm/đêm); chi $60,000 USD trong năm được thêm một đêm",
      "Hạng Platinum Elite tự động; từ 2027, chi $50,000 USD trong năm lên Diamond Elite",
      "Credit ăn uống tới $100 USD mỗi năm ở khách sạn IHG®, credit hãng bay $100 USD khi mua vé thẳng với hãng từ $250 USD trong năm (tới 31/12/2027) và credit Expensify tới $100 USD mỗi năm",
      "15 Elite Night Credits mỗi năm, thêm 2 cho mỗi $5,000 USD chi tiêu; đổi điểm 3 đêm liên tiếp được tặng đêm thứ 4",
      "Credit phí Global Entry, TSA PreCheck® hoặc NEXUS™ tới $120 USD, 4 năm một lần; không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Business", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: IHG_FROM_CANADA,
      watchOut: "Thẻ doanh nghiệp nên không tính vào 5/24, nhưng Chase® vẫn xét 5/24 khi duyệt.",
    },
    applyUrl: "https://creditcards.chase.com/a1/ihg/BizNAEPQ410",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "amex-business-platinum",
    name: "American Express® Business Platinum Card",
    issuerId: "amex",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/amex-business-platinum.png",
    welcomeBonus: "Lên đến 300,000 điểm Membership Rewards®",
    minimumSpendUsd: 20_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 895,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Thẻ doanh nghiệp cao cấp nhất của American Express®: welcome offer lớn nhất trong các thẻ Mỹ trên trang này.",
    editorsTake:
      "300,000 điểm là con số lớn nhất ở đây, nhưng phải chi $20,000 USD trong 3 tháng và offer là mức \"lên đến\". Điểm Membership Rewards® chuyển được sang Aeroplan®.",
    keyBenefits: [
      "Vào The Global Lounge Collection®, gồm Centurion® Lounge",
      "Các credit dịch vụ doanh nghiệp hằng năm",
      "Chuyển điểm sang đối tác hàng không, có Aeroplan®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Business", "Lounge", "Chuyển điểm"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: MR_FROM_CANADA,
      watchOut:
        "Thẻ Pay in Full và phần lớn credit chỉ dùng được ở Mỹ; mức chi tiêu $20,000 USD trong 3 tháng là rào cản thật.",
    },
    applyUrl:
      "https://www.americanexpress.com/us/credit-cards/business/business-credit-cards/american-express-business-platinum-credit-card-amex/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "amex-business-gold-us",
    name: "American Express® Business Gold Card",
    issuerId: "amex",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/amex-business-gold.png",
    welcomeBonus: "Lên đến 200,000 điểm Membership Rewards®",
    minimumSpendUsd: 15_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 375,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Thẻ doanh nghiệp bậc giữa của American Express®: nhân điểm theo hạng mục chi tiêu nhiều nhất của doanh nghiệp.",
    editorsTake:
      "Nhẹ hơn Business Platinum cả về phí lẫn mức chi tiêu, vẫn cùng hệ điểm Membership Rewards® chuyển được sang Aeroplan®.",
    keyBenefits: [
      "4x điểm ở hai hạng mục doanh nghiệp chi nhiều nhất mỗi kỳ",
      "Chuyển điểm sang đối tác hàng không, có Aeroplan®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Business", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: MR_FROM_CANADA,
      watchOut: "Mức welcome offer khác nhau theo từng người và bạn có thể không đủ điều kiện nhận.",
    },
    applyUrl:
      "https://www.americanexpress.com/us/credit-cards/business/business-credit-cards/american-express-business-gold-card-amex/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "amex-business-green",
    name: "American Express® Business Green Card",
    issuerId: "amex",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/amex-business-green.png",
    welcomeBonus: "25,000 điểm Membership Rewards®",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Thẻ doanh nghiệp annual fee thấp trong hệ Membership Rewards®: phí $95 USD, 2x điểm khi đặt du lịch qua American Express Travel®.",
    editorsTake:
      "Annual fee $95 USD — trong các thẻ doanh nghiệp tích Membership Rewards® ở đây chỉ Blue Business® Plus (không annual fee) là rẻ hơn. American Express® ghi đây là offer đặc biệt, tăng từ 15,000 lên 25,000 điểm, nhưng không công bố ngày kết thúc. Lưu ý thẻ này CÓ phí giao dịch ngoại tệ 2.7%.",
    keyBenefits: [
      "2x điểm khi đặt du lịch qua American Express Travel®",
      "1x điểm cho mọi chi tiêu khác",
      "Chuyển điểm sang đối tác hàng không, có Aeroplan®",
    ],
    tags: ["Business", "Chuyển điểm", "Có phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: AMEX_FTF_27,
      pointsFromCanada: MR_FROM_CANADA,
      watchOut: "Thẻ Pay in Full: dư nợ phải trả hết mỗi kỳ sao kê.",
    },
    applyUrl:
      "https://www.americanexpress.com/us/credit-cards/business/business-credit-cards/american-express-business-green-card-amex/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "amex-blue-business-plus",
    name: "American Express® Blue Business® Plus Credit Card",
    issuerId: "amex",
    category: "travel",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/amex-blue-business-plus.png",
    welcomeBonus: "15,000 điểm Membership Rewards®",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 0,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Thẻ doanh nghiệp không annual fee tích điểm Membership Rewards®: 2x điểm cho mọi chi tiêu tới hạn mức mỗi năm.",
    editorsTake:
      "Cách rẻ nhất để giữ một tài khoản Membership Rewards® sống: không annual fee mà vẫn tích 2x điểm. Lưu ý thẻ này CÓ phí giao dịch ngoại tệ 2.7%.",
    keyBenefits: [
      "2x điểm cho mọi chi tiêu tới hạn mức hằng năm, sau đó 1x",
      "Không annual fee",
      "Chuyển điểm sang đối tác hàng không, có Aeroplan®",
    ],
    tags: ["Business", "Không annual fee", "Có phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: AMEX_FTF_27,
      pointsFromCanada: MR_FROM_CANADA,
      watchOut: "Không phí thường niên nhưng phí ngoại tệ 2.7% — đừng quẹt thẻ này ở Canada.",
    },
    applyUrl:
      "https://www.americanexpress.com/us/credit-cards/business/business-credit-cards/american-express-blue-business-plus-credit-card-amex/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "marriott-bonvoy-bevy",
    name: "Marriott Bonvoy Bevy® American Express® Card",
    issuerId: "amex",
    category: "hotel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/marriott-bonvoy-bevy.png",
    welcomeBonus: "85,000 điểm Marriott Bonvoy®",
    minimumSpendUsd: 5_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 250,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ Marriott Bonvoy® bậc giữa của American Express®: hạng Gold Elite tự động, 15 Elite Night Credits và 4x điểm ở nhà hàng.",
    editorsTake:
      "Welcome bonus 85,000 điểm sau khi chi $5,000 USD trong 6 tháng — offer giới hạn 125,000 điểm đã hết ngày 30/09/2026. Free Night Award chỉ đến khi chi $15,000 USD trong năm, nên với annual fee $250 USD thẻ này hợp người tiêu nhiều ở nhà hàng và ở siêu thị Mỹ.",
    keyBenefits: [
      "6x điểm ở khách sạn thuộc Marriott Bonvoy®; 4x ở nhà hàng toàn cầu và siêu thị Mỹ (tới $15,000 USD/năm, sau đó 2x); 2x cho mọi chi tiêu khác",
      "1 Free Night Award sau khi chi $15,000 USD trong năm",
      "Hạng Gold Elite tự động và 15 Elite Night Credits mỗi năm",
      "1,000 điểm thưởng cho mỗi lần ở trả tiền đặt thẳng với Marriott Bonvoy®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Elite status", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: BONVOY_FROM_CANADA,
      watchOut:
        "Marriott Bonvoy® giới hạn việc nhận bonus giữa các thẻ Marriott Bonvoy®, kể cả thẻ của Chase® — đọc điều khoản trước khi apply.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/marriott-bonvoy-bevy/",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "marriott-bonvoy-brilliant",
    name: "Marriott Bonvoy Brilliant® American Express® Card",
    issuerId: "amex",
    category: "hotel",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/marriott-bonvoy-brilliant.png",
    welcomeBonus: "100,000 điểm Marriott Bonvoy®",
    minimumSpendUsd: 6_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 650,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ Marriott Bonvoy® cao cấp nhất của American Express®: hạng Platinum Elite và đêm miễn phí hằng năm.",
    editorsTake:
      "Welcome bonus 100,000 điểm sau khi chi $6,000 USD trong 6 tháng — offer giới hạn 150,000 điểm đã hết ngày 30/09/2026. Annual fee $650 USD chỉ hợp lý nếu bạn dùng hết credit ăn uống $300 USD và đêm miễn phí tới 85,000 điểm mỗi năm.",
    keyBenefits: [
      "Hạng Platinum Elite tự động",
      "Free Night Award mỗi năm gia hạn (khách sạn tới 85,000 điểm/đêm)",
      "Credit ăn uống tới $300 USD mỗi năm ($25 USD mỗi tháng) ở nhà hàng toàn cầu",
      "6x điểm ở khách sạn thuộc Marriott Bonvoy®; 3x ở nhà hàng và vé máy bay mua thẳng với hãng; 2x cho mọi chi tiêu khác",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Elite status", "Đêm miễn phí"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: BONVOY_FROM_CANADA,
      watchOut:
        "Credit ăn uống chia $25 USD mỗi tháng — phải ăn ngoài bằng thẻ này đều đặn mới lấy đủ $300 USD. Marriott Bonvoy® giới hạn việc nhận bonus giữa các thẻ Marriott Bonvoy®, kể cả thẻ của Chase®.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/marriott-bonvoy-brilliant/",
    lastUpdated: VERIFIED_4,
    verifiedOn: VERIFIED_4,
    needsVerification: false,
  },
  {
    slug: "marriott-bonvoy-business-amex",
    name: "Marriott Bonvoy Business® American Express® Card",
    issuerId: "amex",
    category: "hotel",
    business: true,
    elevatedBonus: true,
    expiresAt: "2026-11-04",
    cardImage: "/images/us-cards/marriott-bonvoy-business-amex.png",
    welcomeBonus: "100,000 điểm Marriott Bonvoy® + 1 Free Night Award",
    minimumSpendUsd: 8_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 125,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ Marriott Bonvoy® doanh nghiệp: đêm miễn phí hằng năm và hạng Gold Elite với annual fee $125 USD.",
    editorsTake:
      "Offer kết thúc 04/11/2026. Free Night Award trong welcome offer dùng được ở khách sạn tới 50,000 điểm/đêm.",
    keyBenefits: [
      "6x điểm ở khách sạn thuộc Marriott Bonvoy®",
      "Free Night Award hằng năm (tới 35,000 điểm)",
      "Hạng Gold Elite tự động",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Business", "Đêm miễn phí"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: BONVOY_FROM_CANADA,
      watchOut:
        "Marriott Bonvoy® giới hạn việc nhận bonus giữa các thẻ Marriott Bonvoy®, kể cả thẻ của Chase®.",
    },
    applyUrl:
      "https://www.americanexpress.com/us/credit-cards/business/business-credit-cards/amex-marriott-bonvoy-business-credit-card/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "hilton-honors-surpass",
    name: "Hilton Honors American Express® Surpass® Card",
    issuerId: "amex",
    category: "hotel",
    business: false,
    elevatedBonus: true,
    expiresAt: "2027-01-13",
    cardImage: "/images/us-cards/hilton-honors-surpass.png",
    welcomeBonus: "130,000 điểm Hilton Honors® + 1 Free Night Reward",
    minimumSpendUsd: 3_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 150,
    rewardsCurrency: "Hilton Honors®",
    headline:
      "Thẻ Hilton® bậc giữa: hạng Gold Elite tự động và offer giới hạn thời gian 130,000 điểm.",
    editorsTake:
      "Mức chi tiêu $3,000 USD trong 6 tháng là dễ so với số điểm nhận được. Offer kết thúc 13/01/2027.",
    keyBenefits: [
      "Hạng Hilton Honors™ Gold tự động",
      "12x điểm ở khách sạn thuộc Hilton®",
      "Credit hằng quý cho chi tiêu tại Hilton®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Elite status", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: HILTON_FROM_CANADA,
      watchOut:
        "Điểm Hilton Honors® có giá trị mỗi điểm thấp — cần rất nhiều điểm cho một đêm.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/hilton-honors-surpass/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "hilton-honors-aspire",
    name: "Hilton Honors American Express® Aspire Card",
    issuerId: "amex",
    category: "hotel",
    business: false,
    elevatedBonus: true,
    expiresAt: "2027-01-13",
    cardImage: "/images/us-cards/hilton-honors-aspire.png",
    welcomeBonus: "200,000 điểm Hilton Honors®",
    minimumSpendUsd: 6_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 550,
    rewardsCurrency: "Hilton Honors®",
    headline:
      "Thẻ Hilton® cao cấp nhất: hạng Diamond tự động và đêm miễn phí hằng năm.",
    editorsTake:
      "American Express® gọi đây là offer điểm Hilton® cao nhất từ trước tới nay của thẻ này, kết thúc 13/01/2027. Hạng Diamond là thứ khó có được bằng cách khác.",
    keyBenefits: [
      "Hạng Hilton Honors™ Diamond tự động",
      "Free Night Reward hằng năm",
      "Credit resort và credit hãng bay hằng năm",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Elite status", "Đêm miễn phí"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: HILTON_FROM_CANADA,
      watchOut:
        "Nhiều credit chỉ dùng được ở Mỹ; annual fee $550 USD chỉ bù lại nếu bạn ở Hilton® thường xuyên.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/hilton-honors-aspire/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "hilton-honors-business-amex",
    name: "Hilton Honors American Express® Business Card",
    issuerId: "amex",
    category: "hotel",
    business: true,
    elevatedBonus: true,
    expiresAt: "2027-01-13",
    cardImage: "/images/us-cards/hilton-honors-business-amex.png",
    welcomeBonus: "150,000 điểm Hilton Honors® + 1 Free Night Reward",
    minimumSpendUsd: 8_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 195,
    rewardsCurrency: "Hilton Honors®",
    headline:
      "Bản doanh nghiệp của thẻ Hilton®: hạng Gold tự động và 12x điểm ở khách sạn Hilton®.",
    editorsTake:
      "Offer kết thúc 13/01/2027. Cùng hệ điểm và cùng hạng elite với bản cá nhân Surpass®, phí cao hơn $45 USD nhưng mức chi tiêu cũng cao hơn.",
    keyBenefits: [
      "Hạng Hilton Honors™ Gold tự động",
      "12x điểm ở khách sạn thuộc Hilton®",
      "Free Night Reward hằng năm sau khi chi tiêu đủ mức",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Hotel", "Business", "Elite status"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: HILTON_FROM_CANADA,
      watchOut: "Điểm Hilton Honors® có giá trị mỗi điểm thấp so với Aeroplan® hay World of Hyatt®.",
    },
    applyUrl:
      "https://www.americanexpress.com/us/credit-cards/business/business-credit-cards/hilton-honors/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "atmos-rewards-summit",
    name: "Atmos™ Rewards Summit Visa Infinite® Credit Card",
    issuerId: "bank-of-america",
    category: "airline",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/atmos-summit.png",
    welcomeBonus: "70,000 điểm Atmos™ Rewards + Global Companion Award 25,000 điểm",
    minimumSpendUsd: 3_000,
    offerPeriod: "90 ngày đầu",
    annualFeeUsd: 395,
    rewardsCurrency: "Atmos™ Rewards",
    headline:
      "Thẻ cao cấp của chương trình Atmos™ Rewards (Alaska Airlines® và Hawaiian Airlines®): Global Companion Award mỗi năm và lounge Alaska®.",
    editorsTake:
      "Bank of America® ghi đây là offer giới hạn thời gian nhưng không công bố ngày kết thúc. Global Companion Award 25,000 điểm mỗi năm gia hạn là thứ bù lại phần lớn annual fee nếu bạn bay Alaska Airlines® hoặc Hawaiian Airlines®.",
    keyBenefits: [
      "Global Companion Award 25,000 điểm mỗi năm gia hạn thẻ",
      "3 điểm mỗi $1 USD ở nhà hàng, giao dịch ngoại tệ và vé Alaska Airlines®/Hawaiian Airlines®",
      "Vào Alaska Lounge®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Airline", "Companion award", "Không phí ngoại tệ"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: ATMOS_FROM_CANADA,
      watchOut:
        "Chương trình Atmos™ Rewards là bản gộp của Alaska Airlines® và Hawaiian Airlines® — điều khoản còn mới, đọc kỹ trước khi tính đường đổi điểm dài hạn.",
    },
    applyUrl: "https://www.bankofamerica.com/credit-cards/products/alaska-airlines-infinite-credit-card/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "atmos-rewards-ascent",
    name: "Atmos™ Rewards Ascent Visa Signature® Credit Card",
    issuerId: "bank-of-america",
    category: "airline",
    business: false,
    elevatedBonus: false,
    cardImage: "/images/us-cards/atmos-ascent.png",
    welcomeBonus: "50,000 điểm Atmos™ Rewards + Companion Fare $99 USD",
    minimumSpendUsd: 1_500,
    offerPeriod: "90 ngày đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Atmos™ Rewards",
    headline:
      "Bản kế nhiệm của thẻ Alaska Airlines® Visa: Companion Fare $99 USD mỗi năm và hành lý ký gửi miễn phí.",
    editorsTake:
      "Mức chi tiêu $1,500 USD trong 90 ngày là thấp nhất trong nhóm thẻ hãng bay ở đây. Companion Fare hằng năm đòi chi $6,000 USD trong năm trước đó mới nhận được.",
    keyBenefits: [
      "Companion Fare $99 USD (cộng thuế phí từ $23 USD) mỗi năm gia hạn, sau khi chi $6,000 USD trong năm",
      "Hành lý ký gửi miễn phí và ưu tiên lên máy bay cho tối đa 6 người cùng đặt chỗ",
      "3 điểm mỗi $1 USD cho vé Alaska Airlines® và Hawaiian Airlines®",
      "2 điểm ở xăng, sạc xe điện, streaming và giao thông địa phương",
    ],
    tags: ["Airline", "Companion fare", "Hành lý miễn phí"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED,
      foreignTransactionFee: BOA_FTF_UNKNOWN,
      pointsFromCanada: ATMOS_FROM_CANADA,
      watchOut:
        "Companion Fare chỉ dùng cho chuyến của Alaska Airlines® và Hawaiian Airlines® trong Bắc Mỹ.",
    },
    applyUrl: "https://www.bankofamerica.com/credit-cards/products/alaska-airlines-credit-card/",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
  {
    slug: "atmos-rewards-business",
    name: "Atmos™ Rewards Visa Signature® Business Card",
    issuerId: "bank-of-america",
    category: "airline",
    business: true,
    elevatedBonus: false,
    cardImage: "/images/us-cards/atmos-business.png",
    welcomeBonus: "70,000 điểm Atmos™ Rewards + Companion Fare $99 USD",
    minimumSpendUsd: 4_000,
    offerPeriod: "90 ngày đầu",
    annualFeeUsd: 70,
    annualFeeNote: "thêm $25 USD/năm cho mỗi thẻ",
    rewardsCurrency: "Atmos™ Rewards",
    headline:
      "Bản doanh nghiệp của thẻ Atmos™ Rewards: annual fee $70 USD cho công ty cộng $25 USD mỗi thẻ, Companion Fare hằng năm.",
    editorsTake:
      "Phí công ty $70 USD cộng $25 USD mỗi thẻ, nên công ty một thẻ trả $95 USD mỗi năm. Cùng Companion Fare và hành lý miễn phí như bản cá nhân.",
    keyBenefits: [
      "Companion Fare $99 USD (cộng thuế phí từ $23 USD) mỗi năm gia hạn, sau khi chi $6,000 USD trong năm",
      "Hành lý ký gửi miễn phí và ưu tiên lên máy bay",
      "3 điểm mỗi $1 USD cho vé Alaska Airlines® và Hawaiian Airlines®",
      "2 điểm ở xăng, sạc xe điện, vận chuyển và giao thông địa phương",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Airline", "Business", "Companion fare"],
    canada: {
      itin: ITIN_REQUIRED,
      usCreditHistory: HISTORY_REQUIRED,
      usAddress: ADDRESS_REQUIRED_BUSINESS,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: ATMOS_FROM_CANADA,
      watchOut: "Phí thẻ tính theo từng thẻ nhân viên, khác với thẻ doanh nghiệp của Chase® và American Express®.",
    },
    applyUrl: "https://business.bankofamerica.com/en/credit-cards/atmos-rewards",
    lastUpdated: VERIFIED_3,
    verifiedOn: REVERIFIED,
    needsVerification: false,
  },
];

function toOffer(card: UsCardData): UsCreditCardOffer {
  return {
    slug: card.slug,
    name: card.name,
    issuer: usIssuerById(card.issuerId).name,
    image: "credit-card",
    cardImage: card.cardImage ?? "",
    country: "US",
    annualFee: annualFeeText(card.annualFeeUsd, card.annualFeeNote),
    // Đúng hai giá trị thẻ Canada đang dùng, để huy hiệu đọc giống hệt nhau.
    cardType: card.business ? "Thẻ doanh nghiệp" : "Thẻ cá nhân",
    welcomeBonus: card.welcomeBonus,
    headline: card.headline,
    editorsTake: card.editorsTake,
    keyBenefits: card.keyBenefits,
    elevatedBonus: card.elevatedBonus,
    expiresAt: card.expiresAt,
    applyUrl: card.applyUrl,
    updatedAt: card.lastUpdated,
    us: {
      issuerId: card.issuerId,
      currency: "USD",
      category: card.category,
      business: card.business,
      rewardsCurrency: card.rewardsCurrency,
      annualFeeUsd: card.annualFeeUsd,
      minimumSpendUsd: card.minimumSpendUsd,
      offerPeriod: card.offerPeriod,
      offerEndUnannounced: card.offerEndUnannounced,
      tags: card.tags,
      canada: card.canada,
      lastUpdated: card.lastUpdated,
      verifiedOn: card.verifiedOn,
      sourceUrl: card.sourceUrl,
      needsVerification: card.needsVerification,
      hidden: card.hidden,
    },
  };
}

/** Mọi thẻ, kể cả số liệu mẫu và thẻ đang ẩn — chỉ cho test và audit. Trang gọi `getUsCreditCards`. */
export const ALL_US_CARDS: UsCreditCardOffer[] = US_CARD_DATA.map(toOffer);

/**
 * Thẻ Mỹ được phép hiện. Chưa công bố: tất cả, số liệu mẫu mang nhãn. Đã
 * công bố: chỉ thẻ đã kiểm. Thẻ `hidden` thì không bao giờ hiện.
 */
export function getUsCreditCards(published = US_CARDS_PUBLISHED): UsCreditCardOffer[] {
  const shown = ALL_US_CARDS.filter((card) => !card.us.hidden);
  return published ? shown.filter((card) => !card.us.needsVerification) : shown;
}

export function usCardPath(slug: string): string {
  return `${US_CARDS_BASE}/${slug}`;
}

/** Bộ lọc loại thẻ. "business" là trục riêng, không phải một `category`. */
export const US_CARD_FILTERS = [
  "all",
  "travel",
  "airline",
  "hotel",
  "cashback",
  "business",
] as const;
export type UsCardFilter = (typeof US_CARD_FILTERS)[number];

export function usCardFilter(value: string | undefined): UsCardFilter {
  return US_CARD_FILTERS.find((filter) => filter === value) ?? "all";
}

export function matchesUsCardFilter(card: UsCreditCardOffer, filter: UsCardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "business") return card.us.business;
  // Thẻ doanh nghiệp chỉ nằm ở mục Business, để mục Travel là thẻ cá nhân —
  // người lọc "Travel" gần như không bao giờ tìm thẻ đòi doanh nghiệp ở Mỹ.
  return !card.us.business && card.us.category === filter;
}

/** Bộ lọc loại mà thẻ này thuộc về — đúng một, xem `matchesUsCardFilter`. */
export function usCardFilterOf(card: UsCreditCardOffer): Exclude<UsCardFilter, "all"> {
  return card.us.business ? "business" : card.us.category;
}

/**
 * Hai nhóm thẻ anh em cho trang một thẻ Mỹ: cùng loại điểm, và cùng nhóm lọc
 * (Travel/Airline/Hotel/Business).
 *
 * Tồn tại vì đo 30/09/2026 cả 33 trang thẻ Mỹ chỉ có ĐÚNG MỘT link nội bộ trỏ
 * vào — từ trang tổng. Lấy theo VÒNG (`ringAfter`) chứ không phải ba thẻ đầu,
 * cùng lý do với thẻ Canada. Hai trục chứ không một: loại điểm bỏ sót thẻ duy
 * nhất của hệ mình (Citi®, Bilt, United℠, Ink Business Premier®), còn mọi nhóm
 * lọc đều có từ ba thẻ trở lên nên không thẻ nào bị bỏ lại.
 *
 * Thẻ đã có trong nhóm loại điểm thì không lặp ở nhóm lọc: trang đó vẫn trỏ
 * tới thẻ ấy, nên số trang trỏ vào mỗi thẻ không giảm.
 */
export function usCardSiblings(
  card: UsCreditCardOffer,
  cards: UsCreditCardOffer[],
  limit = 3,
): { sameCurrency: UsCreditCardOffer[]; filter: Exclude<UsCardFilter, "all">; sameFilter: UsCreditCardOffer[] } {
  const isSelf = (other: UsCreditCardOffer) => other.slug === card.slug;
  const currencyFamily = cards.filter((other) => other.us.rewardsCurrency === card.us.rewardsCurrency);
  const sameCurrency = currencyFamily.length > 1 ? ringAfter(currencyFamily, isSelf, limit) : [];

  // Đi hết vòng rồi mới bỏ thẻ đã hiện và cắt `limit` — cắt trước thì vài thẻ
  // khách sạn và doanh nghiệp ra khối rỗng, vì ba thẻ đứng sau chúng trong nhóm
  // lọc cũng chính là ba thẻ cùng loại điểm. (Comment không ghi tên thẻ kèm ký
  // hiệu: `audit:trademarks` học thương hiệu từ đó, xem AGENTS.md.)
  const filter = usCardFilterOf(card);
  const shown = new Set(sameCurrency.map((other) => other.slug));
  const filterFamily = cards.filter((other) => matchesUsCardFilter(other, filter));
  const sameFilter = ringAfter(filterFamily, isSelf, filterFamily.length)
    .filter((other) => !shown.has(other.slug))
    .slice(0, limit);

  return { sameCurrency, filter, sameFilter };
}

export function usIssuerId(value: string | undefined): UsIssuerId | undefined {
  return US_ISSUERS.find((issuer) => issuer.id === value)?.id;
}

/**
 * URL của danh sách với một tổ hợp bộ lọc. Luôn kèm `#tat-ca-the-my`: danh
 * sách nằm dưới hai khu khác, và đổi bộ lọc mà bị đưa về đầu trang thì người
 * đọc phải cuộn lại mỗi lần bấm.
 */
export function usCardsListPath({
  filter,
  issuer,
}: {
  filter?: UsCardFilter;
  issuer?: UsIssuerId;
}): string {
  const params = new URLSearchParams();
  if (filter && filter !== "all") params.set("type", filter);
  if (issuer) params.set("issuer", issuer);
  const query = params.toString();
  return `${US_CARDS_BASE}${query ? `?${query}` : ""}#${US_CARDS_LIST_ANCHOR}`;
}
