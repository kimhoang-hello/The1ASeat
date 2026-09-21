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

export { US_CARDS_BASE };

/** `id` của khu "Tất cả thẻ Mỹ" — mọi link lọc nhảy thẳng về đây. */
export const US_CARDS_LIST_ANCHOR = "tat-ca-the-my";

/**
 * Bài hướng dẫn chơi thẻ Mỹ từ Canada (ITIN → thẻ US đầu tiên → US credit
 * history). CHƯA CÓ lúc dựng trang này. Trang tự kiểm bài có tồn tại không:
 * đã công bố mà bài chưa có thì các nút "Xem hướng dẫn" tự ẩn, không dẫn
 * người đọc tới trang 404.
 */
export const US_CARDS_GUIDE_SLUG = "choi-the-my-tu-canada";

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
export type UsCardCategory = "travel" | "airline" | "hotel";

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
  featured: boolean;
  rewardsCurrency: string;
  annualFeeUsd: number;
  /** Điều kiện nhận welcome bonus. Vắng khi thẻ không có welcome bonus. */
  minimumSpendUsd?: number;
  offerPeriod?: string;
  /** Vài quyền lợi ngắn làm tag trên thẻ trong danh sách. */
  tags: string[];
  canada: UsCardCanadianPerspective;
  /** Ngày sửa dữ liệu gần nhất (YYYY-MM-DD). */
  lastUpdated: string;
  /** Ngày đối chiếu với trang ngân hàng. Vắng khi còn là số liệu mẫu. */
  verifiedOn?: string;
  /** `true` = số liệu mẫu, chưa kiểm. Không bao giờ hiện khi đã công bố. */
  needsVerification: boolean;
};

export type UsCreditCardOffer = CreditCardOffer & { country: "US"; us: UsCardDetails };

type UsCardData = {
  slug: string;
  name: string;
  issuerId: UsIssuerId;
  category: UsCardCategory;
  business: boolean;
  featured: boolean;
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
  lastUpdated: string;
  verifiedOn?: string;
  needsVerification: boolean;
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
const HISTORY_USUALLY: CanadianAnswer = {
  short: "Thường là cần",
  note: "Chưa có lịch sử tín dụng ở Mỹ thì khả năng được duyệt thấp. Credit score Canada không tự chuyển sang Mỹ.",
};
const ADDRESS_USUALLY: CanadianAnswer = {
  short: "Thường là cần",
  note: "Đơn online đòi địa chỉ ở Mỹ. Địa chỉ nhận hàng (mailbox) có được chấp nhận hay không là tuỳ ngân hàng.",
};

// Nguồn: trang sản phẩm chính thức của từng ngân hàng, đọc trực tiếp ngày
// 21/09/2026 (URL chính là `applyUrl` của thẻ). Welcome offer Mỹ đổi thường
// xuyên và nhiều offer của American Express® là "as high as" — con số ghi ở
// đây là mức cao nhất trang công bố, không phải mức mọi người đều nhận.
const VERIFIED = "2026-09-21";

const US_CARD_DATA: UsCardData[] = [
  {
    slug: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred® Card",
    issuerId: "chase",
    category: "travel",
    business: false,
    featured: true,
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
      itin: {
        short: "Tuỳ trường hợp",
        note: "Chase® không công bố điều kiện cho người dùng ITIN. Có người được duyệt, có người không — xem như chưa chắc.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Ultimate Rewards® chuyển được sang Aeroplan®, nên điểm dùng được cho chuyến bay xuất phát từ Canada.",
      },
      watchOut:
        "Chase® thường từ chối người đã mở từ 5 thẻ (của mọi ngân hàng) trong 24 tháng — luật \"5/24\" không có trong điều khoản nhưng được nhiều người xác nhận. Welcome bonus cũng không dành cho người đang có thẻ này.",
    },
    applyUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "amex-gold-us",
    name: "American Express® Gold Card",
    issuerId: "amex",
    category: "travel",
    business: false,
    featured: true,
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
      itin: {
        short: "Tuỳ trường hợp",
        note: "Người đang có thẻ American Express® Canada có thể xin thẻ Mỹ qua chương trình Global Transfer — điều kiện cụ thể phải xem lúc apply.",
      },
      usCreditHistory: {
        short: "Không nhất thiết",
        note: "Qua Global Transfer, American Express® xét cả lịch sử thẻ American Express® ở Canada.",
      },
      usAddress: {
        short: "Cần",
        note: "Thẻ và thư gửi về địa chỉ ở Mỹ.",
      },
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Membership Rewards® Mỹ chuyển được sang Aeroplan® và nhiều hãng bay khác.",
      },
      watchOut:
        "Mức welcome offer khác nhau theo từng người và bạn có thể không đủ điều kiện nhận. Credit ăn uống, Uber và Dunkin' chỉ dùng được ở Mỹ.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "capital-one-venture-x",
    name: "Capital One® Venture X Card",
    issuerId: "capital-one",
    category: "travel",
    business: false,
    featured: true,
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
      itin: {
        short: "Tuỳ trường hợp",
        note: "Capital One® không công bố điều kiện cho người dùng ITIN, và thẻ cao cấp như Venture X yêu cầu hồ sơ tín dụng tốt.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Capital One® Miles chuyển 1:1 sang Aeroplan®.",
      },
      watchOut: "Capital One® kéo báo cáo tín dụng từ cả ba credit bureau khi xét đơn.",
    },
    applyUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "citi-strata-premier",
    name: "Citi Strata Premier® Card",
    issuerId: "citi",
    category: "travel",
    business: false,
    featured: false,
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
      itin: {
        short: "Tuỳ trường hợp",
        note: "Citi® không công bố điều kiện cho người dùng ITIN.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
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
    featured: false,
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
      itin: {
        short: "Chưa rõ",
        note: "Bilt không công bố điều kiện cho người dùng ITIN.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
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
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "bank-of-america-premium-rewards",
    name: "Bank of America® Premium Rewards® Credit Card",
    issuerId: "bank-of-america",
    category: "travel",
    business: false,
    featured: false,
    cardImage: "/images/us-cards/bank-of-america-premium-rewards.png",
    welcomeBonus: "60,000 điểm",
    minimumSpendUsd: 4_000,
    offerPeriod: "90 ngày đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Bank of America® Points",
    headline:
      "Thẻ travel của Bank of America®: 2x du lịch và ăn uống, 1.5x mọi thứ khác, điểm quy thẳng ra tiền.",
    editorsTake:
      "Điểm không chuyển được sang hãng bay, nên thẻ này hợp với người muốn đơn giản — welcome bonus 60,000 điểm tương đương $600 USD — hơn là người săn vé thương gia.",
    keyBenefits: [
      "2x điểm ở du lịch và ăn uống, 1.5x mọi chi tiêu khác, không giới hạn",
      "Credit phụ phí hãng bay tới $100 USD mỗi năm (hành lý, chọn ghế, lounge)",
      "Credit TSA PreCheck® hoặc Global Entry tới $100 USD, 4 năm một lần",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Travel", "Quy ra tiền", "Không phí ngoại tệ"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Bank of America® không công bố điều kiện cho người dùng ITIN.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Hạn chế",
        note: "Điểm chỉ quy ra tiền, credit thẻ hoặc đặt qua BofA Travel — không chuyển được sang Aeroplan®.",
      },
      watchOut:
        "Điểm quy ra tiền vào tài khoản Bank of America® — tiện nhất khi bạn có tài khoản ngân hàng ở Mỹ.",
    },
    applyUrl: "https://www.bankofamerica.com/credit-cards/products/premium-rewards-credit-card/",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "delta-skymiles-gold-amex",
    name: "Delta SkyMiles® Gold American Express® Card",
    issuerId: "amex",
    category: "airline",
    business: false,
    featured: false,
    cardImage: "/images/us-cards/delta-skymiles-gold-amex.png",
    welcomeBonus: "Lên đến 80,000 miles Delta SkyMiles® + $250 USD",
    minimumSpendUsd: 3_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 150,
    annualFeeNote: "năm đầu $0 USD",
    rewardsCurrency: "Delta SkyMiles®",
    expiresAt: "2026-11-04",
    headline:
      "Thẻ hãng bay Delta® của American Express®: hành lý ký gửi miễn phí và giảm 15% khi đổi vé bằng miles.",
    editorsTake:
      "Offer hiện tại có thêm statement credit $250 USD cùng điều kiện chi tiêu, và năm đầu không mất phí. Chỉ đáng giữ lâu nếu bạn hay bay Delta® từ các sân bay Mỹ gần biên giới.",
    keyBenefits: [
      "Hành lý ký gửi đầu tiên miễn phí trên chuyến Delta®, thêm kiện thứ hai trên chuyến nội địa Mỹ",
      "Giảm 15% khi đổi vé Delta® bằng miles trên delta.com (TakeOff 15)",
      "2x miles ở nhà hàng, siêu thị Mỹ và khi mua trực tiếp với Delta®",
      "Credit chuyến bay $200 USD sau khi chi $10,000 USD trong một năm",
    ],
    tags: ["Hành lý miễn phí", "Delta®", "Không phí ngoại tệ"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Giống các thẻ American Express® Mỹ khác.",
      },
      usCreditHistory: {
        short: "Không nhất thiết",
        note: "Người đang có thẻ American Express® Canada có thể đi qua Global Transfer.",
      },
      usAddress: { short: "Cần" },
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Tuỳ chặng bay",
        note: "Delta SkyMiles® dùng được cho chuyến Delta® và đối tác SkyTeam, không chuyển sang Aeroplan®.",
      },
      watchOut:
        "Delta SkyMiles® không có award chart cố định — số miles cho một vé thay đổi theo ngày. Welcome offer là \"lên đến\" và có thể khác theo từng người.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold-american-express-card/",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "marriott-bonvoy-boundless",
    name: "Marriott Bonvoy Boundless® Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    featured: false,
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
      itin: {
        short: "Tuỳ trường hợp",
        note: "Giống các thẻ Chase® khác.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
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
    verifiedOn: VERIFIED,
    needsVerification: false,
  },
  {
    slug: "chase-ink-business-preferred",
    name: "Ink Business Preferred® Credit Card",
    issuerId: "chase",
    category: "travel",
    business: true,
    featured: false,
    cardImage: "/images/us-cards/chase-ink-business-preferred.png",
    welcomeBonus: "100,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 8_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ doanh nghiệp của Chase®: 100,000 điểm Ultimate Rewards®, 3x ở du lịch, vận chuyển, quảng cáo và internet.",
    editorsTake:
      "Welcome bonus cao nhất trong ba thẻ Chase® trên trang này, nhưng chỉ dành cho người có doanh nghiệp ở Mỹ. Điểm cùng hệ Ultimate Rewards® với Sapphire Preferred® nên chuyển được sang Aeroplan®.",
    keyBenefits: [
      "3x điểm ở du lịch, vận chuyển, quảng cáo mạng xã hội và internet/điện thoại (tới $150,000 USD/năm)",
      "Thẻ nhân viên miễn phí",
      "Chuyển điểm sang đối tác của Ultimate Rewards®, có Aeroplan®",
      "Không phí giao dịch ngoại tệ",
    ],
    tags: ["Business", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Doanh nghiệp cần EIN; người đứng tên vẫn cần SSN hoặc ITIN.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: {
        short: "Cần",
        note: "Doanh nghiệp phải có địa chỉ ở Mỹ.",
      },
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Ultimate Rewards® chuyển được sang Aeroplan®.",
      },
      watchOut: "Không nhận welcome bonus nếu đã từng có thẻ này.",
    },
    applyUrl: "https://creditcards.chase.com/business-credit-cards/ink/business-preferred",
    lastUpdated: VERIFIED,
    verifiedOn: VERIFIED,
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
    elevatedBonus: false,
    expiresAt: card.expiresAt,
    applyUrl: card.applyUrl,
    updatedAt: card.lastUpdated,
    us: {
      issuerId: card.issuerId,
      currency: "USD",
      category: card.category,
      business: card.business,
      featured: card.featured,
      rewardsCurrency: card.rewardsCurrency,
      annualFeeUsd: card.annualFeeUsd,
      minimumSpendUsd: card.minimumSpendUsd,
      offerPeriod: card.offerPeriod,
      tags: card.tags,
      canada: card.canada,
      lastUpdated: card.lastUpdated,
      verifiedOn: card.verifiedOn,
      needsVerification: card.needsVerification,
    },
  };
}

/** Mọi thẻ, kể cả số liệu mẫu — chỉ cho test và audit. Trang gọi `getUsCreditCards`. */
export const ALL_US_CARDS: UsCreditCardOffer[] = US_CARD_DATA.map(toOffer);

/**
 * Thẻ Mỹ được phép hiện. Chưa công bố: tất cả, số liệu mẫu mang nhãn. Đã
 * công bố: chỉ thẻ đã kiểm.
 */
export function getUsCreditCards(published = US_CARDS_PUBLISHED): UsCreditCardOffer[] {
  return published ? ALL_US_CARDS.filter((card) => !card.us.needsVerification) : ALL_US_CARDS;
}

export function usCardPath(slug: string): string {
  return `${US_CARDS_BASE}/${slug}`;
}

/** Bộ lọc loại thẻ. "business" là trục riêng, không phải một `category`. */
export const US_CARD_FILTERS = ["all", "travel", "airline", "hotel", "business"] as const;
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
