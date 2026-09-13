/**
 * Dạng hợp lệ của từng loại luật điều kiện — MỘT bảng cho cả validator lẫn
 * engine.
 *
 * Hai bảng từng sống riêng: `validate.ts` nhận `residency not_in [...]`, còn
 * `eligibility.ts` chỉ hiểu `eq`/`in` cho cư trú. Một luật HỢP LỆ theo dữ liệu
 * vì thế ra `unknown`, bị phạt −0.05 và bị debugger đổ cho dữ liệu nguồn —
 * trong khi lỗi nằm ở engine (vòng Codex 17). Nay engine đánh giá được đúng
 * những gì validator nhận, và "operator không đọc được" chỉ còn nghĩa là
 * dữ liệu sai dạng.
 */

export const RULE_SHAPES: Readonly<
  Record<string, { value: "number" | "string" | "boolean"; operators: readonly string[] }>
> = {
  minimum_personal_income: { value: "number", operators: ["gte"] },
  minimum_household_income: { value: "number", operators: ["gte"] },
  residency: { value: "string", operators: ["eq", "in", "not_in"] },
  existing_cardholder_excluded: { value: "boolean", operators: ["eq"] },
  previous_cardholder_excluded: { value: "boolean", operators: ["eq"] },
  business_required: { value: "boolean", operators: ["eq"] },
  student_status_required: { value: "boolean", operators: ["eq"] },
  banking_relationship_required: { value: "string", operators: ["eq"] },
};
