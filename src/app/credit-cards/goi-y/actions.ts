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
import { RECO_ERROR } from "@/lib/recommender/errors";
import { rateLimit } from "@/lib/rate-limit";
import { validateUserState, type UserState } from "@/lib/recommendation";
import type { AnswerForm } from "@/lib/recommender/questions";
import {
  applyAnswerChecked,
  goalFrom,
  newUserState,
  questionFromKey,
  type QuestionContext,
} from "@/lib/recommender/questions";
import {
  clearSession,
  createState,
  currentDataset,
  currentUserId,
  loadState,
  runAndSave,
  RunLimitError,
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

/**
 * Chạy engine sau khi hồ sơ ĐÃ LƯU. Lỗi ở đây không được thành trang 500: hồ
 * sơ đã nằm trong kho, nên trang tự chạy lại được khi mở ra. Chỉ quá trần là
 * phải nói với người dùng — trang cũng sẽ chạm đúng trần đó.
 *
 * Trả về câu lỗi thay vì gọi `fail` ở trong: `redirect` ném NEXT_REDIRECT, và
 * một `catch` bọc quanh nó sẽ nuốt mất lệnh chuyển trang.
 */
async function runAfterSave(userId: string, state: UserState): Promise<string | null> {
  try {
    await runAndSave(userId, state);
    return null;
  } catch (error) {
    if (error instanceof RunLimitError) return error.message;
    console.error("[goi-y] không chạy được engine sau khi lưu hồ sơ", error);
    return null;
  }
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
  if (goalValue === "") fail(RECO_ERROR.goalMissing);

  // Một người mở trang = một hồ sơ mới trong database. Trần theo IP là thứ
  // duy nhất chặn được kịch bản tạo hàng loạt hồ sơ rỗng. Sau CDN của
  // Hostinger nên IP thật nằm ở `x-forwarded-for`; thiếu header thì mọi người
  // dùng chung một khoá, tức trần thành trần toàn site — chặt hơn, không lỏng
  // hơn.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // HAI trần: theo IP, và một trần chung cho cả site. `x-forwarded-for` là
  // header client tự đặt được (AGENTS.md), nên trần theo IP một mình chỉ chặn
  // người dùng thật; trần chung đặt giới hạn cho cả kịch bản xoay IP giả.
  const perIp = rateLimit(`reco:start:${ip}`, 30, 60 * 60 * 1000);
  const siteWide = rateLimit("reco:start:all", 500, 60 * 60 * 1000);
  if (!perIp.ok || !siteWide.ok) fail(RECO_ERROR.busy);

  const today = todayInSiteZone();
  const userId = await startUserId();
  const goal = goalFrom(goalValue, userId, today);
  if (goal === null) fail(RECO_ERROR.goalInvalid);

  const state = newUserState(userId, today, "CA");
  state.goals = [goal];
  let created = true;
  try {
    await createState(state);
  } catch (error) {
    console.error("[goi-y] không tạo được hồ sơ", error);
    created = false;
  }
  if (!created) fail(RECO_ERROR.storageDown);
  const limited = await runAfterSave(userId, state);
  if (limited !== null) fail(limited);
  redirect(PATH);
}

export async function answerQuestion(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (userId === null) redirect(PATH);
  let stored: Awaited<ReturnType<typeof loadState>>;
  try {
    stored = await loadState(userId);
  } catch (error) {
    console.error("[goi-y] không đọc được hồ sơ", error);
    fail(RECO_ERROR.storageDown);
  }
  if (stored === null) {
    await clearSession();
    redirect(PATH);
  }

  const key = String(formData.get("question") ?? "");
  let ctx: QuestionContext;
  try {
    ctx = await context();
  } catch (error) {
    console.error("[goi-y] không dựng được bộ dữ liệu", error);
    fail(RECO_ERROR.busy);
  }
  const spec = questionFromKey(key, stored.state, ctx);
  if (spec === null) fail(RECO_ERROR.questionGone);

  const form = answerForm(formData);
  const validate = (candidate: UserState) => validateUserState(candidate, ctx.dataset);
  const applied = applyAnswerChecked(stored.state, spec, form, ctx, validate);
  if (!applied.ok) fail(applied.error);

  // Xung đột version = hai tab cùng trả lời. Áp LẠI đúng câu trả lời này lên
  // bản mới nhất thay vì bắt người dùng làm lại; câu trả lời của tab kia vẫn
  // còn nguyên.
  let saved: Awaited<ReturnType<typeof saveState>> = null;
  try {
    saved = await saveState(userId, stored.version, applied.state, (current) => {
      const retry = applyAnswerChecked(current, spec, form, ctx, validate);
      return retry.ok ? retry.state : null;
    });
  } catch (error) {
    console.error("[goi-y] không lưu được câu trả lời", error);
  }
  if (saved === null) fail(RECO_ERROR.notSaved);

  // Trả lời rồi thì câu đó thôi nằm trong danh sách đã bỏ qua (người dùng vừa
  // bấm "Sửa" trên chính nó).
  await unskipQuestion(key);
  const limited = await runAfterSave(userId, saved.state);
  if (limited !== null) fail(limited);
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
