import {
  id,
  type Offer,
  type OfferComponent,
  type OfferComponentId,
  type OfferComponentType,
  type OfferId,
  type PointsProgramId,
  type ProductId,
} from "../types";

/**
 * Welcome offer đang chạy, và cấu trúc thật bên trong nó.
 *
 * ĐÂY LÀ LÝ DO OFFER PHẢI TÁCH KHỎI SẢN PHẨM, và tách khỏi con số quảng cáo.
 * Scotiabank® Passport® rao 35,000 điểm Scene+™. Nhưng 25,000 nằm sau mốc chi
 * $2,000 trong 3 tháng, còn 10,000 nằm sau mốc chi **$40,000 trong một năm**.
 * Với gần như mọi người đọc, offer này là 25,000 điểm. Một bảng chỉ lưu
 * `headline_bonus = 35000` không có cách nào nói ra điều đó, và engine dựng
 * trên nó sẽ xếp thẻ này trên một thẻ 30,000 điểm dễ lấy — sai theo đúng hướng
 * làm người đọc mở nhầm thẻ.
 *
 * NGUỒN: `keyBenefitsVi` và `editorsTakeVi` của chính entry Contentful, tức
 * nội dung site đã kiểm và đang xuất bản. Chép lại từ đó thay vì tự tra lần
 * nữa là cố ý — hai chỗ tra độc lập là hai chỗ sẽ lệch, và chỗ này lệch thì
 * engine khuyên một đằng, trang thẻ nói một nẻo.
 *
 * `minimumSpend` / `minimumSpendMonths` KHÔNG viết tay: chúng được cộng ra từ
 * `components` ngay dưới. Viết tay thì có hai con số cho cùng một sự thật, và
 * repo này đã trả giá đúng một lần cho kiểu đó (số rebate nằm ở hai chỗ).
 */

/** Ngày đọc nội dung Contentful để dựng bộ này. */
const VERIFIED_ON = "2026-09-07";
const CONTENTFUL_SOURCE = "https://ghe1a.com/credit-cards";

type ComponentSeed = {
  type: OfferComponentType;
  points?: number;
  cash?: number;
  spend?: number;
  windowDays?: number;
  /** Cửa sổ mở ra sau bao nhiêu ngày kể từ lúc mở thẻ. Bỏ trống = mở ngay.
   *  Xem `OfferComponent.windowStartsAfterDays` — đây là chỗ phân biệt mốc
   *  "trong 12 tháng" (vẫn tính từ ngày mở thẻ) với mốc "ở tháng thứ 13". */
  startsAfterDays?: number;
  /** Chỉ cho `monthly_spend`: số chu kỳ sao kê thành phần này lặp lại. */
  repeat?: number;
  note?: string;
};

type OfferSeed = {
  slug: string;
  name: string;
  /** Con số quảng cáo. `null` khi thẻ không rao welcome bonus bằng điểm. */
  headline: number | null;
  currency: string | null;
  startDate: string;
  endDate?: string;
  /** Phí năm đầu SAU ưu đãi. `null` = không có ưu đãi phí, trả phí thường. */
  feeFirstYear?: number;
  /** Rebate FinlyWealth, khớp `rebateVi` trên Contentful. */
  rebate?: number;
  components: ComponentSeed[];
  /** Vì sao dữ liệu chưa đầy đủ, khi nó chưa đầy đủ. */
  incomplete?: string;
};

const OFFER_SEEDS: OfferSeed[] = [
  {
    slug: "amex-green",
    name: "15,000 điểm Membership Rewards®",
    headline: 15000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    components: [{ type: "spend_threshold", points: 15000, spend: 1250, windowDays: 90 }],
  },
  {
    slug: "amex-gold-rewards",
    name: "60,000 điểm Membership Rewards®",
    headline: 60000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    components: [
      {
        type: "monthly_spend",
        points: 5000,
        spend: 1000,
        windowDays: 365,
        repeat: 12,
        note: "5,000 điểm cho mỗi chu kỳ sao kê chi đủ $1,000, suốt 12 tháng đầu",
      },
    ],
  },
  {
    slug: "amex-cobalt",
    name: "15,000 điểm Membership Rewards®",
    headline: 15000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    components: [
      {
        type: "monthly_spend",
        points: 1250,
        spend: 750,
        windowDays: 365,
        repeat: 12,
        note: "1,250 điểm cho mỗi chu kỳ sao kê chi đủ $750, suốt 12 tháng đầu",
      },
    ],
  },
  {
    slug: "scotiabank-momentum-visa-infinite-plus",
    name: "Cashback 15% trong 3 tháng đầu (tối đa $300)",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    endDate: "2026-11-01",
    feeFirstYear: 0,
    rebate: 150,
    components: [
      {
        type: "statement_credit",
        cash: 300,
        spend: 2000,
        windowDays: 90,
        note: "Hoàn 15% cho mọi chi tiêu, áp dụng cho tối đa $2,000 chi tiêu",
      },
      { type: "fee_waiver", cash: 120, note: "Miễn annual fee $120 năm đầu, kể cả thẻ phụ" },
    ],
  },
  {
    slug: "cibc-aventura-gold-visa",
    name: "60,000 điểm Aventura®",
    headline: 60000,
    currency: "aventura",
    startDate: "2026-09-07",
    feeFirstYear: 0,
    components: [
      { type: "first_purchase", points: 15000 },
      // "4 kỳ sao kê đầu tiên" ≈ 120 ngày. Là ƯỚC LƯỢNG: kỳ sao kê không phải
      // 30 ngày và kỳ đầu thường ngắn hơn, nên con số này chỉ để so tương đối
      // với sức chi của người dùng, không bao giờ đem ra trước mặt họ.
      { type: "spend_threshold", points: 30000, spend: 3000, windowDays: 120 },
      { type: "spend_threshold", points: 15000, spend: 5000, windowDays: 120 },
      { type: "fee_waiver", cash: 139 },
    ],
  },
  {
    slug: "scotiabank-gold-amex",
    name: "Đến 50,000 điểm Scene+™",
    headline: 50000,
    currency: "scene-plus",
    startDate: "2026-09-07",
    rebate: 200,
    components: [],
    incomplete:
      "Nội dung site chỉ nói 'đến 50,000 điểm trong năm đầu', không nêu mốc chi. " +
      "Chưa dựng được component nào, nên engine phải coi mức dùng được là chưa biết " +
      "chứ không được mặc định là 50,000.",
  },
  {
    slug: "scotiabank-scene-plus-visa-students",
    name: "Đến 5,000 điểm Scene+™",
    headline: 5000,
    currency: "scene-plus",
    startDate: "2026-07-02",
    endDate: "2026-11-01",
    rebate: 50,
    components: [
      { type: "spend_threshold", points: 2500, spend: 250, windowDays: 90 },
      { type: "spend_threshold", points: 2500, spend: 1000, windowDays: 90 },
    ],
  },
  {
    slug: "westjet-rbc-world-elite-mastercard",
    name: "Đến 70,000 điểm WestJet®",
    headline: 70000,
    currency: "westjet",
    startDate: "2026-09-07",
    endDate: "2026-11-04",
    rebate: 140,
    components: [
      { type: "first_purchase", points: 30000 },
      { type: "spend_threshold", points: 30000, spend: 5000, windowDays: 90 },
      { type: "anniversary", points: 10000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-aeroplan-reserve",
    name: "85,000 điểm Aeroplan®",
    headline: 85000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    components: [
      { type: "spend_threshold", points: 60000, spend: 7500, windowDays: 90 },
      {
        type: "anniversary",
        points: 25000,
        spend: 2500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $2,500 trong tháng thứ 13 — cửa sổ riêng, không dùng lại tiền đã chi",
      },
    ],
  },
  {
    slug: "td-aeroplan-visa-infinite-privilege",
    name: "100,000 điểm Aeroplan®",
    headline: 100000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    components: [
      { type: "first_purchase", points: 20000 },
      { type: "spend_threshold", points: 30000, spend: 12000, windowDays: 180 },
      {
        type: "anniversary",
        points: 50000,
        spend: 24000,
        windowDays: 365,
        note: "Chi $24,000 trong 12 tháng, nhận ở mốc kỷ niệm 1 năm",
      },
    ],
  },
  {
    slug: "td-aeroplan-visa-infinite",
    name: "50,000 điểm Aeroplan®",
    headline: 50000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    feeFirstYear: 0,
    components: [
      { type: "first_purchase", points: 10000 },
      { type: "spend_threshold", points: 15000, spend: 3000, windowDays: 90 },
      { type: "anniversary", points: 25000, spend: 12000, windowDays: 365 },
      { type: "fee_waiver", cash: 139 },
    ],
  },
  {
    slug: "td-first-class-travel-visa-infinite",
    name: "160,000 điểm TD Rewards",
    headline: 160000,
    currency: "td-rewards",
    startDate: "2026-09-01",
    feeFirstYear: 0,
    rebate: 140,
    components: [
      { type: "first_purchase", points: 20000 },
      { type: "spend_threshold", points: 140000, spend: 7500, windowDays: 180 },
      { type: "fee_waiver", cash: 189, note: "Thẻ chính $139 và thẻ phụ đầu tiên $50" },
    ],
  },
  {
    slug: "cibc-aventura-visa-infinite",
    name: "60,000 điểm Aventura®",
    headline: 60000,
    currency: "aventura",
    startDate: "2026-09-07",
    feeFirstYear: 0,
    components: [
      { type: "first_purchase", points: 15000 },
      { type: "spend_threshold", points: 30000, spend: 3000, windowDays: 120 },
      { type: "spend_threshold", points: 15000, spend: 5000, windowDays: 120 },
      { type: "fee_waiver", cash: 139 },
    ],
  },
  {
    slug: "amex-aeroplan-business-reserve",
    name: "90,000 điểm Aeroplan®",
    headline: 90000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    components: [
      { type: "spend_threshold", points: 65000, spend: 10500, windowDays: 90 },
      {
        type: "anniversary",
        points: 25000,
        spend: 3500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $3,500 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "amex-marriott-bonvoy-business",
    name: "110,000 điểm Bonvoy®",
    headline: 110000,
    currency: "bonvoy",
    startDate: "2026-09-07",
    components: [],
    incomplete: "Nội dung site không nêu mốc chi của welcome bonus này.",
  },
  {
    slug: "national-bank-world-elite-mastercard",
    name: "Không có welcome bonus",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    rebate: 100,
    components: [],
  },
  {
    slug: "td-cash-back-visa-infinite",
    name: "Đến $600 giá trị",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    feeFirstYear: 0,
    rebate: 140,
    components: [
      {
        type: "statement_credit",
        cash: 350,
        spend: 3500,
        windowDays: 90,
        note: "Hoàn 10% Cash Back Dollars cho tối đa $3,500 chi tiêu thuộc nhóm bonus",
      },
      { type: "fee_waiver", cash: 139 },
    ],
    // TD® rao "đến $600 giá trị"; các thành phần đếm được ở đây cộng lại là
    // $489. Khoảng chênh đó là phần TD® tính bằng tiền hoàn của tỷ lệ thường
    // trong năm đầu, tức nó phụ thuộc vào người dùng chi bao nhiêu — đúng thứ
    // §11 nói phải tách khỏi mức chắc chắn nhận được, chứ không phải một con
    // số thiếu.
  },
  {
    slug: "wealthsimple-visa-infinite-privilege",
    name: "Không có welcome bonus",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    components: [],
  },
  {
    slug: "wealthsimple-visa-infinite-plus",
    name: "Không có welcome bonus",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    components: [],
  },
  {
    slug: "rbc-avion-visa-infinite-privilege",
    name: "100,000 điểm Avion®",
    headline: 100000,
    currency: "avion",
    startDate: "2026-09-07",
    components: [
      {
        type: "first_purchase",
        points: 35000,
        windowDays: 60,
        note: "Trong vòng 60 ngày sau khi đơn được duyệt, không cần mốc chi",
      },
      { type: "spend_threshold", points: 20000, spend: 5000, windowDays: 180 },
      { type: "anniversary", points: 45000, windowDays: 365 },
    ],
  },
  {
    slug: "td-aeroplan-visa-platinum",
    name: "20,000 điểm Aeroplan®",
    headline: 20000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    feeFirstYear: 0,
    components: [
      { type: "first_purchase", points: 10000 },
      { type: "spend_threshold", points: 10000, spend: 1500, windowDays: 90 },
      { type: "fee_waiver", cash: 89 },
    ],
  },
  {
    slug: "amex-aeroplan",
    name: "45,000 điểm Aeroplan®",
    headline: 45000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    components: [
      { type: "spend_threshold", points: 35000, spend: 7500, windowDays: 180 },
      {
        type: "anniversary",
        points: 10000,
        spend: 1000,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $1,000 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "bmo-viporter-world-elite-mastercard",
    name: "70,000 điểm VIPorter®",
    headline: 70000,
    currency: "viporter",
    startDate: "2026-09-07",
    feeFirstYear: 0,
    rebate: 200,
    components: [
      { type: "spend_threshold", points: 20000, spend: 5000, windowDays: 110 },
      { type: "spend_threshold", points: 20000, spend: 9000, windowDays: 180 },
      { type: "spend_threshold", points: 30000, spend: 18000, windowDays: 365 },
      { type: "fee_waiver", cash: 199 },
    ],
  },
  {
    slug: "united-mileageplus-neo-world-elite-mastercard",
    name: "25,000 miles United® MileagePlus®",
    headline: 25000,
    currency: "mileageplus",
    startDate: "2026-09-07",
    rebate: 100,
    components: [
      { type: "first_purchase", points: 5000 },
      { type: "spend_threshold", points: 15000, spend: 3000, windowDays: 90 },
      { type: "anniversary", points: 5000, windowDays: 365, note: "Thưởng gia hạn mỗi năm" },
    ],
  },
  {
    slug: "amex-marriott-bonvoy",
    name: "110,000 điểm Bonvoy®",
    headline: 110000,
    currency: "bonvoy",
    startDate: "2026-09-07",
    components: [],
    incomplete: "Nội dung site không nêu mốc chi của welcome bonus này.",
  },
  {
    slug: "scotiabank-passport-visa-infinite",
    name: "Đến 35,000 điểm Scene+™",
    headline: 35000,
    currency: "scene-plus",
    startDate: "2026-09-07",
    rebate: 120,
    components: [
      { type: "spend_threshold", points: 25000, spend: 2000, windowDays: 90 },
      // Mốc $40,000/năm: với người chi $2,000/tháng thì đây là điều không xảy
      // ra. Chính là ví dụ §11 lấy làm mẫu — 10,000 điểm này KHÔNG được cộng
      // vào "mức dùng được" mặc định.
      { type: "spend_threshold", points: 10000, spend: 40000, windowDays: 365 },
    ],
  },
  {
    slug: "rbc-avion-visa-infinite",
    name: "Đến 70,000 điểm Avion®",
    headline: 70000,
    currency: "avion",
    startDate: "2026-09-07",
    components: [
      { type: "first_purchase", points: 35000, windowDays: 60, note: "Khi đơn được duyệt" },
      { type: "spend_threshold", points: 20000, spend: 5000, windowDays: 180 },
      { type: "anniversary", points: 15000, windowDays: 365, note: "Thưởng khi gia hạn thẻ" },
    ],
  },
  {
    slug: "rbc-avion-visa-platinum",
    name: "Đến 70,000 điểm Avion®",
    headline: 70000,
    currency: "avion",
    startDate: "2026-09-07",
    components: [
      { type: "first_purchase", points: 35000, windowDays: 60, note: "Khi đơn được duyệt" },
      { type: "spend_threshold", points: 20000, spend: 5000, windowDays: 180 },
      { type: "anniversary", points: 15000, windowDays: 365, note: "Thưởng khi gia hạn thẻ" },
    ],
  },
  {
    slug: "cibc-aeroplan-visa",
    name: "10,000 điểm Aeroplan®",
    headline: 10000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    components: [
      { type: "first_purchase", points: 2500 },
      { type: "spend_threshold", points: 2500, spend: 1500, windowDays: 120 },
      { type: "anniversary", points: 5000, spend: 10000, windowDays: 365 },
    ],
  },
  {
    slug: "cibc-aeroplan-visa-infinite",
    name: "50,000 điểm Aeroplan®",
    headline: 50000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    feeFirstYear: 0,
    components: [
      { type: "first_purchase", points: 10000 },
      { type: "spend_threshold", points: 15000, spend: 6000, windowDays: 180 },
      { type: "anniversary", points: 25000, spend: 12000, windowDays: 365 },
      { type: "fee_waiver", cash: 189, note: "Thẻ chính $139 và tối đa 3 thẻ phụ $50/thẻ" },
    ],
  },
  {
    slug: "cibc-aeroplan-visa-infinite-privilege",
    name: "100,000 điểm Aeroplan®",
    headline: 100000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    components: [
      { type: "spend_threshold", points: 10000, spend: 1000, windowDays: 60 },
      { type: "spend_threshold", points: 40000, spend: 5000, windowDays: 120 },
      { type: "anniversary", points: 50000, spend: 25000, windowDays: 365 },
    ],
  },
];

/**
 * Tổng mức chi phải đạt để lấy HẾT bonus.
 *
 * Không phải MAX, cũng không phải SUM — cả hai cách đơn giản đều sai, và sai
 * theo hai hướng ngược nhau:
 *
 *   SUM sai vì các mốc có cửa sổ CHỒNG NHAU dùng chung tiền. TD® Aeroplan®
 *   Visa Infinite Privilege* đòi $12,000 trong 180 ngày rồi $24,000 trong 12
 *   tháng — cả hai cửa sổ đều mở từ ngày mở thẻ, nên $12,000 đầu tiên nằm
 *   TRONG $24,000. Tổng là $24,000. Cộng lại ra $36,000, tức bịa thêm
 *   $12,000 rồi loại oan thẻ khỏi tay người vừa đủ sức.
 *
 *   MAX sai vì các cửa sổ RỜI NHAU thì tiền không dùng lại được. Amex®
 *   Aeroplan®* Reserve đòi $7,500 trong 90 ngày đầu rồi $2,500 nữa ở tháng
 *   thứ 13. MAX ra $7,500, tức nói phần thưởng 25,000 điểm kỷ niệm là miễn phí.
 *
 * Nên: gom theo NGÀY MỞ CỬA SỔ, lấy MAX trong từng nhóm, rồi cộng các nhóm.
 * Gom theo `componentType` là cách cũ và là cách sai — `anniversary` nói điểm
 * được TRẢ lúc nào, không nói tiền phải chi lúc nào.
 *
 * `monthly_spend` nhân lên trước khi so: Cobalt đòi $750 MỖI chu kỳ trong 12
 * chu kỳ, tức $9,000 thật.
 */
function requiredSpendOf(c: ComponentSeed): number | null {
  if (c.spend === undefined) return null;
  return c.type === "monthly_spend" ? c.spend * (c.repeat ?? 1) : c.spend;
}

function totalSpendOf(components: ComponentSeed[]): number | null {
  const windows = components
    .map((c) => {
      const needed = requiredSpendOf(c);
      if (needed === null) return null;
      const from = c.startsAfterDays ?? 0;
      return { from, to: from + (c.windowDays ?? 90), needed };
    })
    .filter((w): w is { from: number; to: number; needed: number } => w !== null)
    .sort((a, b) => a.from - b.from);

  // Gom theo CHỒNG LẤN THẬT, không theo ngày mở bằng nhau. Hai cửa sổ mở khác
  // ngày nhưng còn giao nhau — ngày 0–180 và ngày 30–395 — vẫn dùng chung
  // được tiền, nên cộng chúng lại là bịa ra một yêu cầu không tồn tại. So ngày
  // mở là đúng với mọi thẻ trong bộ dữ liệu hiện tại (mọi cửa sổ hoặc mở ở
  // ngày 0, hoặc mở ở ngày 365 và không giao), nhưng nó đúng do may chứ không
  // do phép tính, và cái bẫy đó im lặng.
  let total = 0;
  let cluster: { to: number; max: number } | null = null;
  for (const window of windows) {
    if (cluster !== null && window.from < cluster.to) {
      cluster.to = Math.max(cluster.to, window.to);
      cluster.max = Math.max(cluster.max, window.needed);
      continue;
    }
    if (cluster !== null) total += cluster.max;
    cluster = { to: window.to, max: window.needed };
  }
  if (cluster !== null) total += cluster.max;
  return total > 0 ? total : null;
}

/**
 * Mức chi cần thiết QUY VỀ 90 NGÀY — xem `Offer.spendPerNinetyDays`.
 *
 * Lấy mốc NẶNG NHẤT sau khi quy đổi, không phải mốc có số tiền lớn nhất:
 * $40,000 trong 365 ngày (~$9,900/quý) nhẹ hơn $7,500 trong 90 ngày.
 */
function spendPerNinetyDaysOf(components: ComponentSeed[]): number | null {
  let worst = 0;
  for (const c of components) {
    const needed = requiredSpendOf(c);
    if (needed === null) continue;
    // `monthly_spend` lặp lại: cửa sổ thật của MỘT lần là một chu kỳ sao kê,
    // nên quy đổi phải chia cho toàn bộ số ngày mà tổng đó trải ra.
    const days = c.windowDays ?? 90;
    const rate = (needed / days) * 90;
    if (rate > worst) worst = rate;
  }
  return worst > 0 ? Math.round(worst) : null;
}

function longestWindowMonths(components: ComponentSeed[]): number | null {
  // Tính tới NGÀY CUỐI CÙNG còn phải chi, tức `startsAfterDays + windowDays`.
  // Chỉ nhìn `windowDays` thì Amex® Aeroplan®* Reserve — $7,500 trong 90 ngày
  // rồi $2,500 ở tháng thứ 13 — hiện ra "3 tháng", trong khi người đọc phải
  // giữ thẻ qua mốc kỷ niệm mới lấy hết bonus. Đó là câu về việc họ bị buộc
  // trả annual fee năm thứ hai hay không.
  const ends = components
    .filter((c) => c.windowDays !== undefined)
    .map((c) => (c.startsAfterDays ?? 0) + c.windowDays!);
  if (ends.length === 0) return null;
  return Math.round((Math.max(...ends) / 365) * 12);
}

/**
 * Id của offer PHẢI mang ngày bắt đầu của chính nó.
 *
 * `Temporal` là hợp đồng chỉ-thêm: offer đổi thì đóng bản cũ bằng `effectiveTo`
 * rồi thêm bản mới, không ghi đè. Với một hằng "2026-09" trong id, offer thứ
 * hai của cùng một thẻ sinh ra ĐÚNG id cũ — và component của nó cũng trỏ vào
 * đó. Kết quả là hoặc validator đỏ vì trùng id, hoặc người sửa lặng lẽ đè lên
 * offer cũ và mất luôn lịch sử, tức mất luôn khả năng trả lời "70,000 là mức
 * cao hay mức thường" mà `offer-history.json` sinh ra để trả lời.
 */
function offerIdFor(seed: OfferSeed): string {
  return `${seed.slug}-${seed.startDate}`;
}

export const OFFERS: Offer[] = OFFER_SEEDS.map((seed) => ({
  id: id<OfferId>(offerIdFor(seed)),
  productId: seed.slug as ProductId,
  name: seed.name,
  startDate: seed.startDate,
  endDate: seed.endDate ?? null,
  bonusCurrencyId: seed.currency ? (seed.currency as PointsProgramId) : null,
  headlineBonus: seed.headline,
  minimumSpend: totalSpendOf(seed.components),
  minimumSpendMonths: longestWindowMonths(seed.components),
  spendPerNinetyDays: spendPerNinetyDaysOf(seed.components),
  annualFeeFirstYear: seed.feeFirstYear ?? null,
  annualFeeRebate: seed.rebate ?? null,
  // V1 chỉ có offer công khai. Offer targeted (link riêng, thư mời) tồn tại
  // thật nhưng site không đăng, nên không có dữ liệu để seed.
  isTargeted: false,
  isPublic: true,
  isActive: true,
  effectiveFrom: seed.startDate,
  effectiveTo: seed.endDate ?? null,
  sourceUrl: `${CONTENTFUL_SOURCE}/${seed.slug}`,
  verifiedAt: VERIFIED_ON,
  confidence: seed.components.length === 0 && seed.headline !== null ? "estimated" : "verified",
}));

export const OFFER_COMPONENTS: OfferComponent[] = OFFER_SEEDS.flatMap((seed) =>
  seed.components.map((c, index) => ({
    id: id<OfferComponentId>(`${offerIdFor(seed)}-${index + 1}`),
    offerId: offerIdFor(seed) as OfferId,
    sequence: index + 1,
    componentType: c.type,
    pointsAmount: c.points ?? null,
    cashAmount: c.cash ?? null,
    spendRequirement: c.spend ?? null,
    spendWindowDays: c.windowDays ?? null,
    windowStartsAfterDays: c.startsAfterDays ?? 0,
    repeatCount: c.repeat ?? null,
    conditionText: c.note ?? null,
  })),
);

/** Offer chưa dựng được component nào, kèm lý do. Đọc bởi `audit:reco-data`
 *  để báo ra thay vì để nó chìm. */
export const INCOMPLETE_OFFERS: { offerId: string; reason: string }[] = OFFER_SEEDS.filter(
  (seed) => seed.incomplete,
).map((seed) => ({ offerId: offerIdFor(seed), reason: seed.incomplete! }));
