// Bảng transfer partner của sáu hệ điểm thẻ tín dụng MỸ — nửa "Mỹ" của
// `/transfer-partners`. Dựng 06/10/2026.
//
// VÌ SAO LÀ FILE RIÊNG, không thêm cột vào `TRANSFER_PARTNERS`: bảng Canada có
// ĐÚNG hai cột `amex`/`rbc`, và hình dạng đó được đọc ở năm chỗ khác — Award
// Flight Finder, trang chặng `/bay-ve-viet-nam`, engine gợi ý
// (`transfer-paths.ts`) và hai audit. Engine và audit coi mọi hàng trong bảng đó
// là điểm Canada; nhét điểm Mỹ vào là chúng khuyên người Canada chuyển điểm Chase®
// họ không có. Ở đây không ai ngoài trang này đọc.
//
// DANH SÁCH: theo cheat sheet của Daily Drop
// (dailydrop.com/transfer-partners-cheat-sheet, đọc 06/10/2026), CHỈ giữ chương
// trình có ít nhất một hệ điểm chuyển được — tác giả dặn thế. Daily Drop liệt kê
// cả Lufthansa, Korean Air, Vietnam Airlines… mà không ngân hàng nào chuyển sang;
// những hàng đó bị bỏ. Alaska Airlines và Hawaiian Airlines là hai hàng ở Daily
// Drop nhưng chung một chương trình (Atmos™ Rewards) nên ở đây là một hàng.
//
// ĐỐI CHIẾU NGUỒN CHÍNH CHỦ (06/10/2026) — danh sách và tỷ lệ khớp Daily Drop:
// - American Express®: công cụ global.americanexpress.com/rewards/transfer, ngữ
//   cảnh United States (chân trang ghi "United States") — 20 đối tác.
// - Chase®: trang quyền lợi Sapphire Preferred® (chase.com/sapphire-cards/personal/
//   preferred) — 10 hãng bay, 4 khách sạn, có Wyndham (thêm 25/02/2026), và câu
//   "transfer to World of Hyatt at a rate of 4:3" cho Sapphire Preferred®.
// - Capital One®: capitalone.com/learn-grow/money-management/venture-miles-
//   transfer-partnerships — 22 đối tác kèm tỷ lệ.
// - Citi®: thankyou.com/partnerProgramsListing.htm, mở từng ô đối tác — 20 đối
//   tác; tỷ lệ ghi ở đây là của Strata Premier®/Strata Elite®/Prestige®.
// - Wells Fargo®: trang sản phẩm không liệt kê đối tác; JetBlue (11/2025) và
//   Cathay (28/04/2026) đối chiếu bằng thông cáo trên newsroom.wf.com, phần còn
//   lại theo Daily Drop.
// - Bilt: danh sách đối tác nằm sau đăng nhập; khớp Daily Drop qua AwardWallet.
//   Bilt có thêm Amtrak (chỉ tài khoản doanh nghiệp) — tàu hoả, không phải hãng
//   bay hay khách sạn, nên không nằm trong cheat sheet và không có ở đây.
//
// THỜI GIAN CHUYỂN lấy từ Daily Drop: đó là mức người dùng ghi nhận, không phải
// cam kết. Ô nào Daily Drop ghi "Not enough data" hoặc để trống thì không có
// `time` — không lấp bằng con số của nguồn khác, vì trang American Express® ghi
// "48 hours" cho gần như mọi đối tác (mức tối đa), đặt cạnh "Tức thì" của Daily
// Drop là hai thước đo khác nhau trong cùng một cột.
//
// TỶ LỆ viết "1,000 : X" như bảng Canada, kể cả khi ngân hàng in "250 : 200"
// (American Express® → JetBlue) hay "2:1.5" (Capital One®). Riêng Bilt → Accor
// là 3:2: viết "1,500 : 1,000" thay vì "1,000 : 667" — số tròn đó không có thật.
export type UsTransferIssuerId = "amex" | "chase" | "capital-one" | "citi" | "bilt" | "wells-fargo";

export type UsTransferLeg = {
  ratio: string;
  /** Thời gian chuyển theo Daily Drop. Vắng = chưa đủ dữ liệu. */
  time?: string;
  /** Điều kiện riêng của ô này, hiện ngay dưới tỷ lệ. */
  note?: string;
  /**
   * Tỷ lệ mới ngân hàng đã công bố. Từ ngày `from` (ngày Toronto) ô tự hiện
   * `ratio` mới — trang là ISR nên không cần ai nhớ sửa tay vào đúng ngày đó.
   */
  change?: { from: string; ratio: string };
};

export type UsTransferPartnerRow = {
  program: string;
  /** Dòng phụ dưới tên khi tên chương trình không tự nói nó thuộc hãng nào. */
  detail?: string;
  logo: string;
  legs: Partial<Record<UsTransferIssuerId, UsTransferLeg>>;
};

export type UsTransferIssuer = {
  id: UsTransferIssuerId;
  /** Tên cột — tên hệ điểm, như "Amex Membership Rewards®" ở bảng Canada. */
  name: string;
  logo: string;
  alt: string;
  logoClass: string;
  /**
   * Đúng chuỗi `rewardsCurrency` của thẻ Mỹ tích hệ điểm này, để trang liệt kê
   * được thẻ của từng cột. `null` khi site chưa có thẻ nào của ngân hàng đó.
   */
  currency: string | null;
};

/** Thứ tự cột = thứ tự ngân hàng ở mục Thẻ Mỹ (`US_ISSUERS`), Wells Fargo® cuối vì site chưa có thẻ của họ. */
export const US_TRANSFER_ISSUERS: UsTransferIssuer[] = [
  {
    id: "amex",
    name: "Amex Membership Rewards®",
    logo: "/images/logos/amex.svg",
    alt: "American Express®",
    logoClass: "mx-auto h-6 w-auto",
    currency: "Membership Rewards®",
  },
  {
    id: "chase",
    name: "Chase Ultimate Rewards®",
    logo: "/images/logos/chase.svg",
    alt: "Chase®",
    logoClass: "mx-auto h-4 w-auto",
    currency: "Ultimate Rewards®",
  },
  {
    id: "capital-one",
    name: "Capital One® Miles",
    logo: "/images/logos/capital-one.svg",
    alt: "Capital One®",
    logoClass: "mx-auto h-6 w-auto",
    currency: "Capital One® Miles",
  },
  {
    id: "citi",
    name: "Citi ThankYou®",
    logo: "/images/logos/citi.svg",
    alt: "Citi®",
    logoClass: "mx-auto h-6 w-auto",
    currency: "ThankYou® Points",
  },
  {
    id: "bilt",
    name: "Bilt Rewards",
    logo: "/images/logos/bilt.svg",
    alt: "Bilt",
    logoClass: "mx-auto h-4 w-auto",
    currency: "Bilt Points",
  },
  {
    id: "wells-fargo",
    name: "Wells Fargo Rewards®",
    logo: "/images/logos/wells-fargo.svg",
    alt: "Wells Fargo®",
    logoClass: "mx-auto h-8 w-auto",
    currency: null,
  },
];

const LOGO = "/images/logos/programs";

/** Những tỷ lệ lặp lại nhiều lần, viết một chỗ. */
const ONE_TO_ONE = "1,000 : 1,000";
const TO_800 = "1,000 : 800";
const TO_750 = "1,000 : 750";
const TO_2000 = "1,000 : 2,000";

const INSTANT = "Tức thì";

/** Hãng bay trước, khách sạn sau; trong mỗi nhóm xếp theo tên. */
export const US_TRANSFER_AIRLINES: UsTransferPartnerRow[] = [
  {
    program: "Aer Lingus® AerClub",
    logo: `${LOGO}/aer-lingus.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: "48 giờ" },
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
      "wells-fargo": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Aeroméxico® Rewards",
    logo: `${LOGO}/aeromexico.png`,
    legs: {
      amex: { ratio: "1,000 : 1,600", time: "1–7 ngày" },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Air Canada® Aeroplan®",
    logo: `${LOGO}/aeroplan.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Air France KLM® Flying Blue®",
    logo: `${LOGO}/flying-blue.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      chase: { ratio: ONE_TO_ONE, time: "1 giờ" },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
      "wells-fargo": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "American Airlines® AAdvantage®",
    logo: `${LOGO}/american-airlines.png`,
    legs: {
      citi: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "ANA® Mileage Club",
    logo: `${LOGO}/ana.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: "2–3 ngày" },
    },
  },
  {
    // Daily Drop để hai hàng (Alaska 24 giờ, Hawaiian tức thì) cho cùng một
    // chương trình; gộp lại thì hai con số đó không còn nói về đúng một chuyến
    // chuyển nào, nên ô này không ghi thời gian.
    program: "Atmos™ Rewards",
    detail: "Alaska Airlines® · Hawaiian Airlines®",
    logo: `${LOGO}/atmos.png`,
    legs: {
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Avianca LifeMiles®",
    logo: `${LOGO}/lifemiles.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
      "wells-fargo": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "British Airways® Club",
    logo: `${LOGO}/british-airways.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
      "wells-fargo": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Cathay Pacific® Asia Miles®",
    logo: `${LOGO}/cathay-pacific.png`,
    legs: {
      amex: { ratio: TO_800, time: "Từ 48 giờ" },
      "capital-one": { ratio: ONE_TO_ONE, time: "24–36 giờ" },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
      "wells-fargo": { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Delta® SkyMiles®",
    logo: `${LOGO}/delta.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Emirates Skywards®",
    logo: `${LOGO}/emirates.png`,
    legs: {
      amex: { ratio: TO_800, time: INSTANT },
      "capital-one": { ratio: TO_750, time: INSTANT },
      citi: { ratio: TO_800, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Etihad® Guest",
    logo: `${LOGO}/etihad.png`,
    legs: {
      "capital-one": { ratio: ONE_TO_ONE, time: "Tức thì–36 giờ" },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "EVA Air® Infinity MileageLands",
    logo: `${LOGO}/eva-air.png`,
    legs: {
      "capital-one": { ratio: TO_750, time: "1–2 ngày" },
      citi: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Finnair® Plus",
    logo: `${LOGO}/finnair.png`,
    legs: {
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Iberia® Club",
    logo: `${LOGO}/iberia.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: "1–3 ngày" },
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
      "wells-fargo": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "JAL® Mileage Bank",
    logo: `${LOGO}/jal.png`,
    legs: {
      "capital-one": { ratio: TO_750 },
      citi: { ratio: ONE_TO_ONE },
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "JetBlue® TrueBlue®",
    logo: `${LOGO}/jetblue.png`,
    legs: {
      amex: { ratio: TO_800, time: INSTANT },
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      "capital-one": { ratio: "1,000 : 600" },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      "wells-fargo": { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Qantas® Frequent Flyer",
    logo: `${LOGO}/qantas.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Qatar Airways® Privilege Club",
    logo: `${LOGO}/qatar.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: "48 giờ" },
      "capital-one": { ratio: ONE_TO_ONE },
      citi: { ratio: ONE_TO_ONE, time: "Tối đa 2 ngày" },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Singapore Airlines® KrisFlyer®",
    logo: `${LOGO}/singapore.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: "Từ 1 ngày" },
      chase: { ratio: ONE_TO_ONE, time: "1–2 ngày, có khi tới 7" },
      "capital-one": { ratio: ONE_TO_ONE, time: "Tức thì–48 giờ" },
      citi: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Southwest® Rapid Rewards®",
    logo: `${LOGO}/southwest.png`,
    legs: {
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: "1–2 giờ" },
    },
  },
  {
    program: "TAP® Miles&Go",
    logo: `${LOGO}/tap.png`,
    legs: {
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Thai® Royal Orchid Plus",
    logo: `${LOGO}/thai.png`,
    legs: {
      citi: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Turkish Airlines® Miles&Smiles",
    logo: `${LOGO}/turkish.png`,
    legs: {
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      citi: { ratio: ONE_TO_ONE },
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "United MileagePlus®",
    logo: `${LOGO}/united.png`,
    legs: {
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
    },
  },
  {
    program: "Virgin Atlantic® Flying Club",
    logo: `${LOGO}/virgin-atlantic.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      chase: { ratio: ONE_TO_ONE, time: INSTANT },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
      "wells-fargo": { ratio: ONE_TO_ONE },
    },
  },
];

export const US_TRANSFER_HOTELS: UsTransferPartnerRow[] = [
  {
    program: "Accor® ALL®",
    logo: `${LOGO}/accor.png`,
    legs: {
      "capital-one": { ratio: "1,000 : 500", time: "24–36 giờ" },
      citi: { ratio: "1,000 : 500", time: INSTANT },
      bilt: { ratio: "1,500 : 1,000" },
    },
  },
  {
    program: "Choice Privileges®",
    logo: `${LOGO}/choice.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      "capital-one": { ratio: ONE_TO_ONE, time: "1–2 ngày" },
      citi: { ratio: "1,000 : 1,500", time: INSTANT },
      "wells-fargo": { ratio: TO_2000, time: INSTANT },
    },
  },
  {
    program: "Hilton Honors®",
    logo: `${LOGO}/hilton.png`,
    legs: {
      amex: { ratio: TO_2000, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: "Tức thì–48 giờ" },
    },
  },
  {
    program: "I Prefer® Hotel Rewards",
    detail: "Preferred Hotels & Resorts®",
    logo: `${LOGO}/i-prefer.png`,
    legs: {
      "capital-one": { ratio: TO_2000 },
      citi: { ratio: TO_2000, time: INSTANT },
      bilt: { ratio: TO_2000 },
    },
  },
  {
    program: "IHG® One Rewards",
    logo: `${LOGO}/ihg.png`,
    legs: {
      chase: { ratio: ONE_TO_ONE, time: "1 ngày" },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    program: "Leaders Club",
    detail: "The Leading Hotels of the World",
    logo: `${LOGO}/leaders-club.png`,
    legs: {
      amex: { ratio: "1,000 : 250" },
      citi: { ratio: "1,000 : 200", time: INSTANT },
    },
  },
  {
    program: "Marriott Bonvoy®",
    logo: `${LOGO}/marriott.png`,
    legs: {
      amex: { ratio: ONE_TO_ONE, time: INSTANT },
      chase: { ratio: ONE_TO_ONE, time: "1 ngày" },
      bilt: { ratio: ONE_TO_ONE, time: INSTANT },
    },
  },
  {
    // Chase®: 4:3 cho Sapphire Preferred® (mở thẻ từ 15/06/2026 thì ngay lập
    // tức, thẻ cũ từ 01/10/2026) và Ink Business Preferred® (từ 01/10/2026);
    // Sapphire Reserve® và bản doanh nghiệp của nó giữ 1:1. Ô hiện mức của
    // Sapphire Preferred® — thẻ người mới chơi thẻ Mỹ hay mở nhất.
    // Bilt: thông báo 01/10/2026 trên trang chuyển điểm Hyatt — 4:3 cho mọi
    // thành viên từ 01/01/2027.
    program: "World of Hyatt®",
    logo: `${LOGO}/hyatt.png`,
    legs: {
      chase: { ratio: TO_750, note: "Sapphire Reserve®: 1,000 : 1,000", time: INSTANT },
      bilt: { ratio: ONE_TO_ONE, time: "Tức thì–72 giờ", change: { from: "2027-01-01", ratio: TO_750 } },
    },
  },
  {
    program: "Wyndham Rewards®",
    logo: `${LOGO}/wyndham.png`,
    legs: {
      chase: { ratio: ONE_TO_ONE },
      "capital-one": { ratio: ONE_TO_ONE, time: INSTANT },
      citi: { ratio: ONE_TO_ONE, time: INSTANT },
      bilt: { ratio: ONE_TO_ONE },
      "wells-fargo": { ratio: TO_2000 },
    },
  },
];

export const US_TRANSFER_PARTNERS: UsTransferPartnerRow[] = [
  ...US_TRANSFER_AIRLINES,
  ...US_TRANSFER_HOTELS,
];

/**
 * Ô của một ngân hàng ở một chương trình, đã áp `change` nếu tới ngày.
 * `today` là ngày Toronto dạng YYYY-MM-DD (`todayInSiteZone()`), truyền vào để
 * hàm thuần — test gọi được với bất kỳ ngày nào.
 */
export function legOn(
  row: UsTransferPartnerRow,
  issuer: UsTransferIssuerId,
  today: string,
): (UsTransferLeg & { upcoming?: { from: string; ratio: string } }) | null {
  const leg = row.legs[issuer];
  if (!leg) return null;
  if (!leg.change) return leg;
  // Tới ngày thì ô hiện tỷ lệ mới và thôi báo trước; chưa tới thì giữ tỷ lệ
  // đang áp dụng, kèm dòng báo trước.
  if (today >= leg.change.from) return { ratio: leg.change.ratio, time: leg.time, note: leg.note };
  return { ...leg, upcoming: leg.change };
}

/** Số chương trình mỗi ngân hàng chuyển được — cho dòng phụ dưới tên cột. */
export function partnerCount(issuer: UsTransferIssuerId): number {
  return US_TRANSFER_PARTNERS.filter((row) => row.legs[issuer]).length;
}

/** Cột của hệ điểm mà một thẻ Mỹ tích, hoặc `undefined` nếu hệ đó không có cột. */
export function usTransferIssuerForCurrency(currency: string): UsTransferIssuer | undefined {
  return US_TRANSFER_ISSUERS.find((issuer) => issuer.currency === currency);
}
