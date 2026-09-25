import {
  makeId,
  type EligibilityRule,
  type EligibilityRuleId,
  type EligibilityRuleType,
  type RuleLookback,
} from "../types.ts";
import { PRODUCTS, productIdFor } from "./products.ts";

/**
 * Điều kiện mở thẻ.
 *
 * KHÔNG CÓ ĐIỂM TÍN DỤNG, và đó là điều quan trọng nhất về file này (spec
 * §3.10, guardrail §36.7). Kiểu `EligibilityRuleType` không có nhánh nào cho
 * nó, nên không phải "chưa seed" mà là không thêm vào được. Engine không biết
 * điểm tín dụng của người dùng, không đoán được, và một hệ thống từ chối
 * người đọc dựa trên con số nó tự bịa thì tệ hơn hẳn một hệ thống im lặng.
 *
 * ĐIỀU KIỆN ≠ SỰ PHÙ HỢP (spec §14). Người đủ điều kiện mở thẻ $599 nhưng
 * khai chịu tối đa $200 phí thì thẻ đó KHÔNG PHÙ HỢP, không phải KHÔNG ĐỦ
 * ĐIỀU KIỆN. Hai chuyện đó nằm ở hai lớp khác nhau trong engine, và trộn
 * chúng lại là cách nhanh nhất để nói với người đọc một câu sai về chính họ.
 *
 * NGUỒN: `editorsTakeVi` và `keyBenefitsVi` của entry Contentful. Thẻ nào nội
 * dung site không nói gì về điều kiện thu nhập thì ở đây KHÔNG có dòng nào —
 * và "không có dòng" nghĩa là CHƯA BIẾT, không phải "không yêu cầu". Chỗ nào
 * site nói rõ là không yêu cầu thì có dòng `minimum_personal_income` với giá
 * trị 0, vì "đã kiểm và bằng không" là một dữ kiện khác hẳn "chưa kiểm".
 */

const VERIFIED_ON = "2026-09-07";
/**
 * Ngày các dòng này được ĐƯA VÀO kho. ĐỘC LẬP với `VERIFIED_ON`, và không được
 * đổi khi kiểm lại: kiểm lại một dữ kiện không đổi ngày nó vào kho, còn buộc
 * hai thứ vào nhau thì mỗi lần kiểm lại sẽ làm các lượt chạy TRƯỚC đó trông
 * như chưa từng biết dòng này.
 */
const RECORDED_ON = "2026-09-07";

type RuleSeed = {
  type: EligibilityRuleType;
  value: number | string | boolean;
  severity?: "hard" | "soft" | "unknown";
  scope?: "application" | "welcome_offer";
  /** Cùng `group` thì nối bằng HOẶC. Xem `EligibilityRule.ruleGroup`. */
  group?: string;
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
   * Chỉ cho `previous_cardholder_within_months`: mốc nào, và SLUG các thẻ được
   * tính — xem `RuleLookback`.
   */
  lookback?: { anchor: RuleLookback["anchor"]; slugs: string[] };
  /**
   * Trang điều khoản GỐC của nhà phát hành. Vắng thì nguồn là trang thẻ trên
   * ghe1a.com — đúng cho các dòng suy từ nội dung site, SAI cho luật đọc thẳng
   * từ footnote ngân hàng: người kiểm lại phải được trỏ tới đúng chỗ đã đọc.
   */
  source?: string;
};

/**
 * Cặp thu nhập cá nhân / hộ gia đình, dạng nhà phát hành Canada luôn công bố.
 *
 * Hai dòng CÙNG một `group`, nên engine đọc chúng là "đạt MỘT trong hai".
 * Trước khi có `group`, hai dòng `hard` riêng lẻ nghĩa là phải đạt CẢ HAI —
 * và vế hộ gia đình sinh ra chính là để cứu người không đạt vế cá nhân, nên
 * cách đọc kia loại oan đúng nhóm nó phục vụ.
 */
function income(personal: number, household: number): RuleSeed[] {
  return [
    { type: "minimum_personal_income", value: personal, severity: "hard", group: "income" },
    { type: "minimum_household_income", value: household, severity: "hard", group: "income" },
  ];
}

/** Amex® "once in a lifetime": vẫn mở được thẻ, chỉ không có welcome bonus.
 *  `scope: "welcome_offer"` là chỗ nói ra điều đó — xem `EligibilityRule.scope`. */
const AMEX_ONCE_IN_A_LIFETIME: RuleSeed = {
  type: "previous_cardholder_excluded",
  value: true,
  severity: "hard",
  scope: "welcome_offer",
};

/*
 * Luật "không có welcome bonus nếu … trong N tháng qua" — đọc THẲNG từ
 * footnote offer trên trang ngân hàng ngày 21/09/2026, không qua blog thứ
 * cấp. Lỗi dẫn tới chúng: hồ sơ khai "từng giữ TD® Aeroplan® Visa Infinite,
 * đã đóng, không rõ ngày" được khuyên chính thẻ đó với trọn 50,000 điểm và
 * không một dòng cảnh báo, vì trước đây chỉ Amex® có luật "từng giữ".
 *
 * Kiểm rồi mà KHÔNG có luật dạng này (đừng thêm khi chưa đọc lại điều khoản):
 *   - RBC® (Avion®, WestJet): chỉ loại người CHUYỂN từ thẻ RBC khác sang —
 *     mô hình người dùng không có "chuyển thẻ", mở mới thì không bị loại.
 *     WestJet loại chủ thẻ cũ khỏi companion voucher, không khỏi điểm thưởng.
 *   - CIBC® Aeroplan®: không có cửa sổ tháng — chỉ dẫn điều khoản chung của
 *     Aeroplan®, mô hình hoá riêng ở `AEROPLAN_CATEGORIES` bên dưới.
 *   - Wealthsimple: không có welcome bonus.
 *
 * Footnote CÓ ghi cửa sổ nhưng user chốt 21/09/2026 là thực tế KHÔNG áp —
 * "vẫn nhận được bonus bất kể đã mở thẻ đó trong bao lâu trước đó":
 *   - CIBC® Aventura® (Gold, Visa Infinite): "opened, transferred or cancelled
 *     another Aventura card within the last 12 months".
 *   - Scotiabank® Scene+™ (Gold American Express®, Passport Visa Infinite,
 *     Scene+™ Visa sinh viên): "… cardholders of a Scotiabank personal credit
 *     card in the past 2 years".
 *   - TD Rewards (TD® First Class Travel® Visa Infinite): "activated and/or
 *     closed … in the last 12 months".
 * Đừng thêm lại từ footnote. Scotia Momentum® (cash back, không phải Scene+™)
 * và TD® Cash Back nằm ngoài câu chốt đó nên vẫn giữ luật.
 */
const RULES_CHECKED_ON = "2026-09-21";

/** Mọi thẻ trong họ `family` của `products.ts`, gồm cả thẻ đang xét. */
function familySlugs(family: string): string[] {
  const familyId = `fam_${family}`;
  const slugs = PRODUCTS.filter((product) => (product.familyId as string | null) === familyId).map((p) => p.slug);
  if (slugs.length === 0) throw new Error(`Không có họ thẻ "${family}" trong data/products.ts`);
  return slugs;
}

/** Mọi thẻ CÁ NHÂN (kể cả thẻ sinh viên) của một nhà phát hành. */
function personalIssuerSlugs(issuer: string): string[] {
  const slugs = PRODUCTS.filter(
    (product) => (product.issuerId as string) === issuer && product.personalOrBusiness !== "business",
  ).map((p) => p.slug);
  if (slugs.length === 0) throw new Error(`Không có thẻ cá nhân nào của "${issuer}" trong data/products.ts`);
  return slugs;
}

function withinMonths(
  months: number,
  anchor: RuleLookback["anchor"],
  slugs: string[],
  source: string,
): RuleSeed {
  return {
    type: "previous_cardholder_within_months",
    value: months,
    severity: "hard",
    scope: "welcome_offer",
    lookback: { anchor, slugs },
    source,
    from: RULES_CHECKED_ON,
  };
}

// "(ii) not have opened any TD-Aeroplan Visa Card account (e.g., Platinum,
// Infinite, Infinite Privilege or Business) in the last 12 months." Đếm theo
// ngày MỞ: đóng tháng trước mà mở từ ba năm trước thì vẫn được bonus. Bản
// Business không có trong kho nên không liệt kê được.
const TD_AEROPLAN_12M = (page: string) =>
  withinMonths(12, "opened", familySlugs("td-aeroplan"), `https://www.td.com/ca/en/personal-banking/products/credit-cards/aeroplan/${page}`);

// "Individuals who are currently or were previously primary or secondary
// cardholders of a Scotiabank personal credit card in the past 2 years,
// including those that switch from an existing Scotiabank personal credit
// card … are not eligible" — MỌI thẻ cá nhân của Scotiabank®, không riêng thẻ này.
const SCOTIABANK_24M = (page: string) =>
  withinMonths(24, "held", personalIssuerSlugs("scotiabank"), `https://www.scotiabank.com/ca/en/personal/credit-cards/${page}`);


/*
 * Điều khoản chung Aeroplan® (mục "New Card Bonus Provisions", đọc 21/09/2026):
 * "a Member may be granted a maximum of one New Card Bonus for each type of
 * Aeroplan Credit Card that the Member becomes a holder of, regardless of
 * issuer (e.g., entry, core, premium, core small business, premium small
 * business, or any other card that has a substantially similar level of
 * benefits)". TD® và CIBC® đều dẫn nó trong footnote offer.
 *
 * Tức once-in-a-lifetime theo LOẠI thẻ, xuyên ngân hàng (user chốt
 * 21/09/2026: "Tất cả các thẻ Aeroplan offer là once-in-a-lifetime"). Từng giữ
 * TD® Aeroplan® Visa Infinite thì mất bonus của CHÍNH nó, của CIBC® Aeroplan®
 * Visa Infinite lẫn American Express® Aeroplan® — cùng loại "core" — dù đóng
 * từ bao giờ. Luật 12 tháng của TD® vẫn cần: nó chặn XUYÊN loại trong cùng
 * ngân hàng (mở Platinum tháng trước thì mất bonus Infinite).
 *
 * Phân loại theo mức quyền lợi (phí, lounge, hành lý), không theo `tier` của
 * họ thẻ: họ Amex® chỉ có hai hạng nên `tier` không so được giữa các họ.
 */
const AEROPLAN_TERMS = "https://www.aircanada.com/ca/en/aco/home/aeroplan/legal/terms-and-conditions.html";
const AEROPLAN_CATEGORIES: Record<string, string[]> = {
  entry: ["td-aeroplan-visa-platinum", "cibc-aeroplan-visa"],
  core: ["td-aeroplan-visa-infinite", "cibc-aeroplan-visa-infinite", "amex-aeroplan"],
  premium: ["td-aeroplan-visa-infinite-privilege", "cibc-aeroplan-visa-infinite-privilege", "amex-aeroplan-reserve"],
  premium_small_business: ["amex-aeroplan-business-reserve"],
};

function aeroplanCategoryRule(slug: string): RuleSeed {
  const category = Object.values(AEROPLAN_CATEGORIES).find((slugs) => slugs.includes(slug));
  if (category === undefined) throw new Error(`"${slug}" chưa được xếp loại thẻ Aeroplan®`);
  return {
    type: "previous_cardholder_same_category",
    value: true,
    severity: "hard",
    scope: "welcome_offer",
    lookback: { anchor: "held", slugs: category },
    source: AEROPLAN_TERMS,
    from: RULES_CHECKED_ON,
  };
}

/** Luật trọn đời, nguồn là footnote của ngân hàng (không phải nội dung site). */
function lifetimeFromIssuer(source: string): RuleSeed {
  return { ...AMEX_ONCE_IN_A_LIFETIME, source, from: RULES_CHECKED_ON };
}

const BY_PRODUCT: Record<string, RuleSeed[]> = {
  // Amex® ghi rõ người ĐANG hoặc TỪNG giữ thẻ không đủ điều kiện nhận welcome
  // bonus. Đây là luật quyết định nhất trong cả file với người đã chơi điểm
  // vài năm — nó loại thẳng những thẻ trông hấp dẫn nhất.
  "amex-green": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-gold-rewards": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-cobalt": [AMEX_ONCE_IN_A_LIFETIME],

  "scotiabank-momentum-visa-infinite-plus": [
    ...income(60000, 100000),
    SCOTIABANK_24M("visa/momentum-infinite-card.html"),
  ],
  "cibc-aventura-gold-visa": [
    { type: "minimum_household_income", value: 15000, severity: "hard" },
  ],
  "scotiabank-scene-plus-visa-students": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
    { type: "student_status_required", value: true, severity: "hard" },
  ],
  "westjet-rbc-world-elite-mastercard": income(80000, 150000),
  "td-aeroplan-visa-infinite-privilege": [
    ...income(150000, 200000),
    TD_AEROPLAN_12M("aeroplan-visa-infinite-privilege-card"),
  ],
  "td-aeroplan-visa-infinite": [...income(60000, 100000), TD_AEROPLAN_12M("aeroplan-visa-infinite-card")],
  "td-first-class-travel-visa-infinite": income(60000, 100000),
  "cibc-aventura-visa-infinite": income(60000, 100000),
  "amex-aeroplan-business-reserve": [
    { type: "business_required", value: true, severity: "hard" },
  ],
  "amex-marriott-bonvoy-business": [
    { type: "business_required", value: true, severity: "hard" },
  ],
  // "you must not currently hold, or have held a National Bank Mastercard
  // credit card in the past 24 months." — mọi thẻ Mastercard® cá nhân của NBC.
  "national-bank-world-elite-mastercard": [
    ...income(80000, 150000),
    withinMonths(
      24,
      "held",
      personalIssuerSlugs("national-bank"),
      "https://www.nbc.ca/personal/mastercard-credit-cards/world-elite.html",
    ),
  ],
  // "This offer is not available customers who have activated and/or closed a
  // TD Cash Back Visa Infinite Account in the last 12 months."
  "td-cash-back-visa-infinite": [
    ...income(60000, 100000),
    withinMonths(
      12,
      "opened_or_closed",
      ["td-cash-back-visa-infinite"],
      "https://www.td.com/ca/en/personal-banking/products/credit-cards/cash-back/cash-back-visa-infinite-card",
    ),
  ],
  "wealthsimple-visa-infinite-privilege": income(150000, 200000),
  "rbc-avion-visa-infinite-privilege": income(200000, 200000),
  "td-aeroplan-visa-platinum": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
    TD_AEROPLAN_12M("aeroplan-visa-platinum-card"),
  ],
  "amex-aeroplan": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
    AMEX_ONCE_IN_A_LIFETIME,
  ],
  // "This offer is not available to current or former cardholders who
  // reinstate a closed account or open a new account for the same card during
  // the Offer Period." — không có cửa sổ tháng: TỪNG giữ là mất bonus.
  "bmo-viporter-world-elite-mastercard": [
    ...income(80000, 150000),
    lifetimeFromIssuer("https://www.bmo.com/popups/main/personal/credit-cards/terms-and-conditions-en.html#footnote-112"),
  ],
  // Scotiabank® Gold: gói ngân hàng làm MIỄN PHÍ thường niên, nó KHÔNG phải
  // điều kiện để được duyệt thẻ. Trước đây nó nằm ở đây dưới dạng một câu
  // tiếng Việt trong `value` — vừa sai chỗ (đây là bảng điều kiện mở thẻ),
  // vừa buộc engine phải đọc chữ để hiểu. Sự thật đó đã có chỗ đúng của nó:
  // quyền lợi `annual_fee_waiver_conditional` trong `product-benefits.ts`.
  "scotiabank-gold-amex": [],
  "rbc-avion-visa-infinite": income(60000, 100000),
  "rbc-avion-visa-platinum": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
  ],
  "amex-marriott-bonvoy": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-aeroplan-reserve": [AMEX_ONCE_IN_A_LIFETIME],
  // Cùng lý do với Scotiabank® Gold ngay trên.
  "wealthsimple-visa-infinite-plus": [],

  // Nội dung site chưa nói gì về điều kiện MỞ THẺ của hai thẻ dưới — luật
  // của United® Neo chỉ nói về welcome bonus (`scope: "welcome_offer"`), nên
  // `eligibility_unknown` vẫn đúng: trống nghĩa là chưa biết, không phải
  // không yêu cầu.
  // "Limited one-time offer for new customers who have not opened a United
  // Neo World Elite Mastercard before the date of application approval."
  "united-mileageplus-neo-world-elite-mastercard": [
    lifetimeFromIssuer("https://www.neofinancial.com/credit-cards/neo-united-mastercard"),
  ],
  "scotiabank-passport-visa-infinite": [],
  // Tangerine còn cho vế thứ ba: $400,000 assets under management. Mô hình
  // người dùng không có trường tài sản nên vế đó chưa seed, như mọi thẻ khác có
  // vế tài sản — giới hạn chung của engine. ĐỪNG hạ hai vế thu nhập xuống
  // `soft`: `eligibility.ts` bỏ hẳn luật soft khỏi phép xét, tức người trượt cả
  // hai ngưỡng thành "đủ điều kiện" (Codex bắt 25/09/2026).
  // "(i) have not been Primary Cardholders of this card previously" — không có
  // cửa sổ tháng: TỪNG giữ là mất bonus.
  "tangerine-rewards-world-elite-mastercard": [
    ...income(80000, 150000).map((rule) => ({ ...rule, from: "2026-09-25" })),
    {
      ...lifetimeFromIssuer("https://www.tangerine.ca/en/personal/spend/credit-cards/world-elite-mastercard"),
      from: "2026-09-25",
    },
  ],

  "amex-platinum": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-business-platinum": [
    AMEX_ONCE_IN_A_LIFETIME,
    { type: "business_required", value: true, severity: "hard" },
  ],
  "amex-business-gold": [
    AMEX_ONCE_IN_A_LIFETIME,
    { type: "business_required", value: true, severity: "hard" },
  ],

  "cibc-aeroplan-visa": [
    { type: "minimum_household_income", value: 15000, severity: "hard" },
  ],
  // Bản Visa Infinite: nội dung site chưa nêu điều kiện thu nhập. Để trống —
  // trống nghĩa là chưa biết, không phải không yêu cầu.
  "cibc-aeroplan-visa-infinite": [],
  "cibc-aeroplan-visa-infinite-privilege": income(150000, 200000),
};

/** Ai cũng phải cư trú tại Canada. Không thẻ nào trong danh sách là ngoại lệ,
 *  nên viết một lần rồi rải ra thay vì lặp 28 dòng giống hệt nhau. */
const CANADIAN_RESIDENCY: RuleSeed = { type: "residency", value: "CA", severity: "hard" };

export const ELIGIBILITY_RULES: EligibilityRule[] = Object.entries(BY_PRODUCT).flatMap(
  ([slug, seeds]) =>
    [
      CANADIAN_RESIDENCY,
      ...seeds,
      ...(Object.values(AEROPLAN_CATEGORIES).flat().includes(slug) ? [aeroplanCategoryRule(slug)] : []),
    ].map((seed) => ({
      // Dựng từ nội dung + ngày hiệu lực, không từ vị trí trong mảng. Một sản
      // phẩm có thể có hai luật cùng `type` (thu nhập cá nhân và hộ gia đình
      // là hai `type` khác nhau, nhưng `residency` thì chỉ một) — validator
      // bắt nếu hai luật rút về cùng một id.
      id: makeId<EligibilityRuleId>("elig", productIdFor(slug), seed.type, seed.from ?? VERIFIED_ON),
      productId: productIdFor(slug),
      ruleType: seed.type,
      operator:
        seed.type === "minimum_personal_income" || seed.type === "minimum_household_income"
          ? ("gte" as const)
          : seed.type === "previous_cardholder_within_months"
            ? ("lte" as const)
            : ("eq" as const),
      value: seed.value,
      severity: seed.severity ?? "unknown",
      scope: seed.scope ?? "application",
      // Nhóm phải bao gồm slug: hai thẻ cùng dùng nhóm "income" mà không tách
      // ra thì mọi luật thu nhập của cả site rơi vào một nhóm HOẶC khổng lồ,
      // và đạt điều kiện của một thẻ bất kỳ thành đạt điều kiện của tất cả.
      ruleGroup: seed.group ? `${slug}-${seed.group}` : null,
      lookback: seed.lookback
        ? { anchor: seed.lookback.anchor, productIds: seed.lookback.slugs.map(productIdFor) }
        : null,
      effectiveFrom: seed.from ?? VERIFIED_ON,
      effectiveTo: seed.to ?? null,
      sourceUrl: seed.source ?? `https://ghe1a.com/credit-cards/${slug}`,
      sourceKind: seed.source ? ("issuer" as const) : ("ghe1a" as const),
      verifiedAt: seed.verifiedAt ?? seed.from ?? VERIFIED_ON,
      recordedAt: seed.from ?? RECORDED_ON,
      confidence: "verified",
    })),
);
