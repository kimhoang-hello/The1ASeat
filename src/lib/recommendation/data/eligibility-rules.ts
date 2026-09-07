import {
  id,
  makeId,
  type EligibilityRule,
  type EligibilityRuleId,
  type EligibilityRuleType,
  type ProductId,
} from "../types.ts";

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

type RuleSeed = {
  type: EligibilityRuleType;
  value: number | string | boolean;
  severity?: "hard" | "soft" | "unknown";
  scope?: "application" | "welcome_offer";
  /** Cùng `group` thì nối bằng HOẶC. Xem `EligibilityRule.ruleGroup`. */
  group?: string;
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

const BY_PRODUCT: Record<string, RuleSeed[]> = {
  // Amex® ghi rõ người ĐANG hoặc TỪNG giữ thẻ không đủ điều kiện nhận welcome
  // bonus. Đây là luật quyết định nhất trong cả file với người đã chơi điểm
  // vài năm — nó loại thẳng những thẻ trông hấp dẫn nhất.
  "amex-green": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-gold-rewards": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-cobalt": [AMEX_ONCE_IN_A_LIFETIME],

  "scotiabank-momentum-visa-infinite-plus": income(60000, 100000),
  "cibc-aventura-gold-visa": [
    { type: "minimum_household_income", value: 15000, severity: "hard" },
  ],
  "scotiabank-scene-plus-visa-students": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
    { type: "student_status_required", value: true, severity: "hard" },
  ],
  "westjet-rbc-world-elite-mastercard": income(80000, 150000),
  "td-aeroplan-visa-infinite-privilege": income(150000, 200000),
  "td-aeroplan-visa-infinite": income(60000, 100000),
  "td-first-class-travel-visa-infinite": income(60000, 100000),
  "cibc-aventura-visa-infinite": income(60000, 100000),
  "amex-aeroplan-business-reserve": [
    { type: "business_required", value: true, severity: "hard" },
  ],
  "amex-marriott-bonvoy-business": [
    { type: "business_required", value: true, severity: "hard" },
  ],
  "national-bank-world-elite-mastercard": income(80000, 150000),
  "td-cash-back-visa-infinite": income(60000, 100000),
  "wealthsimple-visa-infinite-privilege": income(150000, 200000),
  "rbc-avion-visa-infinite-privilege": income(200000, 200000),
  "td-aeroplan-visa-platinum": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
  ],
  "amex-aeroplan": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
    AMEX_ONCE_IN_A_LIFETIME,
  ],
  "bmo-viporter-world-elite-mastercard": income(80000, 150000),
  "scotiabank-gold-amex": [
    {
      type: "banking_relationship_required",
      value: "Gói ngân hàng phù hợp để được miễn annual fee",
      severity: "soft",
    },
  ],
  "rbc-avion-visa-infinite": income(60000, 100000),
  "rbc-avion-visa-platinum": [
    { type: "minimum_personal_income", value: 0, severity: "hard" },
  ],
  "amex-marriott-bonvoy": [AMEX_ONCE_IN_A_LIFETIME],
  "amex-aeroplan-reserve": [AMEX_ONCE_IN_A_LIFETIME],
  "wealthsimple-visa-infinite-plus": [
    {
      type: "banking_relationship_required",
      value: "Tài khoản Wealthsimple® để được miễn annual fee",
      severity: "soft",
    },
  ],

  // Nội dung site chưa nói gì về điều kiện của hai thẻ dưới. Để trống — xem
  // chú thích đầu file: trống nghĩa là chưa biết, không phải không yêu cầu.
  "united-mileageplus-neo-world-elite-mastercard": [],
  "scotiabank-passport-visa-infinite": [],

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
    [CANADIAN_RESIDENCY, ...seeds].map((seed) => ({
      // Dựng từ nội dung + ngày hiệu lực, không từ vị trí trong mảng. Một sản
      // phẩm có thể có hai luật cùng `type` (thu nhập cá nhân và hộ gia đình
      // là hai `type` khác nhau, nhưng `residency` thì chỉ một) — validator
      // bắt nếu hai luật rút về cùng một id.
      id: makeId<EligibilityRuleId>("elig", `prd_${slug}`, seed.type, VERIFIED_ON),
      productId: id<ProductId>(`prd_${slug}`),
      ruleType: seed.type,
      operator:
        seed.type === "minimum_personal_income" || seed.type === "minimum_household_income"
          ? ("gte" as const)
          : ("eq" as const),
      value: seed.value,
      severity: seed.severity ?? "unknown",
      scope: seed.scope ?? "application",
      // Nhóm phải bao gồm slug: hai thẻ cùng dùng nhóm "income" mà không tách
      // ra thì mọi luật thu nhập của cả site rơi vào một nhóm HOẶC khổng lồ,
      // và đạt điều kiện của một thẻ bất kỳ thành đạt điều kiện của tất cả.
      ruleGroup: seed.group ? `${slug}-${seed.group}` : null,
      effectiveFrom: VERIFIED_ON,
      effectiveTo: null,
      sourceUrl: `https://ghe1a.com/credit-cards/${slug}`,
      sourceKind: "ghe1a",
      verifiedAt: VERIFIED_ON,
      confidence: "verified",
    })),
);
