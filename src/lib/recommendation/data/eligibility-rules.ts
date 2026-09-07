import {
  id,
  type EligibilityRule,
  type EligibilityRuleId,
  type EligibilityRuleType,
  type ProductId,
} from "../types";

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

type RuleSeed = [
  type: EligibilityRuleType,
  value: number | string | boolean,
  severity?: "hard" | "soft" | "unknown",
];

/** Cặp thu nhập cá nhân / hộ gia đình, dạng nhà phát hành Canada luôn công bố. */
function income(personal: number, household: number): RuleSeed[] {
  return [
    ["minimum_personal_income", personal, "hard"],
    ["minimum_household_income", household, "hard"],
  ];
}

const BY_PRODUCT: Record<string, RuleSeed[]> = {
  // Amex® ghi rõ người ĐANG hoặc TỪNG giữ thẻ không đủ điều kiện nhận welcome
  // bonus. Đây là luật quyết định nhất trong cả file với người đã chơi điểm
  // vài năm — nó loại thẳng những thẻ trông hấp dẫn nhất.
  "amex-green": [["previous_cardholder_excluded", true, "hard"]],
  "amex-gold-rewards": [["previous_cardholder_excluded", true, "hard"]],
  "amex-cobalt": [["previous_cardholder_excluded", true, "hard"]],

  "scotiabank-momentum-visa-infinite-plus": income(60000, 100000),
  "cibc-aventura-gold-visa": [["minimum_household_income", 15000, "hard"]],
  "scotiabank-scene-plus-visa-students": [
    ["minimum_personal_income", 0, "hard"],
    ["student_status_required", true, "hard"],
  ],
  "westjet-rbc-world-elite-mastercard": income(80000, 150000),
  "td-aeroplan-visa-infinite-privilege": income(150000, 200000),
  "td-aeroplan-visa-infinite": income(60000, 100000),
  "td-first-class-travel-visa-infinite": income(60000, 100000),
  "cibc-aventura-visa-infinite": income(60000, 100000),
  "amex-aeroplan-business-reserve": [["business_required", true, "hard"]],
  "amex-marriott-bonvoy-business": [["business_required", true, "hard"]],
  "national-bank-world-elite-mastercard": income(80000, 150000),
  "td-cash-back-visa-infinite": income(60000, 100000),
  "wealthsimple-visa-infinite-privilege": income(150000, 200000),
  "rbc-avion-visa-infinite-privilege": income(200000, 200000),
  "td-aeroplan-visa-platinum": [["minimum_personal_income", 0, "hard"]],
  "amex-aeroplan": [
    ["minimum_personal_income", 0, "hard"],
    ["previous_cardholder_excluded", true, "hard"],
  ],
  "bmo-viporter-world-elite-mastercard": income(80000, 150000),
  "scotiabank-gold-amex": [
    ["banking_relationship_required", "Gói ngân hàng phù hợp để được miễn annual fee", "soft"],
  ],
  "rbc-avion-visa-infinite": income(60000, 100000),
  "rbc-avion-visa-platinum": [["minimum_personal_income", 0, "hard"]],
  "amex-marriott-bonvoy": [["previous_cardholder_excluded", true, "hard"]],
  "amex-aeroplan-reserve": [["previous_cardholder_excluded", true, "hard"]],
  "wealthsimple-visa-infinite-plus": [
    ["banking_relationship_required", "Tài khoản Wealthsimple® để được miễn annual fee", "soft"],
  ],

  // Nội dung site chưa nói gì về điều kiện của hai thẻ dưới. Để trống — xem
  // chú thích đầu file: trống nghĩa là chưa biết, không phải không yêu cầu.
  "united-mileageplus-neo-world-elite-mastercard": [],
  "scotiabank-passport-visa-infinite": [],
};

/** Ai cũng phải cư trú tại Canada. Không thẻ nào trong danh sách là ngoại lệ,
 *  nên viết một lần rồi rải ra thay vì lặp 28 dòng giống hệt nhau. */
const CANADIAN_RESIDENCY: RuleSeed = ["residency", "CA", "hard"];

export const ELIGIBILITY_RULES: EligibilityRule[] = Object.entries(BY_PRODUCT).flatMap(
  ([slug, seeds]) =>
    [CANADIAN_RESIDENCY, ...seeds].map(([ruleType, value, severity], index) => ({
      id: id<EligibilityRuleId>(`${slug}-${ruleType}-${index + 1}`),
      productId: slug as ProductId,
      ruleType,
      operator:
        ruleType === "minimum_personal_income" || ruleType === "minimum_household_income"
          ? ("gte" as const)
          : ("eq" as const),
      value,
      severity: severity ?? "unknown",
      effectiveFrom: VERIFIED_ON,
      effectiveTo: null,
      sourceUrl: `https://ghe1a.com/credit-cards/${slug}`,
      verifiedAt: VERIFIED_ON,
      confidence: "verified",
    })),
);
