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
// ⚠︎ SỐ LIỆU MẪU. Mọi thẻ dưới đây mang `needsVerification: true`: welcome
// bonus, điều kiện chi tiêu, annual fee và các câu trả lời "Góc nhìn từ Canada"
// là giá trị để dựng và thử giao diện, CHƯA đối chiếu với trang ngân hàng.
// Trong lúc `US_CARDS_PUBLISHED` còn tắt, trang hiện chúng kèm nhãn "Số liệu
// mẫu"; bật cờ lên thì `getUsCreditCards()` tự bỏ mọi thẻ còn cờ này — không
// có đường nào để số liệu mẫu hiện ra như offer thật trước người đọc.
// Đuôi `.ts` để `node --test` import thẳng được file này (xem test đi kèm).
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

const US_CARD_DATA: UsCardData[] = [
  {
    slug: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred® Card",
    issuerId: "chase",
    category: "travel",
    business: false,
    featured: true,
    welcomeBonus: "75,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 5_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ travel nhập môn quen thuộc ở Mỹ: annual fee thấp, điểm Ultimate Rewards® chuyển được sang Aeroplan®.",
    editorsTake:
      "Nội dung mẫu. Nếu bạn đã có US credit history, đây thường là thẻ Chase® đầu tiên đáng cân nhắc: phí thấp, điểm chuyển được sang nhiều hãng bay và khách sạn.",
    keyBenefits: [
      "Nhân điểm cho du lịch, ăn uống và dịch vụ streaming",
      "Chuyển điểm 1:1 sang đối tác hàng không và khách sạn",
      "Bảo hiểm chuyến đi và bảo hiểm xe thuê",
    ],
    tags: ["Travel", "Chuyển điểm", "Không phí ngoại tệ"],
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
        "Chase® có luật 5/24: đã mở từ 5 thẻ (của mọi ngân hàng Mỹ) trong 24 tháng thì gần như bị từ chối.",
    },
    applyUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "amex-gold-us",
    name: "American Express® Gold Card",
    issuerId: "amex",
    category: "travel",
    business: false,
    featured: true,
    welcomeBonus: "60,000 điểm Membership Rewards®",
    minimumSpendUsd: 6_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 325,
    rewardsCurrency: "Membership Rewards®",
    headline:
      "Bản Mỹ của thẻ Gold: nhân điểm cao ở nhà hàng và siêu thị Mỹ, điểm Membership Rewards® chuyển sang Aeroplan®.",
    editorsTake:
      "Nội dung mẫu. Thẻ American Express® Mỹ thường là cửa dễ nhất cho người đang có thẻ American Express® Canada, nhờ chương trình chuyển quan hệ thẻ giữa các nước.",
    keyBenefits: [
      "Nhân điểm cao ở nhà hàng và siêu thị tại Mỹ",
      "Credit hằng tháng cho ăn uống",
      "Chuyển điểm sang đối tác hàng không và khách sạn",
    ],
    tags: ["Ăn uống", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Người đang có thẻ American Express® Canada có thể xin thẻ Mỹ qua chương trình Global Transfer mà không cần SSN — điều kiện cụ thể phải xem lúc apply.",
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
        "Welcome bonus của American Express® Mỹ thường chỉ nhận được một lần cho mỗi thẻ trong đời.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "capital-one-venture-x",
    name: "Capital One® Venture X Card",
    issuerId: "capital-one",
    category: "travel",
    business: false,
    featured: true,
    welcomeBonus: "75,000 miles Capital One®",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 395,
    rewardsCurrency: "Capital One® Miles",
    headline:
      "Thẻ travel cao cấp của Capital One®: credit du lịch hằng năm, lounge, và miles chuyển được sang Aeroplan®.",
    editorsTake:
      "Nội dung mẫu. Credit du lịch và điểm thưởng năm gần như bù lại annual fee, nếu bạn đặt vé qua cổng du lịch của Capital One®.",
    keyBenefits: [
      "Credit du lịch hằng năm khi đặt qua cổng Capital One®",
      "Điểm thưởng mỗi năm gia hạn thẻ",
      "Vào lounge Capital One® và Priority Pass",
    ],
    tags: ["Lounge", "Chuyển điểm", "Không phí ngoại tệ"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Capital One® nhận đơn có ITIN theo báo cáo của người dùng, nhưng thẻ cao cấp như Venture X vẫn đòi hồ sơ tín dụng tốt.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Capital One® Miles chuyển được sang Aeroplan®.",
      },
      watchOut: "Capital One® kéo báo cáo tín dụng từ cả ba credit bureau khi xét đơn.",
    },
    applyUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "citi-strata-premier",
    name: "Citi® Strata Premier℠ Card",
    issuerId: "citi",
    category: "travel",
    business: false,
    featured: false,
    welcomeBonus: "60,000 điểm ThankYou®",
    minimumSpendUsd: 4_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "ThankYou® Points",
    headline:
      "Thẻ travel annual fee thấp của Citi®, nhân điểm rộng ở vé máy bay, khách sạn, nhà hàng, siêu thị và xăng.",
    editorsTake:
      "Nội dung mẫu. Hợp với người muốn thêm một hệ điểm chuyển được sang các hãng bay ngoài liên minh Star Alliance®.",
    keyBenefits: [
      "Nhân điểm ở vé máy bay, khách sạn, nhà hàng, siêu thị và xăng",
      "Credit khách sạn hằng năm",
      "Chuyển điểm sang đối tác hàng không",
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
        note: "ThankYou® không chuyển sang Aeroplan®, nhưng có các đối tác như Flying Blue® và Turkish Airlines.",
      },
      watchOut: "Citi® giới hạn welcome bonus theo số thẻ Citi® đã mở gần đây — đọc điều khoản trước khi apply.",
    },
    applyUrl: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "bilt-mastercard",
    name: "Bilt Mastercard®",
    issuerId: "bilt",
    category: "travel",
    business: false,
    featured: false,
    annualFeeUsd: 0,
    rewardsCurrency: "Bilt Points",
    headline:
      "Thẻ không annual fee tích điểm khi trả tiền thuê nhà, và điểm Bilt chuyển được sang Aeroplan®.",
    editorsTake:
      "Nội dung mẫu. Thẻ này bán cách tích điểm chứ không bán welcome bonus — hợp nhất với người đang thuê nhà ở Mỹ.",
    keyBenefits: [
      "Tích điểm khi trả tiền thuê nhà",
      "Nhân điểm vào ngày 1 hằng tháng",
      "Chuyển điểm sang đối tác hàng không và khách sạn",
    ],
    tags: ["Không annual fee", "Tiền nhà", "Chuyển điểm"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Điều kiện cho người dùng ITIN chưa rõ.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Có",
        note: "Bilt Points chuyển được sang Aeroplan®.",
      },
      watchOut: "Phải có số giao dịch tối thiểu mỗi kỳ sao kê thì mới được tính điểm.",
    },
    applyUrl: "https://www.bilt.com/card",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "bank-of-america-premium-rewards",
    name: "Bank of America® Premium Rewards® Credit Card",
    issuerId: "bank-of-america",
    category: "travel",
    business: false,
    featured: false,
    welcomeBonus: "60,000 điểm",
    minimumSpendUsd: 4_000,
    offerPeriod: "90 ngày đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Bank of America® Points",
    headline:
      "Thẻ travel của Bank of America®: điểm quy thẳng ra tiền, có credit du lịch hằng năm.",
    editorsTake:
      "Nội dung mẫu. Điểm không chuyển được sang hãng bay, nên thẻ này hợp với người muốn đơn giản hơn là người săn vé thương gia.",
    keyBenefits: [
      "Credit du lịch hằng năm",
      "Credit phí TSA PreCheck® hoặc Global Entry",
      "Điểm quy ra tiền, không có hạn",
    ],
    tags: ["Travel", "Quy ra tiền", "Không phí ngoại tệ"],
    canada: {
      itin: {
        short: "Tuỳ trường hợp",
        note: "Bank of America® thường yêu cầu mở tài khoản ngân hàng trước — điều kiện ITIN chưa rõ.",
      },
      usCreditHistory: HISTORY_USUALLY,
      usAddress: ADDRESS_USUALLY,
      foreignTransactionFee: NO_FTF,
      pointsFromCanada: {
        short: "Hạn chế",
        note: "Điểm chỉ quy ra tiền hoặc credit du lịch, không chuyển được sang Aeroplan®.",
      },
      watchOut: "Bank of America® có luật riêng về số thẻ mở trong 12–24 tháng.",
    },
    applyUrl: "https://www.bankofamerica.com/credit-cards/products/premium-rewards-credit-card/",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "delta-skymiles-gold-amex",
    name: "Delta SkyMiles® Gold American Express® Card",
    issuerId: "amex",
    category: "airline",
    business: false,
    featured: false,
    welcomeBonus: "50,000 miles Delta SkyMiles®",
    minimumSpendUsd: 2_000,
    offerPeriod: "6 tháng đầu",
    annualFeeUsd: 150,
    annualFeeNote: "năm đầu $0 USD",
    rewardsCurrency: "Delta SkyMiles®",
    headline:
      "Thẻ hãng bay Delta® của American Express®: hành lý ký gửi miễn phí và miles Delta SkyMiles®.",
    editorsTake:
      "Nội dung mẫu. Chỉ đáng giữ nếu bạn hay bay Delta® từ các sân bay gần biên giới Canada.",
    keyBenefits: [
      "Hành lý ký gửi đầu tiên miễn phí trên chuyến Delta®",
      "Nhân miles khi mua vé Delta®, ăn uống và siêu thị Mỹ",
      "Ưu tiên lên máy bay",
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
      watchOut: "Delta SkyMiles® không có award chart cố định — giá vé đổi bằng miles thay đổi theo ngày.",
    },
    applyUrl: "https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold-american-express-card/",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "marriott-bonvoy-boundless",
    name: "Marriott Bonvoy Boundless® Credit Card",
    issuerId: "chase",
    category: "hotel",
    business: false,
    featured: false,
    welcomeBonus: "3 Free Night Awards",
    minimumSpendUsd: 3_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Marriott Bonvoy®",
    headline:
      "Thẻ khách sạn Marriott Bonvoy® của Chase®: một đêm miễn phí mỗi năm gia hạn thẻ.",
    editorsTake:
      "Nội dung mẫu. Đêm miễn phí hằng năm thường đáng hơn annual fee nếu bạn ở Marriott Bonvoy® ít nhất một lần mỗi năm.",
    keyBenefits: [
      "Một Free Night Award mỗi năm gia hạn thẻ",
      "Hạng Silver Elite tự động",
      "Nhân điểm ở khách sạn Marriott Bonvoy®",
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
        note: "Marriott Bonvoy® là một chương trình chung, nên điểm từ thẻ Mỹ dùng được ở khách sạn Canada.",
      },
      watchOut: "Thẻ này chịu luật 5/24 của Chase®, và Marriott Bonvoy® có luật riêng về việc nhận bonus giữa các thẻ Marriott Bonvoy®.",
    },
    applyUrl: "https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/boundless",
    lastUpdated: "2026-09-21",
    needsVerification: true,
  },
  {
    slug: "chase-ink-business-preferred",
    name: "Ink Business Preferred® Credit Card",
    issuerId: "chase",
    category: "travel",
    business: true,
    featured: false,
    welcomeBonus: "90,000 điểm Ultimate Rewards®",
    minimumSpendUsd: 8_000,
    offerPeriod: "3 tháng đầu",
    annualFeeUsd: 95,
    rewardsCurrency: "Ultimate Rewards®",
    headline:
      "Thẻ doanh nghiệp của Chase®: welcome bonus lớn, nhân điểm ở quảng cáo, internet và điện thoại.",
    editorsTake:
      "Nội dung mẫu. Chỉ dành cho người có doanh nghiệp đăng ký ở Mỹ — đọc kỹ phần Góc nhìn từ Canada trước khi cân nhắc.",
    keyBenefits: [
      "Nhân điểm ở quảng cáo, internet, điện thoại và du lịch",
      "Bảo hiểm điện thoại di động",
      "Điểm chuyển sang đối tác của Ultimate Rewards®",
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
      watchOut: "Doanh nghiệp đăng ký ở Canada không dùng được cho thẻ này.",
    },
    applyUrl: "https://creditcards.chase.com/business-credit-cards/ink/business-preferred",
    lastUpdated: "2026-09-21",
    needsVerification: true,
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
