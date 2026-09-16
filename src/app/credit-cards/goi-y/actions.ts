"use server";

/**
 * Bốn việc người dùng làm được trên trang gợi ý: bắt đầu, trả lời, bỏ qua, làm
 * lại.
 *
 * Tất cả là Server Action gắn thẳng vào `<form action={…}>`, nên trang chạy
 * được khi JavaScript chưa tải xong hoặc không chạy — độc giả của site có cả
 * thế hệ phụ huynh và máy cũ (PRODUCT.md), và một bảng câu hỏi chỉ hoạt động
 * khi JS chạy là một bảng câu hỏi hỏng với đúng nhóm đó.
 *
 * KHÔNG TIN FORM. Mọi giá trị đi qua `applyAnswer` (chỉ nhận đúng các lựa chọn
 * đã dựng) rồi qua `validateUserState` trong `runAndSave`. Server Action là một
 * endpoint công khai: nó nhận POST từ bất cứ đâu, không chỉ từ giao diện này.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { todayInSiteZone } from "@/lib/format-date";
import { rateLimit } from "@/lib/rate-limit";
import type { UserState } from "@/lib/recommendation";
import type { AnswerForm } from "@/lib/recommender/questions";
import {
  applyAnswer,
  goalFrom,
  newUserState,
  questionFor,
  type QuestionContext,
  type QuestionSpec,
} from "@/lib/recommender/questions";
import {
  clearSession,
  createState,
  currentDataset,
  currentUserId,
  loadState,
  runAndSave,
  saveState,
  skipQuestion,
  startUserId,
  unskipQuestion,
} from "@/lib/recommender/session";

const PATH = "/credit-cards/goi-y";

/** Lỗi đi qua URL: trang là server component, không giữ state giữa hai lần POST. */
function fail(message: string): never {
  redirect(`${PATH}?loi=${encodeURIComponent(message)}`);
}

async function context(): Promise<QuestionContext> {
  const { data } = await currentDataset();
  return { dataset: data, today: todayInSiteZone() };
}

/**
 * `FormData` có thể trả về `File`; bảng câu hỏi chỉ nhận chữ. Lọc ở biên giới
 * chứ không ép kiểu: một field `File` gửi lên phải thành "không có câu trả
 * lời", không thành `"[object File]"`.
 */
function answerForm(formData: FormData): AnswerForm {
  return {
    get: (name) => {
      const value = formData.get(name);
      return typeof value === "string" ? value : null;
    },
    getAll: (name) => formData.getAll(name).filter((value): value is string => typeof value === "string"),
  };
}

function specFromKey(key: string, state: UserState, ctx: QuestionContext): QuestionSpec | null {
  const separator = key.indexOf(":");
  if (separator < 1) return null;
  const kind = key.slice(0, separator) as QuestionSpec["kind"];
  const subject = key.slice(separator + 1);
  return questionFor({ kind, subject }, state, ctx);
}

/**
 * Bắt đầu: mục tiêu + nước ở, trong cùng một lần bấm.
 *
 * Nước ở hỏi NGAY ở đây chứ không để engine hỏi sau, vì `validateUserState` từ
 * chối hồ sơ không có nước — không tồn tại trạng thái "đã có hồ sơ mà chưa biết
 * ở đâu" hợp lệ. Xem `newUserState`.
 */
export async function startRecommendation(formData: FormData): Promise<void> {
  const goalValue = String(formData.get("goal") ?? "");
  const inCanada = String(formData.get("canada") ?? "");
  if (inCanada !== "yes") redirect(`${PATH}?ngoai-canada=1`);
  if (goalValue === "") fail("Chọn giúp mình một mục tiêu trước đã.");

  // Một người mở trang = một hồ sơ mới trong database. Trần theo IP là thứ
  // duy nhất chặn được kịch bản tạo hàng loạt hồ sơ rỗng. Sau CDN của
  // Hostinger nên IP thật nằm ở `x-forwarded-for`; thiếu header thì mọi người
  // dùng chung một khoá, tức trần thành trần toàn site — chặt hơn, không lỏng
  // hơn.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`reco:start:${ip}`, 30, 60 * 60 * 1000);
  if (!limit.ok) fail("Công cụ đang bận. Thử lại sau vài phút giúp mình.");

  const today = todayInSiteZone();
  const userId = await startUserId();
  const goal = goalFrom(goalValue, userId, today);
  if (goal === null) fail("Mục tiêu không hợp lệ.");

  const state = newUserState(userId, today, "CA");
  state.goals = [goal];
  await createState(state);
  await runAndSave(userId, state);
  redirect(PATH);
}

export async function answerQuestion(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (userId === null) redirect(PATH);
  const stored = await loadState(userId);
  if (stored === null) {
    await clearSession();
    redirect(PATH);
  }

  const key = String(formData.get("question") ?? "");
  const ctx = await context();
  const spec = specFromKey(key, stored.state, ctx);
  if (spec === null) fail("Câu hỏi này không còn nữa — thử lại giúp mình.");

  const form = answerForm(formData);
  const applied = applyAnswer(stored.state, spec, form, ctx);
  if (!applied.ok) fail(applied.error);

  // Xung đột version = hai tab cùng trả lời. Áp LẠI đúng câu trả lời này lên
  // bản mới nhất thay vì bắt người dùng làm lại; câu trả lời của tab kia vẫn
  // còn nguyên.
  const saved = await saveState(userId, stored.version, applied.state, (current) => {
    const retry = applyAnswer(current, spec, form, ctx);
    return retry.ok ? retry.state : null;
  });
  if (saved === null) fail("Không lưu được câu trả lời — thử lại giúp mình.");

  // Trả lời rồi thì câu đó thôi nằm trong danh sách đã bỏ qua (người dùng vừa
  // bấm "Sửa" trên chính nó).
  await unskipQuestion(key);
  await runAndSave(userId, saved.state);
  redirect(PATH);
}

export async function skipCurrentQuestion(formData: FormData): Promise<void> {
  const key = String(formData.get("question") ?? "");
  if (key !== "") await skipQuestion(key);
  redirect(PATH);
}

export async function resetRecommendation(): Promise<void> {
  // Chỉ bỏ cookie: hồ sơ và các lượt chạy cũ ở lại trong kho (§20 chỉ thêm,
  // không sửa). Người dùng bắt đầu một phiên mới, sạch.
  await clearSession();
  redirect(PATH);
}
