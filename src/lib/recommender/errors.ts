/**
 * Mọi câu lỗi trang gợi ý được phép in ra từ `?loi=`.
 *
 * Server Action báo lỗi bằng cách chuyển về trang kèm câu lỗi trên URL (trang
 * là server component, không giữ state giữa hai lần POST). URL thì ai cũng gõ
 * được, nên trang chỉ in câu nằm trong danh sách này — không có nó,
 * `/credit-cards/goi-y?loi=<chữ tuỳ ý>` in bất kỳ câu nào lên ghe1a.com.
 *
 * File riêng vì `actions.ts` là "use server": nó chỉ được export hàm async.
 */

import { ANSWER_ERRORS } from "./questions.ts";

export const RECO_ERROR = {
  goalMissing: "Chọn một mục tiêu trước đã.",
  busy: "Công cụ đang bận, thử lại sau vài phút.",
  goalInvalid: "Mục tiêu không hợp lệ.",
  storageDown: "Chỗ lưu hồ sơ đang không vào được — thử lại sau vài phút.",
  questionGone: "Câu hỏi này không còn nữa — tải lại trang rồi thử lại.",
  notSaved: "Không lưu được câu trả lời — thử lại lần nữa.",
  runLimit: "Bạn vừa chạy quá nhiều lượt gợi ý — thử lại sau một lúc.",
} as const;

const KNOWN_ERRORS: ReadonlySet<string> = new Set([...Object.values(RECO_ERROR), ...ANSWER_ERRORS]);

/** Câu lỗi để in, hoặc `null` nếu URL mang một câu trang không tự phát ra. */
export function knownError(message: string | null): string | null {
  return message !== null && KNOWN_ERRORS.has(message) ? message : null;
}
