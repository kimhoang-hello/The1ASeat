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

/**
 * LUẬT VỀ ID — đọc trước khi đặt bất kỳ id nào.
 *
 * 1. Id là KHOÁ THAY THẾ, bất biến, và KHÔNG BAO GIỜ được suy ra từ một thứ có
 *    thể đổi. Cụ thể: id KHÔNG phải slug. Slug là khoá tự nhiên nối sang
 *    Contentful, và nhà phát hành đổi tên thẻ thì slug đổi theo. Nếu id chính
 *    là slug thì một lần đổi tên sẽ đổi luôn khoá chính, kéo theo mọi khoá
 *    ngoại — offer, tỷ lệ tích điểm, quyền lợi, điều kiện — và mọi
 *    `recommendation_runs` cũ của Phase 4 trỏ vào một sản phẩm không còn tồn
 *    tại. Spec §3.1 tách `id uuid` khỏi `slug text UNIQUE` đúng vì lý do này.
 *
 * 2. Id của bản ghi CÓ HIỆU LỰC THEO THỜI GIAN phải mang `effectiveFrom`. Hợp
 *    đồng chỉ-thêm nghĩa là bản thứ hai của cùng một sự thật sẽ nằm cạnh bản
 *    thứ nhất; không có ngày trong id thì hai bản trùng id, và hoặc validator
 *    đỏ, hoặc người sửa lặng lẽ đè lên bản cũ rồi mất lịch sử.
 *
 * 3. KHÔNG đánh số theo vị trí trong mảng. `${slug}-${index + 1}` đổi id của
 *    mọi dòng phía sau khi ai đó chèn một dòng vào giữa — im lặng, và mọi
 *    tham chiếu lịch sử tới chúng trỏ sai chỗ.
 *
 * Dùng `makeId` bên dưới thay vì tự nối chuỗi.
 */

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
export type ProductFeeId = Branded<"ProductFeeId">;
export type EarningCapId = Branded<"EarningCapId">;
export type ProgramValuationId = Branded<"ProgramValuationId">;
export type ProductFamilyId = Branded<"ProductFamilyId">;
export type ProductAvailabilityId = Branded<"ProductAvailabilityId">;

/** Ép một chuỗi viết tay trong file seed thành id có brand. Chỉ dùng trong
 *  `data/`; không có kiểm tra nào ở đây, `validate.ts` mới là chỗ kiểm. */
export function id<T extends Branded<string>>(value: string): T {
  return value as T;
}

/**
 * Dựng id cho một bản ghi có hiệu lực theo thời gian.
 *
 * `makeId("er", productId, "grocery", "2026-09-07")` → `"er_amex-cobalt_grocery_2026-09-07"`.
 *
 * Tiền tố loại làm id tự nói nó là gì khi hiện trong log hay trong bảng debug
 * của Phase 4 — `"amex-cobalt-grocery-1"` không nói được nó là tỷ lệ tích điểm
 * hay quyền lợi. Dấu `_` ngăn các thành phần vì mọi thành phần đều có thể chứa
 * `-` (slug, hạng mục, và cả ngày).
 */
export function makeId<T extends Branded<string>>(
  prefix: string,
  ...parts: (string | number)[]
): T {
  return `${prefix}_${parts.join("_")}` as T;
}

/**
 * Rút một chuỗi tự do thành mảnh id ổn định.
 *
 * Dùng cho `EarningRate.restrictedTo`: hai dòng cùng (sản phẩm, hạng mục) chỉ
 * phân biệt được bằng nhóm merchant, nên nhóm đó phải vào id. Cắt ngắn để id
 * còn đọc được; `validate.ts` bắt nếu hai chuỗi khác nhau rút về cùng một
 * mảnh.
 */
export function idPart(text: string | null): string {
  if (text === null) return "base";
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "x"
  );
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

/**
 * Nguồn thuộc LOẠI nào — tách khỏi `confidence`, vì hai câu hỏi khác nhau.
 *
 * `issuer`      — trang chính chủ của nhà phát hành hoặc chương trình.
 * `ghe1a`       — nội dung Ghế 1A đã kiểm và đang xuất bản.
 * `third_party` — nguồn thứ cấp (blog điểm thưởng, tổng hợp cộng đồng).
 *
 * Cần có, vì phần lớn bản ghi trong bộ này ghi `confidence: "verified"` trong
 * khi `sourceUrl` trỏ về ghe1a.com — tức trỏ về CHÍNH MÌNH. Nội dung đó thật
 * sự đã đối chiếu với điều khoản nhà phát hành, nên "verified" không sai;
 * nhưng một hệ thống chỉ lưu URL thì không phân biệt nổi "đọc thẳng từ nhà
 * phát hành" với "đọc từ trang của chúng ta". Ghi ra để lần kiểm sau biết phải
 * mở cái gì.
 */
export type SourceKind = "issuer" | "ghe1a" | "third_party";

export interface Sourced {
  sourceUrl: string | null;
  sourceKind: SourceKind;
  verifiedAt: string;
  confidence: Confidence;
  /**
   * Ngày bản ghi này được ĐƯA VÀO kho — khác `effectiveFrom`, là ngày sự thật
   * nó mô tả bắt đầu đúng.
   *
   * Hai trục thời gian, và chúng tách ra đúng lúc quan trọng nhất: một đính
   * chính LÙI NGÀY nhập hôm nay có `effectiveFrom` sáu tháng trước nhưng
   * `recordedAt` là hôm nay. `datasetAt` một mình không phân biệt được nó với
   * dữ liệu đã có sẵn từ sáu tháng trước — nên Phase 4 sẽ "giải thích" một
   * khuyến nghị cũ bằng một dữ kiện mà lúc ấy engine chưa hề biết.
   *
   * Có trường này thì Phase 4 lọc thêm `recordedAt <= ngày chạy` và nói đúng
   * thứ engine đã thấy. Không có nó, thêm về sau nghĩa là mọi bản ghi lịch sử
   * đều thiếu giá trị và không dựng lại được.
   */
  recordedAt: string;
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
   * KHÔNG có định giá ở đây — xem `program_valuations`.
   *
   * Định giá điểm là con số MỌI hàm chấm điểm nhân vào, và nó ĐỔI: mỗi lần một
   * chương trình devalue là một lần mọi thứ hạng đổi theo. Để nó là một trường
   * trần trên chương trình thì sửa nó là ghi đè lịch sử — và một khuyến nghị
   * sáu tháng trước sẽ được "giải thích" bằng định giá hôm nay, tức bằng một
   * con số chưa tồn tại lúc nó được đưa ra.
   *
   * Cùng lý do phí thường niên phải ra khỏi `Product`. Khác ở chỗ định giá ảnh
   * hưởng tới ĐIỂM SỐ CỦA MỌI SẢN PHẨM, không chỉ một.
   */
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
  /**
   * Mẫu nhận diện đồng tiền này trong nội dung tiếng Việt của thẻ.
   *
   * Ở ĐÂY vì đây là danh sách chương trình CHUẨN. Trước đó nó nằm riêng trong
   * `lib/card-points-programs.ts`, nên thêm một chương trình mới phải sửa HAI
   * chỗ — và chỗ thứ hai là code ứng dụng, tức lời hứa "thêm thẻ chỉ là thêm
   * dữ liệu" chỉ đúng khi chương trình đã tồn tại. Quên nó thì thẻ mới im lặng
   * mất chip lọc trên `/credit-cards`.
   *
   * `null` khi đồng tiền không xuất hiện trên trang thẻ (Avios®, Flying Blue®
   * chỉ là đích chuyển điểm).
   *
   * THỨ TỰ trong `POINTS_PROGRAMS` là thứ tự khớp: "à la carte" phải đứng
   * trước "cash back" vì quyền lợi của National Bank® nhắc tới travel credit
   * bằng đô la.
   */
  contentPattern: RegExp | null;
}

/**
 * Định giá một đồng điểm, có hiệu lực theo thời gian.
 *
 * `centsPerPoint` là định giá TƯƠNG ĐỐI, chỉ để engine so phương án này với
 * phương án kia. KHÔNG được đem ra trước mặt người đọc như một sự thật về CPP
 * (spec §3.3); trang calculator của site đã có bộ định giá riêng cho việc đó
 * trong `lib/points-programs.ts`, và `audit:reco-data` giữ hai bên khớp nhau.
 */
export interface ProgramValuation extends Temporal, Sourced {
  id: ProgramValuationId;
  programId: PointsProgramId;
  centsPerPoint: number;
}

/**
 * Một HỌ sản phẩm: các hạng của cùng một thẻ.
 *
 * Ba thẻ CIBC® Aeroplan® (Visa / Visa Infinite / Visa Infinite Privilege) là
 * BA HẠNG của một thẻ, không phải ba lựa chọn độc lập. Không có thực thể này
 * thì Phase 3 chỉ còn cách đoán bằng slug — `slug.startsWith("cibc-aeroplan")`
 * — tức hard-code tên sản phẩm vào logic, đúng thứ lớp dữ liệu này sinh ra để
 * khỏi phải làm. Và đoán bằng slug thì sai cả hai chiều: `amex-aeroplan` và
 * `amex-aeroplan-reserve` cùng tiền tố nhưng khác họ với `cibc-aeroplan-visa`,
 * còn RBC® Avion® Visa Infinite và Visa Platinum thì cùng họ mà slug không
 * chung tiền tố nào đủ đặc trưng.
 *
 * Engine cần nó cho ít nhất ba việc: không khuyên hai hạng của cùng một thẻ
 * cùng lúc; nói được "bạn đang giữ hạng Infinite, cái này là nâng hạng chứ
 * không phải thẻ thứ hai"; và khi người dùng không đủ điều kiện hạng cao thì
 * đề xuất hạng thấp hơn TRONG CÙNG HỌ thay vì bỏ qua.
 */
export interface ProductFamily {
  id: ProductFamilyId;
  name: string;
  issuerId: IssuerId;
  /** Đồng tiền chung của cả họ. `null` khi các hạng kiếm khác nhau. */
  pointsProgramId: PointsProgramId | null;
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
  /**
   * Hạng thẻ/tài khoản tối thiểu để mở được chặng này, dạng máy đọc được.
   *
   * `null` = ai giữ đồng điểm nguồn cũng chuyển được. Có giá trị thì Phase 3
   * phải kiểm người dùng có đúng hạng đó không TRƯỚC khi cộng chặng này vào
   * "số dư tiếp cận được" — RBC® chỉ mở Avios®/Asia Miles®/AAdvantage® cho
   * Avion® Elite, nên hứa chúng cho người giữ Avion® thường là hứa một chuyến
   * bay họ không đặt được.
   *
   * Tách khỏi `conditionText` vì điều kiện nằm trong chuỗi tiếng Việt thì
   * engine không đọc nổi — đúng thứ spec §3.10 gọi là "eligibility without
   * free-text parsing", áp cho chặng chuyển điểm.
   */
  requiresTier: string | null;
  /** Nguyên văn điều kiện cho lời giải thích. KHÔNG dùng để suy luận. */
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
  /**
   * Những slug thẻ này TỪNG mang, cũ nhất trước.
   *
   * Nhật ký lịch sử offer (`data/offer-history.json`) do một job khác ghi và
   * đánh khoá bằng slug Contentful ĐANG DÙNG. Đổi tên thẻ thì các dòng mới nằm
   * dưới slug mới còn dòng cũ ở lại dưới slug cũ — tra bằng một slug là mất
   * hẳn một nửa lịch sử, và mất đúng nửa cũ, tức nửa duy nhất trả lời được
   * "mức này cao hay thường".
   */
  previousSlugs: string[];
  /** Họ sản phẩm, khi thẻ này là một hạng của một họ. `null` = thẻ đứng một
   *  mình. Xem `ProductFamily`. */
  familyId: ProductFamilyId | null;
  /**
   * Thứ hạng TRONG HỌ, 1 là thấp nhất. `null` khi không thuộc họ nào.
   *
   * Số chứ không phải tên hạng ("Infinite", "Privilege"): tên hạng là chuỗi
   * marketing khác nhau giữa các ngân hàng, còn engine chỉ cần biết cái nào
   * trên cái nào.
   */
  tierRank: number | null;
  /**
   * KHÔNG có `annualFee` ở đây — nó nằm trong `product_fees`.
   *
   * Phí thường niên ĐỔI, và đổi độc lập với mọi thứ khác của thẻ. Để nó là
   * một trường trên `Product` thì cách duy nhất giữ lịch sử là đóng cả dòng
   * sản phẩm rồi mở dòng mới — nhưng dòng mới phải mang id mới, và mọi khoá
   * ngoại trỏ vào sản phẩm (offer, tỷ lệ tích điểm, quyền lợi, điều kiện) gãy
   * cùng lúc. Nói cách khác: với thiết kế cũ, KHÔNG THỂ ghi lại một lần đổi
   * phí mà không phá lịch sử. Đó là đúng thứ Phase 1 sinh ra để không xảy ra.
   *
   * Tách ra bảng riêng có hiệu lực theo thời gian là cách chuẩn: cùng khuôn
   * với `earning_rates` và `product_benefits`, vốn đã đúng ngay từ đầu.
   */
  /**
   * KHÔNG có cửa sổ khả dụng ở đây — xem `product_availability`.
   *
   * Thẻ NGỪNG RỒI MỞ LẠI là chuyện có thật (nhà phát hành rút thẻ rồi đưa lại
   * sau một mùa). Một cặp `availableFrom/To` duy nhất trên `Product` chỉ kể
   * được MỘT khoảng: mở lại buộc phải xoá `availableTo`, tức xoá luôn dấu vết
   * quãng thẻ từng đóng — và thêm một dòng `Product` thứ hai thì đụng khoá
   * chính. Nói cách khác, với thiết kế cũ KHÔNG THỂ ghi lại một lần mở lại mà
   * không phá lịch sử. Cùng đúng một lớp lỗi với phí thường niên.
   */
  /**
   * Sản phẩm THAY THẾ sản phẩm này, khi nhà phát hành khai tử một thẻ và đưa
   * ra thẻ kế nhiệm.
   *
   * `null` là trường hợp thường: thẻ chỉ ngừng, không ai thay. Có giá trị thì
   * Phase 3 nói được "thẻ bạn đang giữ đã ngừng, bản kế nhiệm là X" thay vì im
   * lặng bỏ qua — và Phase 4 lần được chuỗi kế nhiệm khi giải thích một khuyến
   * nghị cũ.
   *
   * KHÁC với đổi tên: đổi tên là CÙNG một sản phẩm mang tên khác, nên `id` giữ
   * nguyên và chỉ `slug`/`name` đổi. Chỗ này là HAI sản phẩm.
   */
  supersededByProductId: ProductId | null;
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
  /**
   * Contentful CÓ đang giữ một entry cho thẻ này không.
   *
   * `false` có hai nghĩa, và cả hai đều hợp lệ:
   *   - Sản phẩm engine biết nhưng site chưa có trang. Engine vẫn hiểu bối
   *     cảnh thị trường mà không hứa một đường link không tồn tại.
   *   - Thẻ ĐÃ NGỪNG. Entry gỡ khỏi Contentful, nhưng bản ghi ở đây PHẢI Ở
   *     LẠI — xem `isActive`.
   */
  contentfulLinked: boolean;
}

/**
 * Sản phẩm ngừng bán thì ĐÓNG, KHÔNG XOÁ.
 *
 * Đặt `isActive: false`, đặt `effectiveTo` bằng ngày cuối còn mở được, và đặt
 * `contentfulLinked: false` nếu entry đã gỡ. Dòng sản phẩm ở lại vĩnh viễn.
 *
 * Vì sao không xoá: offer, tỷ lệ tích điểm, quyền lợi và điều kiện của nó đều
 * trỏ vào `productId`. Xoá dòng là để lại một rừng tham chiếu mồ côi, và
 * `recommendation_runs` của Phase 4 — thứ sinh ra để trả lời "vì sao khuyến
 * nghị tháng trước khác tháng này" — sẽ trỏ vào một sản phẩm không còn ai giải
 * thích được. Câu trả lời "thẻ đó đã ngừng" chỉ nói được nếu bản ghi còn đó.
 *
 * `validate.ts` cưỡng chế cả hai chiều: tham chiếu mồ côi là lỗi, và một sản
 * phẩm `isActive: false` mà không có `effectiveTo` cũng là lỗi — nó nói "ngừng
 * rồi" mà không nói ngừng từ bao giờ, nên không truy vấn theo thời điểm nào
 * đọc được nó.
 */

/**
 * Sản phẩm ĐÚNG NHƯ NÓ NẰM TRONG FILE SEED.
 *
 * `affiliateAvailable` cố tình vắng: nó là dữ liệu dẫn xuất, do `source.ts`
 * tính từ `applyUrl` trên Contentful. Vắng ở kiểu dữ liệu nghĩa là không ai
 * điền tay được, kể cả nhầm.
 */
export type ProductSeed = Omit<Product, "affiliateAvailable">;

/**
 * Một quãng thẻ CÒN NHẬN ĐƠN MỚI.
 *
 * Nhiều dòng cho một sản phẩm = thẻ từng ngừng rồi mở lại. Không dòng nào còn
 * hiệu lực = thẻ hiện không nhận đơn, nhưng người đang giữ vẫn kiếm điểm và
 * hưởng quyền lợi — đó là lý do khả dụng tách khỏi `Temporal` của chính bản
 * ghi sản phẩm.
 */
export interface ProductAvailability extends Temporal {
  id: ProductAvailabilityId;
  productId: ProductId;
  /** Vì sao quãng này đóng lại. `null` khi còn mở. */
  closedReason: string | null;
}

/* ------------------------------------------------------------------ *
 * product_fees
 * ------------------------------------------------------------------ */

/**
 * Phí thường niên của một sản phẩm, có hiệu lực theo thời gian.
 *
 * Miễn phí năm đầu KHÔNG nằm ở đây — nó là ưu đãi của một OFFER cụ thể
 * (`Offer.annualFeeFirstYear`), có thể hết trong khi phí gốc không đổi. Trộn
 * hai thứ lại thì một thẻ $139 đang có ưu đãi miễn năm đầu sẽ vĩnh viễn trông
 * như thẻ $0, kể cả sau khi ưu đãi hết.
 *
 * Miễn phí theo ĐIỀU KIỆN (gói ngân hàng, hạng Wealthsimple®) cũng không nằm
 * ở đây — nó là quyền lợi `annual_fee_waiver_conditional`, vì nó phụ thuộc
 * người dùng chứ không phải sản phẩm.
 */
export interface ProductFee extends Temporal, Sourced {
  id: ProductFeeId;
  productId: ProductId;
  /** Phí năm thường, dạng số. `0` là hợp lệ và có thật (Amex® Green). */
  annualFee: number;
  currency: "CAD" | "USD";
}

/* ------------------------------------------------------------------ *
 * §3.5 offers  +  §3.6 offer_components
 * ------------------------------------------------------------------ */

export interface Offer extends Temporal, Sourced {
  id: OfferId;
  productId: ProductId;
  name: string;
  startDate: string;
  endDate: string | null;
  /**
   * Welcome bonus này trả bằng GÌ.
   *
   * `points` — thưởng bằng điểm; `bonusCurrencyId` cho biết điểm gì.
   * `cash`   — thưởng bằng tiền hoặc statement credit.
   * `none`   — thẻ KHÔNG có welcome bonus nào.
   *
   * Không có trường này thì `bonusCurrencyId: null` phải gánh hai nghĩa hoàn
   * toàn khác nhau, và trong chính bộ dữ liệu hiện tại đã có cả hai: TD® Cash
   * Back thưởng bằng tiền, National Bank® thì không thưởng gì. Engine không
   * phân biệt được sẽ hoặc bỏ qua thẻ có thưởng tiền, hoặc bịa ra một khoản
   * thưởng cho thẻ không có.
   */
  bonusKind: "points" | "cash" | "none";
  /** Đồng tiền của welcome bonus. `null` khi `bonusKind` không phải `points`. */
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
   * Mức chi cần thiết QUY VỀ MỘT CỬA SỔ 90 NGÀY — con số §13 đem so với
   * `minimum_spend_capacity_3m` người dùng khai.
   *
   * Phải quy đổi, vì `minimumSpend` trần trụi không so được với sức chi 3
   * tháng của ai cả:
   *
   *   TD® First Class đòi $7,500 nhưng cho 180 ngày. So thẳng với sức chi 3
   *   tháng là đòi gấp đôi mức thật, và loại người thừa sức đạt.
   *   Amex® Cobalt đòi $750 mỗi chu kỳ sao kê. Cộng 12 chu kỳ ra $9,000 rồi
   *   đem so với sức chi 3 tháng thì thành một thẻ gần như không ai đủ điều
   *   kiện — trong khi nó là thẻ dễ đạt nhất danh sách.
   *   Scotiabank® Passport® có tầng $40,000/năm, quy về 90 ngày là ~$9,900.
   *
   * GIẢ ĐỊNH: chi tiêu rải đều trong cửa sổ. Đúng với mọi mốc trong bộ dữ liệu
   * hiện tại. Sai nếu có ngày một mốc đòi dồn vào cuối kỳ — chưa gặp.
   */
  spendPerNinetyDays: number | null;
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
   * Cửa sổ chi tiêu của thành phần này MỞ RA sau bao nhiêu ngày kể từ lúc mở
   * thẻ. `0` = mở ngay.
   *
   * Đây là chỗ phân biệt hai thứ trông giống hệt nhau và cho ra hai con số
   * khác nhau hàng chục nghìn đô:
   *
   *   TD® Aeroplan® Visa Infinite Privilege* đòi $12,000 trong 180 ngày, rồi
   *   $24,000 trong 12 tháng. Cả hai cửa sổ đều MỞ TỪ NGÀY MỞ THẺ, nên
   *   $12,000 đầu tiên ĐƯỢC TÍNH vào $24,000. Tổng phải chi là $24,000.
   *
   *   Amex® Aeroplan®* Reserve đòi $7,500 trong 3 tháng đầu, rồi $2,500 ở
   *   THÁNG THỨ 13. Cửa sổ thứ hai mở ở ngày 365, không giao với cửa sổ đầu,
   *   nên tiền không dùng lại được. Tổng là $10,000.
   *
   * Suy ra từ `componentType` là sai — `anniversary` nói điểm được TRẢ lúc
   * nào, không nói tiền phải chi lúc nào. Đoán nhầm chiều nào cũng ra một con
   * số về tiền nói sai với người đọc.
   */
  windowStartsAfterDays: number;
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
  /**
   * Trần mà tỷ lệ này chịu, nếu có. Trỏ tới `earning_caps`.
   *
   * LÀ THAM CHIẾU chứ không phải trần chép sẵn tại chỗ, vì NHIỀU HẠNG MỤC
   * DÙNG CHUNG MỘT TRẦN. TD® Cash Back có trần $450 mỗi năm dùng chung cho
   * siêu thị, xăng, sạc xe điện và phương tiện công cộng — bốn hạng mục, MỘT
   * cái trần. Chép trần vào từng dòng thì bốn dòng trông y hệt bốn cái trần
   * riêng, và engine sẽ cấp $1,800 thay vì $450. Cobalt cũng vậy với ba nhóm
   * 5x dùng chung trần 12,500 điểm/tháng.
   *
   * `null` = tỷ lệ không giới hạn.
   */
  capId: EarningCapId | null;
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

/**
 * Một cái trần tích điểm, dùng chung được giữa nhiều hạng mục.
 *
 * `kind` là ĐƠN VỊ của trần: `spend` = trần trên số tiền chi, `points` = trần
 * trên số điểm/tiền hoàn nhận được. Nhà phát hành công bố cả hai kiểu, và đoán
 * nhầm kiểu làm sai giá trị thẻ hàng nghìn điểm một năm.
 */
export interface EarningCap extends Temporal, Sourced {
  id: EarningCapId;
  productId: ProductId;
  /** Nhãn ngắn cho người đọc file, ví dụ "Nhóm 3% thứ nhất". */
  name: string;
  kind: "spend" | "points";
  amount: number;
  period: "monthly" | "quarterly" | "annual";
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

/** Đơn vị của `ProductBenefit.numericValue`. */
export type BenefitUnit =
  | "cad" // số tiền
  | "visits" // lượt vào phòng chờ
  | "guests" // số người đi cùng được hưởng
  | "nights" // đêm khách sạn / Elite Night
  | "credits" // Status Qualifying Credits
  | "count"; // số lượng chung (thẻ phụ, voucher…)

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
  /**
   * Đơn vị của `ProductBenefit.numericValue` cho loại quyền lợi này.
   *
   * Ở đây chứ không ở từng cặp sản phẩm–quyền lợi: đơn vị là thuộc tính của
   * LOẠI quyền lợi (lượt lounge luôn đếm bằng lượt), nên đặt nó ở cặp là chép
   * lại cùng một sự thật 118 lần và mở đường cho 118 cách viết khác nhau.
   *
   * `null` khi quyền lợi không có mặt số nào (không phụ phí ngoại tệ).
   */
  unit: BenefitUnit | null;
}

/**
 * Nhà cung cấp quyền lợi, khi việc trùng lặp phụ thuộc vào ai cấp nó.
 *
 * "Miễn hành lý ký gửi" trên thẻ Aeroplan® và trên thẻ United® KHÔNG trùng
 * nhau: hai hãng khác nhau, hai chuyến bay khác nhau. `duplicatesAcrossCards`
 * một mình là cờ TOÀN CỤC, nên nó sẽ triệt tiêu giá trị của thẻ United® chỉ vì
 * người dùng đã có thẻ Air Canada® — một kết luận sai về tiền, ở đúng chỗ
 * spec §16 Rule 6 nói phải cẩn thận.
 *
 * Hai quyền lợi chỉ trùng nhau khi CÙNG `benefitId` VÀ cùng `provider`.
 * `null` = không gắn với nhà cung cấp nào (travel credit, bảo hiểm), lúc đó
 * chỉ `duplicatesAcrossCards` quyết định.
 */
export interface ProductBenefit extends Temporal, Sourced {
  id: ProductBenefitId;
  productId: ProductId;
  benefitId: BenefitId;
  /**
   * Giá trị đo được — và `numericUnit` nói nó đo bằng GÌ.
   *
   * Không có đơn vị thì `4` là bốn lượt lounge, bốn trăm đô, hay bốn người đi
   * cùng? Cả ba đều có thật trong bộ dữ liệu này. Engine so hai thẻ bằng cách
   * so hai con số không cùng đơn vị là ra một câu về tiền, nói sai.
   */
  numericValue: number | null;
  textValue: string | null;
  /** Điều kiện có cấu trúc, đủ để engine đọc. Đang dùng:
   *  `{ minimumAnnualSpend: number }` — quyền lợi chỉ mở sau mức chi đó
   *  (Companion Pass sau $25,000). Người không chi tới đó thì quyền lợi này
   *  đáng 0, và trước khi có trường này thì không cách nào nói điều đó. */
  conditions: { minimumAnnualSpend?: number } | null;
  /** Hãng/chương trình cấp quyền lợi này — xem chú thích ngay trên. */
  provider: string | null;
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

/**
 * Một chỗ dữ liệu KHÔNG BIẾT, khai báo tường minh và máy đọc được.
 *
 * Đây là "trống ≠ bằng không" nâng lên thành kiểu dữ liệu. Trước đó những chỗ
 * trống chỉ tồn tại dưới dạng cảnh báo bằng CHỮ của `audit:reco-data` và một
 * hằng nằm ngoài dataset (`UNQUOTABLE_AWARD_PROGRAMS`) — nghĩa là Phase 3 muốn
 * biết mình đang thiếu gì thì phải đọc chuỗi tiếng Việt, đúng thứ lớp dữ liệu
 * này sinh ra để khỏi phải làm.
 *
 * Có nó thì engine hạ độ tin cậy đúng chỗ (spec §29) và nói được "chưa có dữ
 * liệu cho chặng này" thay vì im lặng trả về không có phương án nào — hai câu
 * rất khác nhau với người đọc.
 */
export interface DataGap {
  kind:
    | "no_award_chart" // chương trình không công bố bảng giá, đã tra và kết luận
    | "award_route_uncovered" // cặp vùng chưa ai dựng dữ liệu
    | "offer_terms_unknown" // offer có headline nhưng không rõ mốc chi
    | "base_earn_rate_unknown" // thẻ chưa có tỷ lệ cho chi tiêu thông thường
    | "eligibility_unknown" // chưa biết điều kiện riêng của thẻ này
    | "transfer_paths_unmodelled"; // chương trình chuyển được nhưng chưa dựng chặng
  /** Id của thực thể liên quan — sản phẩm, chương trình, offer. */
  subjectId: string;
  /** Vì sao còn trống. Dành cho NGƯỜI đọc; engine dùng `kind`. */
  reason: string;
}

export interface RecommendationDataset {
  issuers: Issuer[];
  productFamilies: ProductFamily[];
  programValuations: ProgramValuation[];
  productFees: ProductFee[];
  productAvailability: ProductAvailability[];
  pointsPrograms: PointsProgram[];
  transferPaths: TransferPath[];
  products: Product[];
  offers: Offer[];
  offerComponents: OfferComponent[];
  earningRates: EarningRate[];
  earningCaps: EarningCap[];
  benefits: Benefit[];
  productBenefits: ProductBenefit[];
  eligibilityRules: EligibilityRule[];
  awardStrategies: AwardStrategy[];
  /** Những chỗ dữ liệu không biết, khai tường minh — xem `DataGap`. */
  gaps: DataGap[];
}
