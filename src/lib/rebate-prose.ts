/**
 * Con số rebate xuất hiện ở HAI chỗ trên một thẻ, và chỉ một chỗ được canh.
 *
 * `rebateVi` là con số vẽ thành badge trên ảnh thẻ, và `/api/check-rebates`
 * đồng bộ nó với FinlyWealth hai lượt mỗi ngày. Nhưng cùng con số đó còn được
 * viết tay vào phần chữ — "HOT TIP: Apply thẻ qua FinlyWealth để nhận thêm $140
 * rebate." trong `editorsTakeVi` — và trước 01/09/2026 không có gì đụng tới
 * chỗ ấy.
 *
 * Hậu quả không phải giả thuyết. Rà tay ngày 01/09/2026: Scotiabank® Scene+™
 * Visa for Students hiện badge $50 trong khi editor's take vẫn hứa $125. Lệch
 * $75, không rõ đã sai bao lâu, vì chẳng có gì báo. Hai thẻ khác lệch cùng
 * ngày do job `check-rebates` gãy suốt thời gian token management hết hạn.
 *
 * Đây là tiền hứa với người đọc, đúng thứ mà `/api/check-rebates` sinh ra để
 * canh — nó chỉ canh sót một nửa.
 */

/**
 * Chỉ khớp con số đứng NGAY TRƯỚC chữ "rebate".
 *
 * Hẹp có chủ ý. Phần chữ của một thẻ đầy những con số đô la khác — annual fee,
 * travel credit, giá trị lounge, hạn mức chi tiêu — và một regex rộng hơn sẽ
 * viết đè lên chúng bằng con số rebate. Ràng buộc "phải có chữ rebate ngay
 * sau" là thứ phân biệt "$140 rebate" với "$139/năm" và "$100 TD Travel
 * Credit".
 *
 * `\$` chứ không phải `[$C]` hay "US$": theo quy ước tiền tệ của site, $ trần
 * là CAD, và rebate của FinlyWealth luôn là CAD.
 */
const REBATE_FIGURE = /\$[\d,]+(?= rebate)/gi;

/** Các trường có thể chứa câu HOT TIP. Chỉ chữ hiển thị, không đụng `slug`/URL. */
export const PROSE_FIELDS = [
  "headlineVi",
  "headlineEn",
  "editorsTakeVi",
  "editorsTakeEn",
  "keyBenefitsVi",
  "keyBenefitsEn",
] as const;

/** Mọi con số rebate được viết tay trong một đoạn chữ, theo thứ tự xuất hiện. */
export function rebateFiguresIn(text: string): string[] {
  return text.match(REBATE_FIGURE) ?? [];
}

/** Đoạn chữ với mọi con số rebate thay bằng `amount`. */
export function withRebateFigure(text: string, amount: string): string {
  return text.replace(REBATE_FIGURE, amount);
}

export interface ProseMismatch {
  field: string;
  found: string;
}

/**
 * Những chỗ trong phần chữ ghi một con số rebate KHÁC với `amount`.
 *
 * `fields` nhận thẳng hình dạng của Contentful (chuỗi, hoặc mảng chuỗi cho
 * `keyBenefits*`); thứ gì khác bị bỏ qua chứ không ném, vì người gọi là một
 * job chạy theo lịch và một trường có kiểu lạ không đáng làm hỏng cả lượt.
 */
export function rebateProseMismatches(
  fields: Record<string, unknown>,
  amount: string,
): ProseMismatch[] {
  const out: ProseMismatch[] = [];

  for (const name of PROSE_FIELDS) {
    const value = fields[name];
    const texts = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];

    for (const text of texts) {
      if (typeof text !== "string") continue;
      for (const found of rebateFiguresIn(text)) {
        if (found !== amount) out.push({ field: name, found });
      }
    }
  }

  return out;
}

/**
 * Bản vá cho `updateEntry`: chỉ những trường thật sự đổi, hoặc `{}` khi phần
 * chữ đã đúng.
 *
 * Trả bản vá chứ không sửa tại chỗ, vì `updateEntry` publish CẢ entry — gộp
 * việc sửa chữ vào cùng một lần ghi với `rebateVi` là điều kiện để hai con số
 * không bao giờ rời nhau, kể cả khi lần publish sau đó hỏng.
 */
export function rebateProsePatch(
  fields: Record<string, Record<string, unknown>>,
  locale: string,
  amount: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const name of PROSE_FIELDS) {
    const value = fields[name]?.[locale];

    if (typeof value === "string") {
      const next = withRebateFigure(value, amount);
      if (next !== value) patch[name] = next;
      continue;
    }

    if (Array.isArray(value)) {
      const next = value.map((item) =>
        typeof item === "string" ? withRebateFigure(item, amount) : item,
      );
      if (next.some((item, i) => item !== value[i])) patch[name] = next;
    }
  }

  return patch;
}
