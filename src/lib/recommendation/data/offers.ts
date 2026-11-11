import {
  id,
  type Offer,
  type OfferComponent,
  type OfferComponentId,
  type OfferComponentType,
  type OfferId,
  type PointsProgramId,
} from "../types.ts";
import { productIdFor } from "./products.ts";
import {
  allWindowEnds,
  longestWindowMonths,
  spendPerNinetyDays,
  spendWindowsOf,
  totalSpend,
  type SpendComponentShape,
} from "../spend.ts";

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
/**
 * Ngày các dòng này được ĐƯA VÀO kho. ĐỘC LẬP với `VERIFIED_ON`, và không được
 * đổi khi kiểm lại: kiểm lại một dữ kiện không đổi ngày nó vào kho, còn buộc
 * hai thứ vào nhau thì mỗi lần kiểm lại sẽ làm các lượt chạy TRƯỚC đó trông
 * như chưa từng biết dòng này.
 */
const RECORDED_ON = "2026-09-07";
const CONTENTFUL_SOURCE = "https://ghe1a.com/credit-cards";

type ComponentSeed = {
  type: OfferComponentType;
  points?: number;
  cash?: number;
  spend?: number;
  windowDays?: number;
  /** Thời hạn nói bằng lời điều khoản, khi `windowDays` chỉ là quy đổi gần
   *  đúng ("4 kỳ sao kê đầu tiên" ≈ 120 ngày). Xem `OfferComponent.spendWindowText`.
   *  Viết trọn cụm trạng ngữ, đúng dạng trang sẽ in: "trong 4 kỳ sao kê đầu tiên". */
  windowText?: string;
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
  /** Đồng tiền điểm, hoặc `null`. Xem `kind` ngay dưới — `null` một mình không
   *  phân biệt được "thưởng tiền" với "không thưởng gì". */
  currency: string | null;
  /** Mặc định suy ra: có `currency` → `points`, không có → `cash` nếu có
   *  component trả tiền, ngược lại `none`. Khai tường minh khi cách suy đó sai. */
  kind?: "points" | "cash" | "none";
  /** Ngày nhà phát hành nói offer bắt đầu / kết thúc. Dữ kiện marketing. */
  startDate: string;
  endDate?: string;
  /**
   * Từ / tới khi nào ĐÂY là điều mình biết về offer của thẻ này.
   *
   * Mặc định bằng `startDate`/`endDate`, và với offer bình thường thì hai cặp
   * này trùng nhau. Chúng TÁCH RA khi nhà phát hành rút offer sớm, hoặc thay
   * bằng offer khác trước hạn: lúc đó `endDate` vẫn là hạn đã công bố (mình
   * không được sửa lại lịch sử marketing), còn `effectiveTo` là ngày bản ghi
   * này thôi mô tả hiện thực.
   *
   * Không tách thì hai chuyện đó là một, và cách duy nhất ghi lại một offer bị
   * rút sớm là sửa `endDate` — tức nói dối về điều nhà phát hành đã công bố.
   */
  recordedFrom?: string;
  recordedTo?: string;
  /**
   * Ngày kiểm / ngày đưa vào kho, khi khác hằng chung của file. Offer nối tiếp
   * thêm sau ngày dựng seed PHẢI khai: mang ngày chung thì truy vấn `knownAt`
   * trước đó sẽ thấy một offer lúc ấy kho chưa biết. Cùng luật với
   * `FeeVersion.recordedAt` bên products.ts.
   */
  verifiedAt?: string;
  recordedAt?: string;
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
    name: "10,000 điểm Membership Rewards®",
    headline: 10000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 09/11. Kiểm chiều 11/11/2026: trang công
    // khai amex.ca ở bốn phiên trình duyệt độc lập và đúng đường Apply của site
    // (Finly → CJ → amex.ca ?CPID=) ở hai trình duyệt đều 10,000/$1,000; sáng
    // cùng ngày một phiên còn thấy 15,000. Ngày mình thấy — Amex® không ghi ngày
    // bắt đầu. Bản đang mở đứng TRƯỚC các bản đã đóng: test vòng đời lấy offer
    // đầu tiên làm "offer hiện hành" của thẻ đầu tiên.
    startDate: "2026-11-11",
    verifiedAt: "2026-11-11",
    recordedAt: "2026-11-11",
    components: [{ type: "spend_threshold", points: 10000, spend: 1000, windowDays: 90 }],
  },
  {
    slug: "amex-green",
    name: "15,000 điểm Membership Rewards®",
    headline: 15000,
    currency: "amex-mr",
    // Offer nâng quay lại lần ba: thấy 09/11/2026 trên trang công khai amex.ca
    // và đúng đường Apply của site (Finly → CJ → amex.ca ?CPID=), ba lượt tải
    // cùng "ELEVATED OFFER" 15,000/$1,250. Amex® không ghi ngày bắt đầu lẫn kết
    // thúc.
    startDate: "2026-11-09",
    verifiedAt: "2026-11-09",
    recordedAt: "2026-11-09",
    // 11/11/2026 chỉ còn mức thường (xem bản trên); đóng ở ngày cuối mình còn
    // tin nó, không sửa `endDate`.
    recordedTo: "2026-11-10",
    components: [{ type: "spend_threshold", points: 15000, spend: 1250, windowDays: 90 }],
  },
  {
    slug: "amex-green",
    name: "10,000 điểm Membership Rewards®",
    headline: 10000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 09/10 (kiểm 21/10/2026 qua đúng đường
    // Apply của site). Ngày mình thấy — Amex® không ghi ngày bắt đầu.
    startDate: "2026-10-21",
    verifiedAt: "2026-10-21",
    recordedAt: "2026-10-21",
    // 09/11/2026 offer nâng 15,000 quay lại; Amex® không công bố ngày.
    recordedTo: "2026-11-08",
    components: [{ type: "spend_threshold", points: 10000, spend: 1000, windowDays: 90 }],
  },
  {
    slug: "amex-green",
    name: "15,000 điểm Membership Rewards®",
    headline: 15000,
    currency: "amex-mr",
    // Offer nâng quay lại: thấy 09/10/2026 trên trang công khai amex.ca và đúng
    // đường Apply của site (Finly → CJ → amex.ca ?CPID=). Amex® không ghi ngày
    // bắt đầu lẫn kết thúc — `startDate` là ngày mình thấy. Bản đang mở đứng
    // TRƯỚC bản đã đóng: test vòng đời lấy offer đầu tiên làm "offer hiện hành"
    // của thẻ đầu tiên.
    startDate: "2026-10-09",
    verifiedAt: "2026-10-09",
    recordedAt: "2026-10-09",
    // 21/10/2026 đúng đường Apply của site (Finly → CJ → amex.ca ?CPID=), tải hai
    // lần, chỉ còn mức thường. Amex® không công bố ngày offer nâng kết thúc, nên
    // bản ghi đóng ở ngày cuối mình còn tin nó, không sửa `endDate`.
    recordedTo: "2026-10-20",
    components: [{ type: "spend_threshold", points: 15000, spend: 1250, windowDays: 90 }],
  },
  {
    slug: "amex-green",
    name: "10,000 điểm Membership Rewards®",
    headline: 10000,
    currency: "amex-mr",
    // Ngày mình thấy mức này trên amex.ca — Amex không ghi ngày bắt đầu.
    startDate: "2026-09-22",
    endDate: "2026-10-08",
    verifiedAt: "2026-09-22",
    recordedAt: "2026-09-23",
    components: [{ type: "spend_threshold", points: 10000, spend: 1000, windowDays: 90 }],
  },
  {
    slug: "amex-green",
    name: "15,000 điểm Membership Rewards®",
    headline: 15000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    // 22/09/2026 amex.ca và đường nút Apply thật (Finly → CJ → amex.ca) đều
    // chỉ còn 10,000/$1,000. Amex không công bố ngày mức 15,000 kết thúc, nên
    // bản ghi đóng ở ngày cuối mình còn tin nó, không sửa `endDate`.
    recordedTo: "2026-09-21",
    components: [{ type: "spend_threshold", points: 15000, spend: 1250, windowDays: 90 }],
  },
  {
    slug: "amex-gold-rewards",
    name: "90,000 điểm Membership Rewards®",
    headline: 90000,
    currency: "amex-mr",
    // Offer nâng lần đầu ("ELEVATED OFFER: UP TO 90,000 POINTS"): thấy 09/11/2026
    // trên trang công khai amex.ca (tải hai lần) và đúng đường Apply của site
    // (Finly `/go/creditCards/amex-gold` → CJ → amex.ca ?CPID=). Amex® không ghi
    // ngày bắt đầu lẫn kết thúc — `startDate` là ngày mình thấy. 30,000 điểm khi
    // chi $4,000 trong 3 tháng đầu CỘNG THÊM vào 60,000 điểm theo chu kỳ.
    startDate: "2026-11-09",
    verifiedAt: "2026-11-09",
    recordedAt: "2026-11-09",
    components: [
      { type: "spend_threshold", points: 30000, spend: 4000, windowDays: 90 },
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
    slug: "amex-gold-rewards",
    name: "60,000 điểm Membership Rewards®",
    headline: 60000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    // 09/11/2026 amex.ca và đường Apply của site thấy mức nâng 90,000. Amex®
    // không công bố ngày, nên bản ghi đóng ở ngày cuối mình còn tin nó, không
    // đặt `endDate`.
    recordedTo: "2026-11-08",
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
    name: "Cashback 10% trong 3 tháng đầu (tối đa $200)",
    headline: null,
    currency: null,
    // Offer thường thay offer nâng 15% (scotiabank.com, đọc 02/11/2026): tài
    // khoản mở 02/11/2026 – 30/04/2027. Bản đang mở đứng TRƯỚC các bản đã đóng.
    startDate: "2026-11-02",
    verifiedAt: "2026-11-02",
    recordedAt: "2026-11-02",
    endDate: "2027-04-30",
    feeFirstYear: 0,
    rebate: 150,
    components: [
      {
        type: "statement_credit",
        cash: 200,
        spend: 2000,
        windowDays: 90,
        note: "Hoàn 10% cho mọi chi tiêu, áp dụng cho tối đa $2,000 chi tiêu",
      },
      { type: "fee_waiver", cash: 120, note: "Miễn annual fee $120 năm đầu, kể cả thẻ phụ" },
    ],
  },
  {
    slug: "scotiabank-momentum-visa-infinite-plus",
    name: "Cashback 15% trong 3 tháng đầu (tối đa $300)",
    headline: null,
    currency: null,
    // Rebate FinlyWealth đổi HAI lần trong ngày 31/10/2026: $200 → $100 (job
    // check-rebates 10:41 giờ Toronto) rồi $100 → $150 (19:31). Bản ghi theo
    // ngày nên chỉ giữ được số chốt của ngày; mức $100 sống chưa tới chín tiếng
    // không có bản riêng. Affiliate API xác nhận $150 cùng tối. Offer giữ nguyên.
    startDate: "2026-09-07",
    recordedFrom: "2026-10-31",
    recordedAt: "2026-10-31",
    verifiedAt: "2026-10-31",
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
    slug: "scotiabank-momentum-visa-infinite-plus",
    name: "Cashback 15% trong 3 tháng đầu (tối đa $300)",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    recordedTo: "2026-10-30",
    endDate: "2026-11-01",
    feeFirstYear: 0,
    rebate: 200,
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
      // "4 kỳ sao kê đầu tiên" ≈ 120 ngày. `windowDays` là ƯỚC LƯỢNG, chỉ để
      // so tương đối với sức chi của người dùng; `windowText` là câu được đem
      // ra trước mặt họ. $5,000 là tổng chi tích luỹ, đã gồm $3,000 ở mốc
      // trước ("after $5,000 in net purchases" — Contentful, kiểm 17/09/2026).
      {
        type: "spend_threshold",
        points: 30000,
        spend: 3000,
        windowDays: 120,
        windowText: "trong 4 kỳ sao kê đầu tiên",
      },
      {
        type: "spend_threshold",
        points: 15000,
        spend: 5000,
        windowDays: 120,
        windowText: "trong 4 kỳ sao kê đầu tiên",
      },
      { type: "fee_waiver", cash: 139 },
    ],
  },
  {
    slug: "scotiabank-gold-amex",
    name: "Đến 65,000 điểm Scene+™",
    headline: 65000,
    currency: "scene-plus",
    // Offer mới thay đợt 50,000 (scotiabank.com và đường Apply FinlyWealth →
    // `?cid=a-fin…`, đọc 02/11/2026): tài khoản mở 02/11/2026 – 03/01/2027.
    // $7,500 trong 12 tháng là tổng tích luỹ, đã gồm $2,000 ở mốc đầu.
    startDate: "2026-11-02",
    verifiedAt: "2026-11-02",
    recordedAt: "2026-11-02",
    endDate: "2027-01-03",
    rebate: 150,
    components: [
      { type: "spend_threshold", points: 40000, spend: 2000, windowDays: 90 },
      { type: "spend_threshold", points: 25000, spend: 7500, windowDays: 365 },
    ],
  },
  {
    slug: "scotiabank-gold-amex",
    name: "Đến 50,000 điểm Scene+™",
    headline: 50000,
    currency: "scene-plus",
    // Rebate FinlyWealth hạ $200 → $150 (job check-rebates ghi nhận 31/10/2026
    // 19:31 giờ Toronto, Affiliate API xác nhận cùng tối). Bản ghi mới như bản
    // dưới, offer giữ nguyên.
    startDate: "2026-09-07",
    recordedFrom: "2026-10-31",
    recordedAt: "2026-10-31",
    verifiedAt: "2026-10-31",
    endDate: "2026-11-01",
    rebate: 150,
    components: [
      { type: "spend_threshold", points: 30000, spend: 2000, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 7500, windowDays: 365 },
    ],
  },
  {
    slug: "scotiabank-gold-amex",
    name: "Đến 50,000 điểm Scene+™",
    headline: 50000,
    currency: "scene-plus",
    startDate: "2026-09-07",
    // Mốc chi chép từ `keyBenefitsVi` (thêm 01/10/2026, đọc từ scotiabank.com).
    // Bản ghi MỚI chứ không lấp vào bản cũ: lấp vào bản cũ là khai rằng kho đã
    // biết hai mốc này từ 07/09, và mọi phép đọc `knownAt` trước 01/10 sẽ thấy
    // chúng (Codex bắt). Cùng điều khoản, chỉ khác lúc mình biết.
    recordedFrom: "2026-10-01",
    recordedTo: "2026-10-30",
    recordedAt: "2026-10-01",
    verifiedAt: "2026-10-01",
    endDate: "2026-11-01",
    rebate: 200,
    components: [
      { type: "spend_threshold", points: 30000, spend: 2000, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 7500, windowDays: 365 },
    ],
  },
  {
    slug: "scotiabank-gold-amex",
    name: "Đến 50,000 điểm Scene+™",
    headline: 50000,
    currency: "scene-plus",
    startDate: "2026-09-07",
    recordedTo: "2026-09-30",
    endDate: "2026-11-01",
    rebate: 200,
    components: [],
    incomplete:
      "Nội dung site chỉ nói 'đến 50,000 điểm trong năm đầu', không nêu mốc chi. " +
      "Chưa dựng được component nào, nên engine phải coi mức dùng được là chưa biết " +
      "chứ không được mặc định là 50,000.",
  },
  {
    slug: "scotiabank-scene-plus-visa-students",
    name: "Đến 10,000 điểm Scene+™",
    headline: 10000,
    currency: "scene-plus",
    // Offer mới thay đợt 5,000 (scotiabank.com, đọc 02/11/2026): tài khoản mở
    // 02/11/2026 – 30/04/2027. Cả hai mốc trong 3 tháng đầu; $1,500 là tổng
    // tích luỹ, đã gồm $500. Rebate FinlyWealth vẫn pause.
    startDate: "2026-11-02",
    verifiedAt: "2026-11-02",
    recordedAt: "2026-11-02",
    endDate: "2027-04-30",
    components: [
      { type: "spend_threshold", points: 2500, spend: 500, windowDays: 90 },
      { type: "spend_threshold", points: 7500, spend: 1500, windowDays: 90 },
    ],
  },
  {
    slug: "scotiabank-scene-plus-visa-students",
    name: "Đến 5,000 điểm Scene+™",
    headline: 5000,
    currency: "scene-plus",
    // FinlyWealth pause rebate $50 (trang rebate ghi "Finly rebate paused",
    // Affiliate API không liệt kê offer). Gỡ `rebateVi` trên Contentful
    // 29/10/2026 19:28 giờ Toronto. Bản ghi mới như bản dưới, offer giữ nguyên.
    startDate: "2026-07-02",
    recordedFrom: "2026-10-29",
    recordedAt: "2026-10-29",
    verifiedAt: "2026-10-29",
    endDate: "2026-11-01",
    components: [
      { type: "spend_threshold", points: 2500, spend: 250, windowDays: 90 },
      { type: "spend_threshold", points: 2500, spend: 1000, windowDays: 90 },
    ],
  },
  {
    slug: "scotiabank-scene-plus-visa-students",
    name: "Đến 5,000 điểm Scene+™",
    headline: 5000,
    currency: "scene-plus",
    // `startDate` là ngày NHÀ PHÁT HÀNH công bố; `recordedFrom` là ngày BẢN GHI
    // của mình bắt đầu. Chúng tách nhau ở đây vì offer chạy trước khi kho này
    // tồn tại — nói `effectiveFrom: 2026-07-02` là khai rằng mình đã biết offer
    // này từ tháng 7, trong khi seed dựng ngày 07/09.
    startDate: "2026-07-02",
    recordedFrom: "2026-09-07",
    recordedTo: "2026-10-28",
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
    // RBC® gia hạn offer: điều khoản 1 trên rbcroyalbank.com (đọc 05/11/2026)
    // ghi hồ sơ nhận + duyệt từ 16/06/2026 đến 18/11/2026, cấu trúc giữ nguyên
    // (30,000 + 30,000 khi chi $5,000/3 tháng + 10,000 kỷ niệm năm). Bản đang
    // mở đứng TRƯỚC các bản đã đóng.
    startDate: "2026-06-16",
    recordedFrom: "2026-11-05",
    recordedAt: "2026-11-05",
    verifiedAt: "2026-11-05",
    endDate: "2026-11-18",
    rebate: 140,
    components: [
      { type: "first_purchase", points: 30000 },
      { type: "spend_threshold", points: 30000, spend: 5000, windowDays: 90 },
      { type: "anniversary", points: 10000, windowDays: 365 },
    ],
  },
  {
    slug: "westjet-rbc-world-elite-mastercard",
    name: "Đến 70,000 điểm WestJet®",
    headline: 70000,
    currency: "westjet",
    // Rebate FinlyWealth lên lại $50 → $140 (job check-rebates ghi nhận
    // 02/11/2026 21:29 giờ Toronto, Affiliate API xác nhận 03/11). Bản ghi mới
    // như hai bản dưới, offer giữ nguyên.
    startDate: "2026-09-07",
    recordedFrom: "2026-11-02",
    recordedAt: "2026-11-02",
    verifiedAt: "2026-11-02",
    endDate: "2026-11-04",
    rebate: 140,
    components: [
      { type: "first_purchase", points: 30000 },
      { type: "spend_threshold", points: 30000, spend: 5000, windowDays: 90 },
      { type: "anniversary", points: 10000, windowDays: 365 },
    ],
  },
  {
    slug: "westjet-rbc-world-elite-mastercard",
    name: "Đến 70,000 điểm WestJet®",
    headline: 70000,
    currency: "westjet",
    // Rebate FinlyWealth hạ $140 → $50 (job check-rebates ghi nhận 31/10/2026
    // 19:31 giờ Toronto, Affiliate API xác nhận cùng tối). Bản ghi mới như bản
    // dưới, offer giữ nguyên.
    startDate: "2026-09-07",
    recordedFrom: "2026-10-31",
    recordedTo: "2026-11-01",
    recordedAt: "2026-10-31",
    verifiedAt: "2026-10-31",
    endDate: "2026-11-04",
    rebate: 50,
    components: [
      { type: "first_purchase", points: 30000 },
      { type: "spend_threshold", points: 30000, spend: 5000, windowDays: 90 },
      { type: "anniversary", points: 10000, windowDays: 365 },
    ],
  },
  {
    slug: "westjet-rbc-world-elite-mastercard",
    name: "Đến 70,000 điểm WestJet®",
    headline: 70000,
    currency: "westjet",
    startDate: "2026-09-07",
    recordedTo: "2026-10-30",
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
    // Mức thường quay lại sau offer nâng 22/10 (kiểm 31/10/2026: đường Apply
    // của site tải hai lần + trang công khai amex.ca, cả ba lượt 85,000). Bản
    // đang mở đứng trước các bản đã đóng.
    startDate: "2026-10-31",
    verifiedAt: "2026-10-31",
    recordedAt: "2026-10-31",
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
    slug: "amex-aeroplan-reserve",
    name: "110,000 điểm Aeroplan®",
    headline: 110000,
    currency: "aeroplan",
    // Lần đầu elevated trên CHÍNH trang công khai amex.ca (không chỉ kênh
    // referral riêng lẻ). Thấy 22/10/2026 qua đúng đường Apply của site (Finly
    // → CJ → amex.ca ?CPID=). Amex® không ghi ngày kết thúc.
    startDate: "2026-10-22",
    verifiedAt: "2026-10-22",
    recordedAt: "2026-10-22",
    // 31/10/2026 đường Apply của site và trang công khai chỉ còn 85,000. Amex®
    // không công bố ngày offer nâng kết thúc, nên bản ghi đóng ở ngày cuối mình
    // còn tin nó, không sửa `endDate`.
    recordedTo: "2026-10-30",
    components: [
      { type: "spend_threshold", points: 70000, spend: 7500, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        spend: 2500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $2,500 trong tháng thứ 13 — cửa sổ riêng, không dùng lại tiền đã chi",
      },
    ],
  },
  {
    slug: "amex-aeroplan-reserve",
    name: "85,000 điểm Aeroplan®",
    headline: 85000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    // 22/10/2026 đúng đường Apply của site thấy mức nâng 110,000. Amex® không
    // công bố ngày offer nâng kết thúc, nên bản ghi đóng ở ngày cuối mình còn
    // tin nó, không sửa `endDate`.
    recordedTo: "2026-10-21",
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
        note: "Chi $24,000 trong 12 tháng, nhận ở mốc anniversary 1 năm",
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
    name: "160,000 điểm TD Rewards®",
    headline: 160000,
    currency: "td-rewards",
    // Cùng lý do với Scotiabank® Scene+™ ở trên: TD® nâng mức này từ 01/09,
    // nhưng bản ghi của mình bắt đầu từ 07/09.
    startDate: "2026-09-01",
    recordedFrom: "2026-09-07",
    feeFirstYear: 0,
    rebate: 50,
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
      // Cùng điều khoản với bản Gold ở trên — xem ghi chú ở đó.
      {
        type: "spend_threshold",
        points: 30000,
        spend: 3000,
        windowDays: 120,
        windowText: "trong 4 kỳ sao kê đầu tiên",
      },
      {
        type: "spend_threshold",
        points: 15000,
        spend: 5000,
        windowDays: 120,
        windowText: "trong 4 kỳ sao kê đầu tiên",
      },
      { type: "fee_waiver", cash: 139 },
    ],
  },
  {
    slug: "amex-aeroplan-business-reserve",
    name: "90,000 điểm Aeroplan®",
    headline: 90000,
    currency: "aeroplan",
    // Mức thường quay lại sau offer nâng 22/10 (kiểm 05/11/2026: đường Apply của
    // site + trang công khai amex.ca cùng 65,000/$10,500 + 25,000/$3,500 tháng
    // 13; Finly API cùng số). Bản đang mở đứng trước các bản đã đóng.
    startDate: "2026-11-05",
    verifiedAt: "2026-11-05",
    recordedAt: "2026-11-05",
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
    slug: "amex-aeroplan-business-reserve",
    name: "120,000 điểm Aeroplan®",
    headline: 120000,
    currency: "aeroplan",
    // Offer nâng quay lại LẦN BA: thấy 22/10/2026 trên đúng đường Apply của
    // site (Finly → CJ → amex.ca ?CPID=), chỉ MỘT ngày sau khi về mức thường
    // 21/10. Cùng mốc chi với các bản nâng trước. Amex® không ghi ngày kết
    // thúc.
    startDate: "2026-10-22",
    verifiedAt: "2026-10-22",
    recordedAt: "2026-10-22",
    // 05/11/2026 chỉ còn mức thường (xem bản trên); đóng ở ngày cuối mình còn
    // tin nó, không sửa `endDate`.
    recordedTo: "2026-11-04",
    components: [
      { type: "spend_threshold", points: 80000, spend: 10500, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        spend: 3500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $3,500 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "amex-aeroplan-business-reserve",
    name: "90,000 điểm Aeroplan®",
    headline: 90000,
    currency: "aeroplan",
    // Mức thường quay lại sau offer nâng 09/10 (kiểm 21/10/2026 qua đúng đường
    // Apply của site). Chỉ sống đúng MỘT ngày trước khi offer nâng quay lại.
    startDate: "2026-10-21",
    verifiedAt: "2026-10-21",
    recordedAt: "2026-10-21",
    recordedTo: "2026-10-21",
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
    slug: "amex-aeroplan-business-reserve",
    name: "120,000 điểm Aeroplan®",
    headline: 120000,
    currency: "aeroplan",
    // Offer nâng quay lại: thấy 09/10/2026 trên đúng đường Apply của site
    // (Finly → CJ → amex.ca ?CPID=), cùng mốc chi với bản 01/10.
    startDate: "2026-10-09",
    verifiedAt: "2026-10-09",
    recordedAt: "2026-10-09",
    // 21/10/2026 đúng đường Apply của site (Finly → CJ → amex.ca ?CPID=), tải hai
    // lần, chỉ còn mức thường. Amex® không công bố ngày offer nâng kết thúc, nên
    // bản ghi đóng ở ngày cuối mình còn tin nó, không sửa `endDate`.
    recordedTo: "2026-10-20",
    components: [
      { type: "spend_threshold", points: 80000, spend: 10500, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        spend: 3500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $3,500 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "amex-aeroplan-business-reserve",
    name: "90,000 điểm Aeroplan®",
    headline: 90000,
    currency: "aeroplan",
    // Mức thường quay lại sau offer nâng 01/10 (kiểm 02/10/2026 qua đúng đường
    // Apply của site và trang công khai amex.ca).
    startDate: "2026-10-02",
    endDate: "2026-10-08",
    verifiedAt: "2026-10-02",
    recordedAt: "2026-10-02",
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
    slug: "amex-aeroplan-business-reserve",
    name: "120,000 điểm Aeroplan®",
    headline: 120000,
    currency: "aeroplan",
    // Offer nâng thấy trên amex.ca (đúng đường Apply của site: FinlyWealth → CJ
    // → amex.ca ?CPID=) ngày 01/10/2026. Amex® không ghi ngày bắt đầu lẫn ngày
    // kết thúc — `startDate` là ngày mình thấy.
    startDate: "2026-10-01",
    // 02/10/2026 cùng đường Apply đó và trang công khai đã về mức thường —
    // offer nâng chỉ thấy được đúng một ngày. `endDate` là ngày cuối còn thấy.
    endDate: "2026-10-01",
    verifiedAt: "2026-10-01",
    recordedAt: "2026-10-01",
    components: [
      { type: "spend_threshold", points: 80000, spend: 10500, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        spend: 3500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $3,500 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "amex-aeroplan-business-reserve",
    name: "90,000 điểm Aeroplan®",
    headline: 90000,
    currency: "aeroplan",
    startDate: "2026-09-07",
    endDate: "2026-09-30",
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
    name: "80,000 điểm Bonvoy®",
    headline: 80000,
    currency: "bonvoy",
    // Mức thường sau khi offer 110,000 đóng. Ngày site (Contentful) đổi sang
    // mức này — Amex® không ghi ngày bắt đầu. Bản đang mở đứng trước bản đã
    // đóng, như amex-green ở đầu file.
    startDate: "2026-09-28",
    verifiedAt: "2026-09-30",
    recordedAt: "2026-09-30",
    components: [
      { type: "spend_threshold", points: 70000, spend: 5000, windowDays: 90 },
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
    slug: "amex-marriott-bonvoy-business",
    name: "110,000 điểm Bonvoy®",
    headline: 110000,
    currency: "bonvoy",
    startDate: "2026-09-07",
    endDate: "2026-09-22",
    components: [],
    incomplete: "Nội dung site không nêu mốc chi của welcome bonus này.",
  },
  {
    slug: "national-bank-world-elite-mastercard",
    name: "Đến 35,000 điểm À la carte™",
    headline: 35000,
    currency: "a-la-carte",
    // Promotion mới trên nbc.ca (đọc 09/11/2026 bằng browser): "Length of the
    // welcome promotion: From November 5, 2026, to March 31, 2027". Mình biết
    // từ 09/11 (`recordedFrom`), nên truy vấn trước ngày đó vẫn thấy bản "không
    // có welcome bonus" — đúng với điều kho biết lúc ấy. 35,000 = 5,000 ($5,000/90 ngày)
    // + 10,000 ($20,000/12 tháng) + 10,000 khi đăng ký payment insurance (sản
    // phẩm trả phí) giữ ít nhất 90 ngày + 10,000 khi mở tài khoản chequing đầu
    // tiên trong 14 ngày (gói Connected®/Total®/newcomer, giữ 180 ngày). Hai
    // phần sau đòi mua thêm sản phẩm, không phải chi tiêu, nên KHÔNG dựng thành
    // component: engine chỉ tính 15,000 điểm từ hai mốc chi — tổng component
    // thấp hơn headline là hợp lệ (validate.ts).
    startDate: "2026-11-05",
    endDate: "2027-03-31",
    recordedFrom: "2026-11-09",
    verifiedAt: "2026-11-09",
    recordedAt: "2026-11-09",
    rebate: 100,
    components: [
      { type: "spend_threshold", points: 5000, spend: 5000, windowDays: 90 },
      { type: "spend_threshold", points: 10000, spend: 20000, windowDays: 365 },
    ],
  },
  {
    slug: "national-bank-world-elite-mastercard",
    name: "Không có welcome bonus",
    headline: null,
    currency: null,
    startDate: "2026-09-07",
    // 09/11/2026 nbc.ca có promotion 35,000 điểm (bản ngay trên, NBC ghi mở từ
    // 05/11). Bản ghi này đóng ở ngày cuối mình còn tin nó, không đặt `endDate`
    // — NBC không công bố việc "không có bonus" kết thúc.
    recordedTo: "2026-11-08",
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
    rebate: 50,
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
    endDate: "2026-11-25",
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
    // Cùng điều khoản, BMO® gia hạn: điều khoản offer (bmo.com, footnote 112,
    // đọc 02/11/2026) nhận đơn từ 21/03/2025 tới 31/10/2027. Bản dưới mang hạn
    // 31/10/2026 site ghi lúc dựng seed — giữ nguyên, đó là hạn đã công bố.
    // `recordedFrom` 01/11: hôm đó bmo.com vẫn rao 70,000 sau hạn cũ.
    startDate: "2025-03-21",
    recordedFrom: "2026-11-01",
    verifiedAt: "2026-11-02",
    recordedAt: "2026-11-02",
    endDate: "2027-10-31",
    feeFirstYear: 0,
    rebate: 125,
    components: [
      { type: "spend_threshold", points: 20000, spend: 5000, windowDays: 110 },
      { type: "spend_threshold", points: 20000, spend: 9000, windowDays: 180 },
      { type: "spend_threshold", points: 30000, spend: 18000, windowDays: 365 },
      { type: "fee_waiver", cash: 199 },
    ],
  },
  {
    slug: "bmo-viporter-world-elite-mastercard",
    name: "70,000 điểm VIPorter®",
    headline: 70000,
    currency: "viporter",
    startDate: "2026-09-07",
    endDate: "2026-10-31",
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
    // Rebate FinlyWealth $100 → $125 (job check-rebates ghi nhận 02/11/2026
    // 13:45 giờ Toronto, Affiliate API xác nhận 03/11). Bản ghi mới đứng trước
    // bản đã đóng, offer giữ nguyên.
    startDate: "2026-09-07",
    recordedFrom: "2026-11-02",
    recordedAt: "2026-11-02",
    verifiedAt: "2026-11-02",
    rebate: 125,
    components: [
      { type: "first_purchase", points: 5000 },
      { type: "spend_threshold", points: 15000, spend: 3000, windowDays: 90 },
      { type: "anniversary", points: 5000, windowDays: 365, note: "Thưởng gia hạn mỗi năm" },
    ],
  },
  {
    slug: "united-mileageplus-neo-world-elite-mastercard",
    name: "25,000 miles United® MileagePlus®",
    headline: 25000,
    currency: "mileageplus",
    startDate: "2026-09-07",
    recordedTo: "2026-11-01",
    rebate: 100,
    components: [
      { type: "first_purchase", points: 5000 },
      { type: "spend_threshold", points: 15000, spend: 3000, windowDays: 90 },
      { type: "anniversary", points: 5000, windowDays: 365, note: "Thưởng gia hạn mỗi năm" },
    ],
  },
  {
    slug: "amex-marriott-bonvoy",
    name: "70,000 điểm Bonvoy®",
    headline: 70000,
    currency: "bonvoy",
    // Mức thường sau khi offer 110,000 đóng. Ngày site (Contentful) đổi sang
    // mức này — Amex® không ghi ngày bắt đầu. Bản đang mở đứng trước bản đã
    // đóng, như amex-green ở đầu file.
    startDate: "2026-09-28",
    verifiedAt: "2026-09-30",
    recordedAt: "2026-09-30",
    components: [
      { type: "spend_threshold", points: 60000, spend: 3000, windowDays: 90 },
      {
        type: "anniversary",
        points: 10000,
        spend: 500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $500 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "amex-marriott-bonvoy",
    name: "110,000 điểm Bonvoy®",
    headline: 110000,
    currency: "bonvoy",
    startDate: "2026-09-07",
    endDate: "2026-09-22",
    components: [],
    incomplete: "Nội dung site không nêu mốc chi của welcome bonus này.",
  },
  {
    // Offer ra mắt cùng thẻ, "LIMITED TIME OFFER" trên amex.ca: đơn nộp từ
    // 29/10/2026 tới 11/01/2027. Free Night Reward đi cùng mốc $3,000 nhưng
    // không phải điểm, nên chỉ nằm ở `note` — §11 chỉ đếm cái quy được ra điểm.
    slug: "amex-hilton-honors",
    name: "70,000 điểm Hilton Honors™ + 1 Free Night Reward",
    headline: 70000,
    currency: "hilton",
    startDate: "2026-10-29",
    endDate: "2027-01-11",
    verifiedAt: "2026-10-29",
    recordedAt: "2026-10-29",
    components: [
      { type: "spend_threshold", points: 60000, spend: 3000, windowDays: 90, note: "Kèm 1 Free Night Reward" },
      {
        type: "anniversary",
        points: 10000,
        spend: 500,
        windowDays: 30,
        startsAfterDays: 365,
        note: "Chi $500 trong tháng thứ 13",
      },
    ],
  },
  {
    slug: "scotiabank-passport-visa-infinite",
    name: "Đến 45,000 điểm Scene+™",
    headline: 45000,
    currency: "scene-plus",
    // Offer mới thay đợt 35,000 (scotiabank.com và đường Apply FinlyWealth →
    // `?cid=a-fin…`, đọc 02/11/2026): tài khoản mở 02/11/2026 – 03/01/2027.
    // $10,000 trong 6 tháng là tổng tích luỹ, đã gồm $3,000 ở mốc đầu.
    startDate: "2026-11-02",
    verifiedAt: "2026-11-02",
    recordedAt: "2026-11-02",
    endDate: "2027-01-03",
    rebate: 150,
    components: [
      { type: "spend_threshold", points: 15000, spend: 3000, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 10000, windowDays: 180 },
      // Thưởng NĂM khi chi $40,000 — như các bản dưới, 10,000 điểm này KHÔNG
      // được cộng vào "mức dùng được" mặc định.
      { type: "spend_threshold", points: 10000, spend: 40000, windowDays: 365 },
    ],
  },
  {
    slug: "scotiabank-passport-visa-infinite",
    name: "Đến 35,000 điểm Scene+™",
    headline: 35000,
    currency: "scene-plus",
    // Rebate FinlyWealth lên lại $100 → $150 (job check-rebates ghi nhận
    // 28/10/2026 11:22 giờ Toronto, `<title>` trang FinlyWealth kiểm cùng tối).
    // Bản ghi mới như hai bản dưới, offer giữ nguyên.
    startDate: "2026-08-04",
    recordedFrom: "2026-10-28",
    recordedAt: "2026-10-28",
    verifiedAt: "2026-10-28",
    endDate: "2026-11-01",
    rebate: 150,
    components: [
      { type: "spend_threshold", points: 25000, spend: 2000, windowDays: 90 },
      // Mốc $40,000/năm: với người chi $2,000/tháng thì đây là điều không xảy
      // ra. Chính là ví dụ §11 lấy làm mẫu — 10,000 điểm này KHÔNG được cộng
      // vào "mức dùng được" mặc định.
      { type: "spend_threshold", points: 10000, spend: 40000, windowDays: 365 },
    ],
  },
  {
    slug: "scotiabank-passport-visa-infinite",
    name: "Đến 35,000 điểm Scene+™",
    headline: 35000,
    currency: "scene-plus",
    // Cùng offer với bản ngay dưới; chỉ rebate FinlyWealth đổi $120 → $100
    // (job check-rebates ghi nhận 27/10/2026 19:53 giờ Toronto). Bản ghi MỚI
    // chứ không sửa tại chỗ, để truy vấn `asOf`/`knownAt` trước 27/10 vẫn
    // thấy $120 như người đọc đã thấy lúc đó.
    startDate: "2026-08-04",
    recordedFrom: "2026-10-27",
    recordedTo: "2026-10-27",
    recordedAt: "2026-10-27",
    verifiedAt: "2026-10-27",
    endDate: "2026-11-01",
    rebate: 100,
    components: [
      { type: "spend_threshold", points: 25000, spend: 2000, windowDays: 90 },
      // Mốc $40,000/năm: với người chi $2,000/tháng thì đây là điều không xảy
      // ra. Chính là ví dụ §11 lấy làm mẫu — 10,000 điểm này KHÔNG được cộng
      // vào "mức dùng được" mặc định.
      { type: "spend_threshold", points: 10000, spend: 40000, windowDays: 365 },
    ],
  },
  {
    slug: "scotiabank-passport-visa-infinite",
    name: "Đến 35,000 điểm Scene+™",
    headline: 35000,
    currency: "scene-plus",
    // Cửa sổ mở tài khoản 04/08 – 01/11/2026 (scotiabank.com, đọc 01/10/2026).
    // Hạn 01/11 mới biết hôm đó nên là bản ghi MỚI, không gắn vào bản cũ —
    // xem scotiabank-gold-amex. Về `startDate` và `recordedFrom`, xem
    // scotiabank-scene-plus-visa-students.
    startDate: "2026-08-04",
    recordedFrom: "2026-10-01",
    recordedTo: "2026-10-26",
    recordedAt: "2026-10-01",
    verifiedAt: "2026-10-01",
    endDate: "2026-11-01",
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
    slug: "scotiabank-passport-visa-infinite",
    name: "Đến 35,000 điểm Scene+™",
    headline: 35000,
    currency: "scene-plus",
    startDate: "2026-08-04",
    recordedFrom: "2026-09-07",
    recordedTo: "2026-09-30",
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
    // Đọc qua đúng đường apply của site (link FinlyWealth → trang offer
    // affiliate của Tangerine): 50,000 điểm, apply trước 31/01/2027.
    // FinlyWealth lúc đó vẫn ghi mức cũ 30,000/$3,000 hạn 30/10/2026.
    // 10,000 điểm khi chi $30,000/năm là thưởng THƯỜNG NIÊN lặp lại mỗi năm,
    // không thuộc welcome bonus — nó nằm ở keyBenefitsVi, không ở đây.
    slug: "tangerine-rewards-world-elite-mastercard",
    name: "50,000 điểm Scene+™",
    headline: 50000,
    currency: "scene-plus",
    startDate: "2026-09-25",
    endDate: "2027-01-31",
    verifiedAt: "2026-09-25",
    recordedAt: "2026-09-25",
    rebate: 120,
    components: [{ type: "spend_threshold", points: 50000, spend: 5000, windowDays: 90 }],
  },
  // Capital One® match TOÀN BỘ cashback 365 ngày đầu, đô đổi đô, không trần và
  // không mốc chi. Giá trị bằng đúng tiền hoàn năm đầu của người dùng, tức phụ
  // thuộc hoàn toàn vào họ chi bao nhiêu — cùng lý do phần "đến $600" của TD®
  // Cash Back không nằm trong components: §11 chỉ đếm cái chắc chắn nhận được.
  // Không có thành phần nào đếm được nên `kind` phải khai tay; suy ra sẽ thành
  // `none`, tức nói thẻ không có welcome bonus. Không công bố ngày kết thúc
  // ("subject to change or cancellation at any time").
  // Giới hạn đã biết (Codex 05/10/2026): §11 chấm offer này ~0.4 với giá trị
  // bonus $0 và "hiệu quả chi" tối đa vì không có mốc chi — tức đánh giá THẤP
  // phần match. Sửa đúng cần một loại thành phần "match tỷ lệ năm đầu"; chưa
  // làm cho riêng hai thẻ này.
  {
    slug: "capital-one-quicksilver-world-elite-mastercard",
    name: "Nhân đôi toàn bộ cashback năm đầu",
    headline: null,
    currency: null,
    kind: "cash",
    startDate: "2026-10-05",
    verifiedAt: "2026-10-05",
    recordedAt: "2026-10-05",
    components: [],
  },
  {
    slug: "capital-one-quicksilver-world-mastercard",
    name: "Nhân đôi toàn bộ cashback năm đầu",
    headline: null,
    currency: null,
    kind: "cash",
    startDate: "2026-10-05",
    verifiedAt: "2026-10-05",
    recordedAt: "2026-10-05",
    components: [],
  },
  {
    slug: "rbc-avion-visa-infinite",
    name: "Đến 70,000 điểm Avion®",
    headline: 70000,
    currency: "avion",
    startDate: "2026-09-07",
    endDate: "2026-11-25",
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
    endDate: "2026-11-25",
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
  {
    slug: "amex-platinum",
    name: "Tới 100,000 điểm Membership Rewards®",
    headline: 100000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 22/10 (kiểm 05/11/2026: đường Apply của
    // site + trang công khai amex.ca cùng "UP TO 100,000", Finly API cùng số).
    // Cùng mốc chi với bản 07/09. Bản đang mở đứng trước các bản đã đóng.
    startDate: "2026-11-05",
    verifiedAt: "2026-11-05",
    recordedAt: "2026-11-05",
    components: [
      { type: "spend_threshold", points: 70000, spend: 10000, windowDays: 90 },
      {
        type: "anniversary",
        points: 30000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-platinum",
    name: "Tới 130,000 điểm Membership Rewards®",
    headline: 130000,
    currency: "amex-mr",
    // Offer nâng: thấy 22/10/2026 trên đúng đường Apply của site (Finly → CJ
    // → amex.ca ?CPID=). Amex® không ghi ngày kết thúc.
    startDate: "2026-10-22",
    verifiedAt: "2026-10-22",
    recordedAt: "2026-10-22",
    // 05/11/2026 đường Apply và trang công khai chỉ còn 100,000. Amex® không công
    // bố ngày offer nâng kết thúc, nên bản ghi đóng ở ngày cuối mình còn tin nó,
    // không sửa `endDate`.
    recordedTo: "2026-11-04",
    components: [
      { type: "spend_threshold", points: 90000, spend: 10000, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-platinum",
    name: "Tới 100,000 điểm Membership Rewards®",
    headline: 100000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    // 22/10/2026 đúng đường Apply của site thấy mức nâng 130,000. Amex® không
    // công bố ngày offer nâng kết thúc, nên bản ghi đóng ở ngày cuối mình còn
    // tin nó, không sửa `endDate`.
    recordedTo: "2026-10-21",
    components: [
      { type: "spend_threshold", points: 70000, spend: 10000, windowDays: 90 },
      {
        type: "anniversary",
        points: 30000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 120,000 điểm Membership Rewards®",
    headline: 120000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 22/10 (kiểm 05/11/2026: đường Apply của
    // site + trang công khai amex.ca, năm lượt tải đều "UP TO 120,000" — không
    // còn thấy biến thể A/B 150,000 của 31/10; Finly API cùng số). Bản đang mở
    // đứng trước các bản đã đóng.
    startDate: "2026-11-05",
    verifiedAt: "2026-11-05",
    recordedAt: "2026-11-05",
    components: [
      { type: "spend_threshold", points: 80000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 150,000 điểm Membership Rewards®",
    headline: 150000,
    currency: "amex-mr",
    // Offer nâng quay lại LẦN BA: thấy 22/10/2026 trên đúng đường Apply của
    // site (Finly → CJ → amex.ca ?CPID=), chỉ MỘT ngày sau khi về mức thường
    // 21/10. Cùng mốc chi với các bản nâng trước. Amex® không ghi ngày kết
    // thúc.
    startDate: "2026-10-22",
    verifiedAt: "2026-10-22",
    recordedAt: "2026-10-22",
    // 05/11/2026 chỉ còn mức thường (xem bản trên); đóng ở ngày cuối mình còn
    // tin nó, không sửa `endDate`.
    recordedTo: "2026-11-04",
    components: [
      { type: "spend_threshold", points: 100000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 50000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 120,000 điểm Membership Rewards®",
    headline: 120000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 09/10 (kiểm 21/10/2026 qua đúng đường
    // Apply của site). Chỉ sống đúng MỘT ngày trước khi offer nâng quay lại.
    startDate: "2026-10-21",
    verifiedAt: "2026-10-21",
    recordedAt: "2026-10-21",
    recordedTo: "2026-10-21",
    components: [
      { type: "spend_threshold", points: 80000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 150,000 điểm Membership Rewards®",
    headline: 150000,
    currency: "amex-mr",
    // Offer nâng quay lại: thấy 09/10/2026 trên đúng đường Apply của site
    // (Finly → CJ → amex.ca ?CPID=), cùng mốc chi với bản 01/10.
    startDate: "2026-10-09",
    verifiedAt: "2026-10-09",
    recordedAt: "2026-10-09",
    // 21/10/2026 đúng đường Apply của site (Finly → CJ → amex.ca ?CPID=), tải hai
    // lần, chỉ còn mức thường. Amex® không công bố ngày offer nâng kết thúc, nên
    // bản ghi đóng ở ngày cuối mình còn tin nó, không sửa `endDate`.
    recordedTo: "2026-10-20",
    components: [
      { type: "spend_threshold", points: 100000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 50000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 120,000 điểm Membership Rewards®",
    headline: 120000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 01/10 (kiểm 02/10/2026 qua đúng đường
    // Apply của site và trang công khai amex.ca).
    startDate: "2026-10-02",
    endDate: "2026-10-08",
    verifiedAt: "2026-10-02",
    recordedAt: "2026-10-02",
    components: [
      { type: "spend_threshold", points: 80000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 150,000 điểm Membership Rewards®",
    headline: 150000,
    currency: "amex-mr",
    // Offer nâng, xem amex-aeroplan-business-reserve.
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    verifiedAt: "2026-10-01",
    recordedAt: "2026-10-01",
    components: [
      { type: "spend_threshold", points: 100000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 50000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-platinum",
    name: "Tới 120,000 điểm Membership Rewards®",
    headline: 120000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    endDate: "2026-09-30",
    components: [
      { type: "spend_threshold", points: 80000, spend: 15000, windowDays: 90 },
      {
        type: "anniversary",
        points: 40000,
        windowDays: 90,
        startsAfterDays: 425,
        note: "Quẹt một giao dịch trong khoảng tháng 15–17",
      },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 70,000 điểm Membership Rewards®",
    headline: 70000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 22/10 (kiểm 05/11/2026 qua đúng đường
    // Apply của site: 50,000/$7,500 trong 3 tháng + 20,000/$30,000 trong năm
    // đầu; Finly API cùng số). Bản đang mở đứng trước các bản đã đóng.
    startDate: "2026-11-05",
    verifiedAt: "2026-11-05",
    recordedAt: "2026-11-05",
    components: [
      { type: "spend_threshold", points: 50000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 30000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 90,000 điểm Membership Rewards®",
    headline: 90000,
    currency: "amex-mr",
    // Offer nâng quay lại LẦN BA: thấy 22/10/2026 trên đúng đường Apply của
    // site (Finly → CJ → amex.ca ?CPID=), chỉ MỘT ngày sau khi về mức thường
    // 21/10. Cùng mốc chi với các bản nâng trước. Amex® không ghi ngày kết
    // thúc.
    startDate: "2026-10-22",
    verifiedAt: "2026-10-22",
    recordedAt: "2026-10-22",
    // 05/11/2026 chỉ còn mức thường (xem bản trên); đóng ở ngày cuối mình còn
    // tin nó, không sửa `endDate`.
    recordedTo: "2026-11-04",
    components: [
      { type: "spend_threshold", points: 60000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 30000, spend: 30000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 70,000 điểm Membership Rewards®",
    headline: 70000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 09/10 (kiểm 21/10/2026 qua đúng đường
    // Apply của site). Chỉ sống đúng MỘT ngày trước khi offer nâng quay lại.
    startDate: "2026-10-21",
    verifiedAt: "2026-10-21",
    recordedAt: "2026-10-21",
    recordedTo: "2026-10-21",
    components: [
      { type: "spend_threshold", points: 50000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 30000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 90,000 điểm Membership Rewards®",
    headline: 90000,
    currency: "amex-mr",
    // Offer nâng quay lại: thấy 09/10/2026 trên đúng đường Apply của site
    // (Finly → CJ → amex.ca ?CPID=), cùng mốc chi với bản 01/10.
    startDate: "2026-10-09",
    verifiedAt: "2026-10-09",
    recordedAt: "2026-10-09",
    // 21/10/2026 đúng đường Apply của site (Finly → CJ → amex.ca ?CPID=), tải hai
    // lần, chỉ còn mức thường. Amex® không công bố ngày offer nâng kết thúc, nên
    // bản ghi đóng ở ngày cuối mình còn tin nó, không sửa `endDate`.
    recordedTo: "2026-10-20",
    components: [
      { type: "spend_threshold", points: 60000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 30000, spend: 30000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 70,000 điểm Membership Rewards®",
    headline: 70000,
    currency: "amex-mr",
    // Mức thường quay lại sau offer nâng 01/10 (kiểm 02/10/2026 qua đúng đường
    // Apply của site và trang công khai amex.ca).
    startDate: "2026-10-02",
    endDate: "2026-10-08",
    verifiedAt: "2026-10-02",
    recordedAt: "2026-10-02",
    components: [
      { type: "spend_threshold", points: 50000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 30000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 90,000 điểm Membership Rewards®",
    headline: 90000,
    currency: "amex-mr",
    // Offer nâng, xem amex-aeroplan-business-reserve.
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    verifiedAt: "2026-10-01",
    recordedAt: "2026-10-01",
    components: [
      { type: "spend_threshold", points: 60000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 30000, spend: 30000, windowDays: 365 },
    ],
  },
  {
    slug: "amex-business-gold",
    name: "Tới 70,000 điểm Membership Rewards®",
    headline: 70000,
    currency: "amex-mr",
    startDate: "2026-09-07",
    endDate: "2026-09-30",
    components: [
      { type: "spend_threshold", points: 50000, spend: 7500, windowDays: 90 },
      { type: "spend_threshold", points: 20000, spend: 30000, windowDays: 365 },
    ],
  },
];

/**
 * `ComponentSeed` → hình dạng chung mà `spend.ts` nhận.
 *
 * Phép nhân của `monthly_spend` (Cobalt đòi $750 MỖI chu kỳ trong 12 chu kỳ,
 * tức $9,000 thật) TỪNG nằm ở đây dưới dạng một hàm riêng. Nó chuyển sang
 * `spend.ts` khi engine ở Phase 3 cần đúng quy tắc đó để tính mức bonus dùng
 * được: hai chỗ kiểm cùng một khái niệm bằng hai dòng viết riêng thì chúng sẽ
 * lệch, và lệch im lặng. Ở đây chỉ còn phép dịch tên trường.
 */
function shapeOf(components: ComponentSeed[]): SpendComponentShape[] {
  return components.map((c) => ({
    componentType: c.type,
    spendRequirement: c.spend ?? null,
    spendWindowDays: c.windowDays ?? null,
    windowStartsAfterDays: c.startsAfterDays ?? 0,
    repeatCount: c.repeat ?? null,
  }));
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
/**
 * Thẻ này thưởng bằng gì, khi seed không nói rõ.
 *
 * Có đồng tiền điểm thì là điểm. Không có, mà có thành phần trả tiền
 * (`statement_credit`, hoặc `fee_waiver` đứng một mình như TD® Cash Back), thì
 * là tiền. Không có gì cả thì là không có welcome bonus — trường hợp thật của
 * National Bank® và hai thẻ Wealthsimple®.
 */
function inferBonusKind(seed: OfferSeed): "points" | "cash" | "none" {
  if (seed.currency !== null) return "points";
  const paysCash = seed.components.some((c) => (c.cash ?? 0) > 0);
  return paysCash ? "cash" : "none";
}

function offerIdFor(seed: OfferSeed): string {
  // Lấy theo ngày BẢN GHI mở, không theo ngày điều khoản: hai offer nối tiếp
  // nhau của cùng một thẻ luôn có `recordedFrom` khác nhau (validator chặn
  // chồng lấn), còn `startDate` thì có thể trùng — nhà phát hành hay công bố
  // một offer "từ 01/09" rồi chỉnh điều khoản giữa chừng.
  return `offer_prd_${seed.slug}_${seed.recordedFrom ?? seed.startDate}`;
}

export const OFFERS: Offer[] = OFFER_SEEDS.map((seed) => ({
  id: id<OfferId>(offerIdFor(seed)),
  productId: productIdFor(seed.slug),
  name: seed.name,
  startDate: seed.startDate,
  endDate: seed.endDate ?? null,
  bonusKind: seed.kind ?? inferBonusKind(seed),
  bonusCurrencyId: seed.currency ? (seed.currency as PointsProgramId) : null,
  headlineBonus: seed.headline,
  minimumSpend: totalSpend(spendWindowsOf(shapeOf(seed.components))),
  minimumSpendMonths: longestWindowMonths(allWindowEnds(shapeOf(seed.components))),
  spendPerNinetyDays: spendPerNinetyDays(spendWindowsOf(shapeOf(seed.components))),
  annualFeeFirstYear: seed.feeFirstYear ?? null,
  annualFeeRebate: seed.rebate ?? null,
  // V1 chỉ có offer công khai. Offer targeted (link riêng, thư mời) tồn tại
  // thật nhưng site không đăng, nên không có dữ liệu để seed.
  isTargeted: false,
  isPublic: true,
  isActive: true,
  effectiveFrom: seed.recordedFrom ?? seed.startDate,
  effectiveTo: seed.recordedTo ?? seed.endDate ?? null,
  sourceUrl: `${CONTENTFUL_SOURCE}/${seed.slug}`,
  sourceKind: "ghe1a",
  verifiedAt: seed.verifiedAt ?? VERIFIED_ON,
  recordedAt: seed.recordedAt ?? RECORDED_ON,
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
    spendWindowText: c.windowText ?? null,
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
