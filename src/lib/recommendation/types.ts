/**
 * Phase 1 của recommendation engine: các entity dữ liệu nền.
 *
 * VÌ SAO KHÔNG PHẢI POSTGRES. Spec đề xuất Supabase, nhưng repo này chưa từng
 * có database nào — dữ liệu miền có cấu trúc nằm trong module TS đã chú thích
 * kỹ (`award-charts.ts`, `transfer-partners.ts`, `points-programs.ts`), còn
 * nội dung biên tập nằm ở Contentful. Chỗ dữ liệu này là dữ liệu THAM CHIẾU do
 * biên tập viên duy trì tay (spec §23 nói thẳng: không scrape ở V1), nên đặc
 * tính nó cần là "lịch sử đọc được, review được trước khi lên site" — đúng thứ
 * git cho sẵn. Lớp `RecommendationDataSource` trong `source.ts` là cửa duy
 * nhất engine đọc qua, nên Phase 2 (dữ liệu người dùng, bắt buộc phải có DB)
 * đổi backend mà không đụng tới engine.
 *
 * CÁCH NỐI VỚI CONTENTFUL. `Product.slug` LÀ slug của entry `creditCardOffer`
 * trên Contentful. Contentful vẫn giữ nguyên phần nó đang giữ: tên, ảnh thẻ,
 * copy tiếng Việt, apply URL, badge rebate. Chỗ này chỉ giữ những dữ kiện có
 * cấu trúc mà engine cần và Contentful không có. Cố ý KHÔNG chép lại welcome
 * bonus hay annual fee dưới dạng chữ — repo đã có một lớp lỗi đúng kiểu đó
 * (con số rebate nằm ở hai chỗ, 3/10 thẻ lệch nhau), nên `audit:reco-data` bắt
 * mọi trường hợp `annualFee` ở đây không khớp con số trong `annualFeeVi`.
 *
 * DỮ LIỆU CÓ HẠN, VÀ PHẢI NÓI RA. Mọi bản ghi nhạy cảm thời gian mang
 * `sourceUrl` + `verifiedAt` + `confidence` (spec §21, §24). `confidence`
 * KHÔNG phải trang trí: engine ở Phase 3 hạ độ tin cậy của khuyến nghị khi
 * dựa vào bản ghi `estimated`, và lời giải thích cho người đọc phải nói khác
 * đi giữa một dữ kiện đã kiểm và một con số ước lượng.
 */

/* ------------------------------------------------------------------ *
 * Kiểu id
 *
 * Branded string thay vì `string` trần: `EarningRate.productId` nhận nhầm một
 * `PointsProgramId` là lỗi im lặng tuyệt đối trong một file 300 dòng toàn
 * chuỗi giống nhau. Brand không tồn tại lúc chạy — nó chỉ bắt lỗi lúc biên
 * dịch, còn toàn vẹn tham chiếu thật sự do `validate.ts` kiểm.
 * ------------------------------------------------------------------ */

declare const brand: unique symbol;
type Branded<K extends string> = string & { readonly [brand]: K };

export type IssuerId = Branded<"IssuerId">;
export type ProductId = Branded<"ProductId">;
export type PointsProgramId = Branded<"PointsProgramId">;
export type TransferPathId = Branded<"TransferPathId">;
export type OfferId = Branded<"OfferId">;
export type OfferComponentId = Branded<"OfferComponentId">;
export type BenefitId = Branded<"BenefitId">;
export type ProductBenefitId = Branded<"ProductBenefitId">;
export type EarningRateId = Branded<"EarningRateId">;
export type EligibilityRuleId = Branded<"EligibilityRuleId">;
export type AwardStrategyId = Branded<"AwardStrategyId">;
export type SpendCategoryId = Branded<"SpendCategoryId">;

/** Ép một chuỗi viết tay trong file seed thành id có brand. Chỉ dùng trong
 *  `data/`; không có kiểm tra nào ở đây, `validate.ts` mới là chỗ kiểm. */
export function id<T extends Branded<string>>(value: string): T {
  return value as T;
}

/* ------------------------------------------------------------------ *
 * Kiểu dùng chung
 * ------------------------------------------------------------------ */

/**
 * Một bản ghi có hiệu lực theo thời gian (spec §21).
 *
 * Luật: KHÔNG ghi đè điều khoản cũ. Điều khoản đổi thì đóng bản ghi cũ bằng
 * `effectiveTo` rồi thêm bản mới với `effectiveFrom`. Nhờ vậy Phase 4 trả lời
 * được "vì sao khuyến nghị tháng trước khác tháng này" mà không phải đoán.
 *
 * Ngày viết dạng `YYYY-MM-DD`, giờ giấc không thêm thông tin gì cho dữ liệu
 * mỗi lần đổi cách nhau hàng tuần. `verifiedAt` cũng vậy, khớp với quy ước
 * `verifiedOn` sẵn có trong `award-charts.ts`.
 */
export interface Temporal {
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * Nguồn của một dữ kiện (spec §24).
 *
 * `verified`  — đọc thẳng từ trang chính chủ của nhà phát hành.
 * `estimated` — dựng lại từ nguồn thứ cấp đồng thuận, hoặc là một khoảng.
 * `editorial` — đánh giá của Ghế 1A, không phải dữ kiện kiểm chứng được.
 * `stale`     — từng kiểm, nay quá hạn, còn dùng tạm nhưng phải cảnh báo.
 */
export type Confidence = "verified" | "estimated" | "editorial" | "stale";

export interface Sourced {
  sourceUrl: string | null;
  verifiedAt: string;
  confidence: Confidence;
}

/* ------------------------------------------------------------------ *
 * §3.2 issuers
 * ------------------------------------------------------------------ */

export interface Issuer {
  id: IssuerId;
  /** Đúng như site viết, KÈM ®/™ — quy ước bắt buộc của repo, và
   *  `audit:trademarks` sẽ bắt nếu thiếu. */
  name: string;
  country: "CA" | "US";
  officialUrl: string;
}

/* ------------------------------------------------------------------ *
 * §3.3 points_programs
 * ------------------------------------------------------------------ */

/**
 * `transferable` = điểm này chuyển ĐI được sang chương trình khác (Amex MR,
 * Avion). Nó KHÔNG có nghĩa "chuyển tới được" — Aeroplan nhận điểm từ MR
 * nhưng bản thân Aeroplan không chuyển đi đâu, nên `transferable: false`.
 *
 * Phân biệt này là nền của luật cấm đếm trùng ở spec §7: chỉ đồng tiền
 * `transferable` mới sinh ra "số dư tiếp cận được", và mỗi điểm chỉ tiêu được
 * MỘT lần dù nó với tới năm chương trình.
 */
export type PointsProgramType =
  | "flexible_bank" // Amex MR, RBC Avion — chuyển đi nhiều nơi
  | "airline"
  | "hotel"
  | "fixed_value" // TD Rewards, CIBC Aventura — quy ra tiền vé theo bảng cố định
  | "cash_back";

export interface PointsProgram {
  id: PointsProgramId;
  slug: string;
  name: string;
  programType: PointsProgramType;
  transferable: boolean;
  /**
   * Định giá tương đối (cent CAD mỗi điểm) để so các phương án với nhau.
   *
   * KHÔNG được đem ra trước mặt người đọc như một sự thật về CPP — spec §3.3
   * nói thẳng, và trang calculator của site đã có bộ định giá riêng cho việc
   * đó (`points-programs.ts`). Con số ở đây chỉ để engine xếp hạng nội bộ.
   */
  defaultCurrencyValue: number | null;
  /** Nối sang `POINTS_PROGRAMS` trong `lib/points-programs.ts` (calculator) và
   *  `PROGRAM_RULES` trong `lib/card-points-programs.ts` (chip lọc). Ba danh
   *  sách này KHÔNG dùng chung id — xem chú thích đầu `points-programs.ts` —
   *  nên chỗ nối phải khai báo tường minh chứ không được đoán. `null` là câu
   *  trả lời hợp lệ. */
  calculatorProgramId: string | null;
  cardFilterProgramId: string | null;
  /** Nối sang `PROGRAMS` trong `lib/award-charts.ts`. Chỉ chương trình hàng
   *  không có bảng giá mới có. */
  awardChartProgramId: string | null;
}

/* ------------------------------------------------------------------ *
 * §3.4 transfer_paths
 * ------------------------------------------------------------------ */

/**
 * Một chặng chuyển điểm, MỘT bước. V1 cố ý không tối ưu nhiều chặng (spec
 * §3.4) — thực tế cũng gần như không có chặng thứ hai nào đáng đi ở Canada.
 */
export interface TransferPath extends Temporal, Sourced {
  id: TransferPathId;
  sourceProgramId: PointsProgramId;
  destinationProgramId: PointsProgramId;
  /** Tỷ lệ viết thành hai số nguyên (1000 : 750) thay vì một số thập phân.
   *  Nhà phát hành công bố kiểu đó, và 0.75 làm mất thông tin về đơn vị
   *  chuyển tối thiểu. */
  ratioFrom: number;
  ratioTo: number;
  /** Điều kiện kèm theo, đúng như nhà phát hành nêu ("Chỉ Avion® Elite").
   *  Phase 3 chưa suy luận trên chuỗi này; nó có mặt để lời giải thích không
   *  hứa một chặng chuyển mà người đọc không mở được. */
  conditionText: string | null;
}

/* ------------------------------------------------------------------ *
 * §3.1 products
 * ------------------------------------------------------------------ */

export type ProductType = "credit_card" | "bank_account" | "brokerage" | "bill_payment" | "other";
export type CardNetwork = "amex" | "visa" | "mastercard" | "other";
export type PersonalOrBusiness = "personal" | "business" | "student";

export interface Product extends Temporal {
  id: ProductId;
  /** BẰNG ĐÚNG slug của entry `creditCardOffer` trên Contentful khi
   *  `contentfulLinked` là true. `audit:reco-data` bắt lệch cả hai chiều. */
  slug: string;
  name: string;
  issuerId: IssuerId;
  country: "CA" | "US";
  productType: ProductType;
  network: CardNetwork;
  personalOrBusiness: PersonalOrBusiness;
  /** Đồng tiền thưởng CHÍNH của thẻ. `null` cho thẻ cashback thuần không
   *  thuộc chương trình điểm nào. */
  pointsProgramId: PointsProgramId | null;
  /** Phí thường niên năm thường, dạng SỐ, CAD. Miễn phí năm đầu là thuộc tính
   *  của OFFER chứ không phải của sản phẩm — xem `Offer.annualFeeFirstYear`. */
  annualFee: number;
  currency: "CAD" | "USD";
  isActive: boolean;
  /**
   * §16 Rule 7: trường này KHÔNG BAO GIỜ được vào công thức xếp hạng. Nó chỉ
   * quyết định có hiện nút affiliate hay không. Phase 3 có test riêng khoá
   * luật này (Test F).
   *
   * KHÔNG viết tay trong file seed — xem `ProductSeed` bên dưới. Nó được TÍNH
   * bằng `isReferralUrl(applyUrl)` của `lib/affiliate-links.ts`, đúng cái hàm
   * quyết định link có mang `rel="sponsored"` hay không. Chép tay giá trị này
   * là mở ra khả năng site nói "có hoa hồng" ở chỗ này và "không" ở chỗ kia
   * về cùng một link; tệ hơn, nó biến một luật kiểm chứng được thành một lời
   * khai.
   */
  affiliateAvailable: boolean;
  /** Không lưu URL affiliate ở đây: `applyUrl` trên Contentful đã là link
   *  affiliate khi có, và một URL nằm hai chỗ là một URL sẽ lệch.
   *
   *  `null` khi CHƯA kiểm được trang chính chủ của đúng thẻ này. Để trống
   *  thật thà hơn là đắp URL trang danh sách thẻ của ngân hàng vào rồi lời
   *  giải thích dẫn người đọc tới một trang không nói gì về thẻ đang bàn. */
  officialUrl: string | null;
  /** false = sản phẩm engine biết nhưng site chưa có trang. Cho phép engine
   *  nói "chưa tới lúc mở thẻ" mà vẫn hiểu bối cảnh thị trường. */
  contentfulLinked: boolean;
}

/**
 * Sản phẩm ĐÚNG NHƯ NÓ NẰM TRONG FILE SEED.
 *
 * `affiliateAvailable` cố tình vắng: nó là dữ liệu dẫn xuất, do `source.ts`
 * tính từ `applyUrl` trên Contentful. Vắng ở kiểu dữ liệu nghĩa là không ai
 * điền tay được, kể cả nhầm.
 */
export type ProductSeed = Omit<Product, "affiliateAvailable">;

/* ------------------------------------------------------------------ *
 * §3.5 offers  +  §3.6 offer_components
 * ------------------------------------------------------------------ */

export interface Offer extends Temporal, Sourced {
  id: OfferId;
  productId: ProductId;
  name: string;
  startDate: string;
  endDate: string | null;
  /** Đồng tiền của welcome bonus. `null` khi thưởng bằng tiền mặt. */
  bonusCurrencyId: PointsProgramId | null;
  /**
   * Con số quảng cáo, y như nhà phát hành rao. CỐ Ý tách khỏi tổng của
   * `offer_components`: chênh lệch giữa hai số chính là thứ spec §11 đòi engine
   * phải nhìn thấy. 160,000 điểm rao ngoài mà 140,000 nằm sau mốc chi $7,500
   * trong 180 ngày là hai câu chuyện khác nhau với người chỉ chi được $2,000.
   */
  headlineBonus: number | null;
  /**
   * Tổng mức chi bắt buộc để lấy HẾT bonus, và cửa sổ thời gian dài nhất.
   *
   * KHÔNG viết tay: cả hai được cộng ra từ `offer_components` (xem
   * `totalSpendOf`). Viết tay là có hai con số cho cùng một sự thật, và repo
   * này đã trả giá đúng một lần cho kiểu đó.
   */
  minimumSpend: number | null;
  minimumSpendMonths: number | null;
  /**
   * Mức chi phải đạt trong GIAI ĐOẠN ĐẦU, tức trước mốc kỷ niệm.
   *
   * Đây mới là con số §13 đem so với `minimum_spend_capacity_3m` của người
   * dùng. `minimumSpend` gộp cả phần chi ở tháng thứ 13 — dùng nhầm nó để lọc
   * sẽ loại thẻ Amex® Aeroplan®* Reserve khỏi tay người thừa sức lấy $7,500
   * đầu tiên, chỉ vì họ chưa hứa gì về năm sau.
   */
  initialSpend: number | null;
  annualFeeFirstYear: number | null;
  /** Rebate của bên thứ ba (FinlyWealth). Nối với `rebateVi` trên Contentful;
   *  `audit:reco-data` bắt lệch, cùng lý do `audit:rebate-prose` tồn tại. */
  annualFeeRebate: number | null;
  isTargeted: boolean;
  isPublic: boolean;
  isActive: boolean;
}

/**
 * Thành phần của welcome offer (spec §3.6).
 *
 * `spendWindowDays` tính TỪ NGÀY MỞ THẺ, không phải từ khi thành phần trước
 * hoàn tất. Nhà phát hành viết điều khoản kiểu đó, và cách hiểu kia làm mốc
 * "kỷ niệm 1 năm" trượt đi vài tháng.
 */
export type OfferComponentType =
  | "first_purchase"
  | "spend_threshold"
  | "monthly_spend" // Amex Cobalt/Gold: mỗi chu kỳ sao kê đạt mốc lại được một phần
  | "anniversary"
  | "statement_credit"
  | "fee_waiver";

export interface OfferComponent {
  id: OfferComponentId;
  offerId: OfferId;
  /** Thứ tự theo TRÌNH TỰ NGƯỜI DÙNG GẶP, không theo giá trị. */
  sequence: number;
  componentType: OfferComponentType;
  pointsAmount: number | null;
  cashAmount: number | null;
  spendRequirement: number | null;
  spendWindowDays: number | null;
  /**
   * Bao nhiêu lần thành phần này lặp lại. Chỉ có nghĩa với `monthly_spend`:
   * Cobalt là 1,250 điểm × 12 chu kỳ. Không có trường này thì hoặc phải đẻ 12
   * dòng giống hệt nhau, hoặc phải gộp thành một con số 15,000 và mất luôn
   * điều kiện thật ($750 MỖI THÁNG, không phải $9,000 một lần).
   */
  repeatCount: number | null;
  conditionText: string | null;
}

/* ------------------------------------------------------------------ *
 * §3.7 earning_rates
 * ------------------------------------------------------------------ */

/**
 * Hạng mục chi tiêu. Danh sách cố định, không phải bảng — nó là từ vựng chung
 * giữa dữ liệu sản phẩm và hồ sơ chi tiêu người dùng (§4.2), và một hạng mục
 * chỉ có mặt ở một bên là một hạng mục vô dụng.
 */
export const SPEND_CATEGORIES = [
  "grocery",
  "dining",
  "food_delivery",
  "gas",
  "ev_charging",
  "travel",
  // Vé mua THẲNG từ hãng gắn với chương trình điểm của thẻ: Air Canada® trên
  // thẻ Aeroplan®, Porter trên VIPorter®, WestJet® trên thẻ WestJet®. Spec
  // §3.7 nêu ví dụ `air_canada`, nhưng đặt tên theo một hãng thì bốn thẻ khác
  // trong chính danh sách này không có chỗ nào để đặt tỷ lệ cao nhất của
  // chúng — mà đó thường là lý do người ta mở thẻ.
  "airline_direct",
  "hotel",
  "car_rental",
  "drugstore",
  "recurring",
  "streaming",
  "transit",
  "rideshare",
  "entertainment",
  "foreign_currency",
  "everything_else",
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export interface EarningRate extends Temporal, Sourced {
  id: EarningRateId;
  productId: ProductId;
  category: SpendCategory;
  /** Điểm trên mỗi $1. Số thập phân là chuyện thường (1.25, 1.5), và thẻ
   *  cashback dùng cùng trường này với phần trăm đọc thành số: 4% = 4. */
  multiplier: number;
  pointsProgramId: PointsProgramId;
  /** Trần tính theo ĐƠN VỊ NÀO: `spend` = trần trên số tiền chi, `points` =
   *  trần trên số điểm nhận. Nhà phát hành công bố cả hai kiểu, và đoán nhầm
   *  kiểu làm sai giá trị thẻ hàng nghìn điểm. */
  capKind: "spend" | "points" | null;
  capAmount: number | null;
  capPeriod: "monthly" | "quarterly" | "annual" | null;
  /** Tỷ lệ áp dụng khi đã đụng trần. Gần như luôn là tỷ lệ
   *  `everything_else`, nhưng không phải luôn luôn, nên viết ra. */
  rateAfterCap: number | null;
  /**
   * Tỷ lệ này chỉ áp cho một nhóm merchant hẹp, mô tả bằng chữ.
   *
   * Scotiabank® Passport® trả 3x ở Sobeys, Safeway, IGA, Foodland, Co-op và
   * 2x ở mọi siêu thị khác — HAI dòng cho cùng một `category`. Không có
   * trường này thì hai dòng đó không phân biệt được, và engine hoặc phải
   * đoán, hoặc lấy 3x cho toàn bộ chi tiêu siêu thị của một người có thể chưa
   * bao giờ bước vào Sobeys.
   *
   * LUẬT: mỗi cặp (sản phẩm, hạng mục) phải có ĐÚNG MỘT dòng
   * `restrictedTo: null` — đó là dòng engine dùng mặc định. Các dòng có
   * `restrictedTo` chỉ được dùng khi Phase 3 có cách hỏi người dùng họ mua ở
   * đâu. `validate.ts` cưỡng chế luật này; thiếu nó thì cùng một hạng mục có
   * hai tỷ lệ và không ai biết engine chọn cái nào.
   */
  restrictedTo: string | null;
}

/* ------------------------------------------------------------------ *
 * §3.8 benefits  +  §3.9 product_benefits
 * ------------------------------------------------------------------ */

export type BenefitCategory =
  | "airport"
  | "airline"
  | "hotel"
  | "insurance"
  | "credit"
  | "fee"
  | "status";

export interface Benefit {
  id: BenefitId;
  slug: string;
  name: string;
  category: BenefitCategory;
  /**
   * Quyền lợi này có bị TRÙNG khi giữ hai thẻ cùng có nó không (spec §16 Rule
   * 6). Miễn hành lý ký gửi: có — thẻ thứ hai gần như vô giá trị. Travel
   * credit $100: không — hai thẻ là $200 thật.
   *
   * Đây là lý do quyền lợi phải có cấu trúc chứ không thể là một dòng chữ:
   * chỉ nhìn chữ thì không cách nào biết cái nào cộng dồn được.
   */
  duplicatesAcrossCards: boolean;
}

export interface ProductBenefit extends Temporal, Sourced {
  id: ProductBenefitId;
  productId: ProductId;
  benefitId: BenefitId;
  /** Giá trị đo được: số lượt lounge, số tiền credit, số người đi cùng được
   *  miễn hành lý. `null` khi quyền lợi không có mặt số nào. */
  numericValue: number | null;
  textValue: string | null;
  /** Điều kiện có cấu trúc, đủ để engine đọc. Đang dùng:
   *  `{ minimumAnnualSpend: number }` — quyền lợi chỉ mở sau mức chi đó
   *  (Companion Pass sau $25,000). Người không chi tới đó thì quyền lợi này
   *  đáng 0, và trước khi có trường này thì không cách nào nói điều đó. */
  conditions: { minimumAnnualSpend?: number } | null;
}

/* ------------------------------------------------------------------ *
 * §3.10 eligibility_rules
 * ------------------------------------------------------------------ */

/**
 * §3.10 nói rõ: điểm tín dụng KHÔNG được là điều kiện cứng. Nên `rule_type`
 * cố ý không có `credit_score` — không phải quên, mà là chặn ngay từ kiểu dữ
 * liệu, để không ai vô tình thêm nó vào rồi engine bắt đầu từ chối người dùng
 * dựa trên một con số nó không có và không đoán được.
 *
 * `severity`:
 *   `hard`    — nhà phát hành công bố, không đạt là gần như chắc bị từ chối.
 *   `soft`    — có thật nhưng co giãn, chỉ trừ điểm.
 *   `unknown` — có nghe nói, chưa xác nhận được; KHÔNG được dùng để loại.
 */
export type EligibilityRuleType =
  | "minimum_personal_income"
  | "minimum_household_income"
  | "residency"
  | "existing_cardholder_excluded" // đang giữ thẻ này thì không có welcome bonus
  | "previous_cardholder_excluded" // từng giữ — Amex "once in a lifetime"
  | "business_required"
  | "student_status_required"
  | "banking_relationship_required";

export interface EligibilityRule extends Temporal, Sourced {
  id: EligibilityRuleId;
  productId: ProductId;
  ruleType: EligibilityRuleType;
  operator: "gte" | "lte" | "eq" | "in" | "not_in";
  value: number | string | string[] | boolean;
  severity: "hard" | "soft" | "unknown";
  /**
   * Luật này chặn CÁI GÌ.
   *
   * `application`   — không đủ thì ngân hàng từ chối đơn. Loại thẻ khỏi danh sách.
   * `welcome_offer` — vẫn mở được thẻ, chỉ KHÔNG nhận welcome bonus.
   *
   * Phân biệt này quyết định: luật "từng giữ thẻ Amex® này rồi" là
   * `welcome_offer`. Coi nó là `application` thì engine vứt bỏ cả thẻ, kể cả
   * khi giá trị dài hạn của nó (5x ăn uống trên Cobalt) vẫn là câu trả lời
   * đúng cho người đang hỏi. Người chơi điểm vài năm đã giữ qua hầu hết thẻ
   * Amex®, nên nhầm chỗ này là im lặng gạch gần hết danh mục của họ.
   */
  scope: "application" | "welcome_offer";
  /**
   * Các luật CÙNG nhóm được nối bằng HOẶC, không phải VÀ.
   *
   * Ngân hàng Canada công bố điều kiện thu nhập theo cặp: "$60,000 cá nhân
   * HOẶC $100,000 hộ gia đình". Hai dòng `hard` riêng lẻ nghĩa là VÀ, tức
   * engine đòi người dùng đạt cả hai — loại oan đúng những người mà vế hộ gia
   * đình sinh ra để phục vụ.
   *
   * `null` = luật đứng một mình, phải đạt.
   */
  ruleGroup: string | null;
}

/* ------------------------------------------------------------------ *
 * §6 award_strategies
 * ------------------------------------------------------------------ */

/** Vùng của spec §33. Đủ thô để một chuyến bay thật rơi vào đúng một vùng. */
export const TRIP_REGIONS = [
  "CANADA_US",
  "EUROPE",
  "JAPAN",
  "EAST_ASIA",
  "SEA_VIETNAM",
] as const;
export type TripRegion = (typeof TRIP_REGIONS)[number];

export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export type AwardCabin = (typeof CABINS)[number];

/**
 * Một CÁCH đi, kèm khoảng giá — không phải một mức giá (spec §6).
 *
 * "YYZ → Tokyo business = 75,000 Aeroplan" là con số bịa: Aeroplan tính theo
 * tổng quãng đường thật của các chặng bay, nên cùng một đôi thành phố ra giá
 * khác nhau tuỳ đường nối. Ba số low/typical/high nói đúng thứ engine biết,
 * và `NO_NEW_CARD` thắng hay thua phụ thuộc vào việc so số dư với KHOẢNG này
 * chứ không phải với một con số giả vờ chính xác.
 */
export interface AwardStrategy extends Temporal, Sourced {
  id: AwardStrategyId;
  originRegion: TripRegion;
  destinationRegion: TripRegion;
  cabin: AwardCabin;
  programId: PointsProgramId;
  strategyName: string;
  /**
   * Chương trình bán chặng này theo bảng cố định hay theo giá động.
   *
   * `fixed`         — có bảng giá, số nào ra số đó. `pointsTypical` và
   *                   `pointsHigh` có nghĩa.
   * `dynamic_floor` — chương trình chỉ công bố MỨC SÀN, giá thật thay đổi
   *                   theo chuyến. Chỉ `pointsLow` có nghĩa; hai số kia BẮT
   *                   BUỘC `null` (`validate.ts` cưỡng chế).
   *
   * Không có trường này thì mức sàn "từ 85,000" nằm cạnh một mức cố định
   * 102,500 trông y hệt nhau, và lời giải thích sẽ hứa với người đọc một cái
   * giá mà chương trình chưa bao giờ cam kết.
   */
  pricingModel: "fixed" | "dynamic_floor";
  /** Một chiều, một người. Nhân lên ở engine, không nhân sẵn ở dữ liệu. */
  pointsLow: number | null;
  pointsTypical: number | null;
  pointsHigh: number | null;
  cashSurchargeLevel: "low" | "medium" | "high" | null;
  availabilityDifficulty: "easy" | "medium" | "hard" | null;
  bookingComplexity: "simple" | "moderate" | "complex" | null;
  /** Ghi chú biên tập cho lời giải thích. Là CHUỖI CỐ ĐỊNH của dữ liệu, không
   *  phải chỗ LLM tự viết vào. */
  note: string | null;
}

/* ------------------------------------------------------------------ *
 * Bộ dữ liệu
 * ------------------------------------------------------------------ */

export interface RecommendationDataset {
  issuers: Issuer[];
  pointsPrograms: PointsProgram[];
  transferPaths: TransferPath[];
  products: Product[];
  offers: Offer[];
  offerComponents: OfferComponent[];
  earningRates: EarningRate[];
  benefits: Benefit[];
  productBenefits: ProductBenefit[];
  eligibilityRules: EligibilityRule[];
  awardStrategies: AwardStrategy[];
}
