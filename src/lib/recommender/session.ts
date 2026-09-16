/**
 * Phiên của một người dùng thật: cookie ẩn danh → hồ sơ trong MySQL → lượt chạy
 * đã lưu.
 *
 * DANH TÍNH LÀ MỘT CHUỖI NGẪU NHIÊN. Không email, không tên, không đăng nhập.
 * Cookie chỉ mang một id 128 bit; mọi câu trả lời nằm ở server. Mô hình người
 * dùng (`user-types.ts`) cố ý không có chỗ nào chứa nổi dữ liệu nhận dạng, và
 * lớp này không thêm chỗ nào.
 *
 * MỌI LƯỢT CHẠY ĐƯỢC LƯU. Đó là điều kiện để sau này trả lời được câu "khuyến
 * nghị này sai": có bản ghi thì `npm run reco:debug -- replay <id>` quy được sai
 * lệch về đúng tầng; không có thì năm tầng giữa chỉ chẩn đoán được bằng hiểu
 * biết nghiệp vụ (bàn giao Phase 4, mục diễn tập). Người dùng thấy `runId` ngay
 * trên trang, nên một khiếu nại luôn kèm mã tra được.
 *
 * KHÔNG CÓ DATABASE thì trang tự nói ra. Chạy engine mà không lưu nổi là đúng
 * thứ làm mọi khiếu nại về sau thành không tra được, nên chỗ này trả lỗi thay
 * vì âm thầm chạy tiếp.
 */

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { todayInSiteZone } from "@/lib/format-date";
import {
  ENGINE_VERSION,
  executeRun,
  fingerprint,
  loadOfferHistory,
  persistRun,
  repoDataSource,
  validateUserState,
  type RecommendationDataset,
  type RecommendationRunRecord,
  type UserState,
} from "@/lib/recommendation";
import { mysqlRunStore } from "@/lib/recommendation/run-store-mysql";
import { mysqlUserStore } from "@/lib/recommendation/user-store-mysql";
import { recoDatabaseFromEnv } from "@/lib/recommendation/mysql";
import { UserStateConflictError, type StoredUserState } from "@/lib/recommendation/user-source";
import { rateLimit } from "@/lib/rate-limit";
import { mysqlExplanationStore, type ExplanationStore } from "@/lib/recommender/explain-store";

export const USER_COOKIE = "g1a_reco";
export const SKIP_COOKIE = "g1a_reco_skip";

/** Một năm: đủ để quay lại sau một mùa săn offer, và tự hết hạn nếu không. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Trần số lượt chạy một người tạo ra trong một giờ.
 *
 * Mỗi lượt chạy ~20 KB trong database và ~30 lượt engine cho phép đo §30. Một
 * người trả lời thật hết bảng câu hỏi tốn dưới 30 lượt; số này chặn kịch bản
 * bấm lại liên tục mà không chặn ai dùng bình thường.
 */
const RUN_LIMIT_PER_HOUR = 80;

export class NoDatabaseError extends Error {
  constructor() {
    super("Chưa cấu hình database — không lưu được hồ sơ và lượt chạy.");
    this.name = "NoDatabaseError";
  }
}

function stores() {
  const db = recoDatabaseFromEnv();
  if (db === null) throw new NoDatabaseError();
  return { users: mysqlUserStore(db), runs: mysqlRunStore(db) };
}

export function recommenderStorageReady(): boolean {
  return recoDatabaseFromEnv() !== null;
}

/* ------------------------------------------------------------------ *
 * Cookie
 * ------------------------------------------------------------------ */

/**
 * Id ngẫu nhiên 128 bit, chữ và số — hợp với luật khoá của kho
 * (`store-keys.ts`) nên nó đi thẳng vào `user_id` mà không phải mã hoá lại.
 */
function newUserId(): string {
  return `u_${randomBytes(16).toString("hex")}`;
}

const ID_SHAPE = /^u_[0-9a-f]{32}$/;

export async function currentUserId(): Promise<string | null> {
  const value = (await cookies()).get(USER_COOKIE)?.value ?? null;
  return value !== null && ID_SHAPE.test(value) ? value : null;
}

/** Chỉ gọi được trong Server Action / Route Handler — xem tài liệu `cookies`. */
export async function startUserId(): Promise<string> {
  const id = newUserId();
  (await cookies()).set(USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return id;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(USER_COOKIE);
  jar.delete(SKIP_COOKIE);
}

/**
 * Những câu người dùng đã bỏ qua, theo `questionKey`.
 *
 * Nằm ở COOKIE chứ không ở database: "tôi không muốn trả lời câu này bây giờ"
 * là trạng thái của một phiên, không phải một dữ kiện về con người — và mô hình
 * người dùng cố ý không có chỗ cho những thứ như vậy (nó chỉ mô tả hoàn cảnh,
 * không mô tả thao tác).
 */
export async function skippedQuestions(): Promise<Set<string>> {
  const raw = (await cookies()).get(SKIP_COOKIE)?.value ?? "";
  return new Set(raw.split("|").filter((key) => key.length > 0 && key.length < 80));
}

/**
 * Trần của danh sách đã bỏ qua.
 *
 * Phải LỚN HƠN số câu hỏi engine có thể đặt ra (hôm nay: 21 chỗ trống hỏi
 * được, trong đó 17 hạng mục chi tiêu). Trần nhỏ hơn thì câu bị đẩy ra khỏi
 * danh sách sẽ được hỏi lại, và người bỏ qua đủ lâu rơi vào một vòng lặp
 * (Codex vòng 1, Phase 5 UI). Cookie ở mức này khoảng 2 KB — dưới trần 4 KB
 * của trình duyệt.
 */
const MAX_SKIPPED = 64;

export async function skipQuestion(key: string): Promise<void> {
  const jar = await cookies();
  const current = await skippedQuestions();
  current.add(key);
  const kept = [...current].slice(-MAX_SKIPPED);
  jar.set(SKIP_COOKIE, kept.join("|"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Người dùng sửa lại một câu đã trả lời thì nó thôi là "đã bỏ qua". */
export async function unskipQuestion(key: string): Promise<void> {
  const jar = await cookies();
  const current = await skippedQuestions();
  if (!current.delete(key)) return;
  jar.set(SKIP_COOKIE, [...current].join("|"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/* ------------------------------------------------------------------ *
 * Hồ sơ
 * ------------------------------------------------------------------ */

export async function loadState(userId: string): Promise<StoredUserState | null> {
  return stores().users.getStoredUserState(userId);
}

export async function createState(state: UserState): Promise<StoredUserState> {
  return stores().users.createUserState(state);
}

/**
 * Ghi hồ sơ mới. Xung đột version (hai tab cùng trả lời) thì đọc lại và thử
 * MỘT lần nữa với hàm áp câu trả lời — người dùng không phải làm lại.
 */
export async function saveState(
  userId: string,
  expectedVersion: number,
  next: UserState,
  reapply: (current: UserState) => UserState | null,
): Promise<StoredUserState | null> {
  const { users } = stores();
  try {
    return await users.replaceUserState(next, expectedVersion);
  } catch (error) {
    if (!(error instanceof UserStateConflictError)) throw error;
    const current = await users.getStoredUserState(userId);
    if (current === null) return null;
    const merged = reapply(current.state);
    if (merged === null) return null;
    return users.replaceUserState(merged, current.version);
  }
}

/* ------------------------------------------------------------------ *
 * Lượt chạy
 * ------------------------------------------------------------------ */

export interface RunContext {
  record: RecommendationRunRecord;
  dataset: RecommendationDataset;
}

/** Bộ dữ liệu của HÔM NAY — cùng nguồn mà trang thẻ và debugger dùng. */
export async function currentDataset(): Promise<{ data: RecommendationDataset; asOf: string }> {
  const asOf = todayInSiteZone();
  return { data: await repoDataSource.getDataset({ asOf }), asOf };
}

function runId(): string {
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14);
  return `run_${stamp}_${randomBytes(4).toString("hex")}`;
}

/**
 * Chạy engine cho một hồ sơ và LƯU lượt chạy.
 *
 * Hồ sơ hỏng vẫn chạy được (engine hứa không ném), nhưng ghi lại một lượt chạy
 * trên hồ sơ mà chính validator từ chối thì bản ghi đó không tái lập được — nên
 * chỗ này từ chối trước.
 */
export async function runAndSave(userId: string, state: UserState): Promise<RunContext> {
  const limit = rateLimit(`reco:run:${userId}`, RUN_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!limit.ok) throw new Error("Bạn vừa chạy quá nhiều lượt gợi ý — thử lại sau một lúc.");

  const { runs } = stores();
  const { data, asOf } = await currentDataset();
  const errors = validateUserState(state, data).filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(`Hồ sơ không hợp lệ: ${errors.map((issue) => issue.message).join("; ")}`);
  }
  const offerHistory = await loadOfferHistory(repoDataSource, data, asOf);
  const executed = executeRun(
    { state, data, asOf, offerHistory },
    { id: runId(), createdAt: new Date().toISOString(), userId },
  );
  await persistRun(runs, executed);
  return { record: executed.record, dataset: executed.dataset };
}

/**
 * Lượt chạy để HIỂN THỊ: lấy lại lượt gần nhất nếu nó còn nói về đúng hồ sơ
 * này, ngày này, engine này; nếu không thì chạy lại và lưu.
 *
 * Ba điều kiện, ba lý do khác nhau: hồ sơ đổi thì kết quả cũ không còn là câu
 * trả lời cho câu hỏi hiện tại; ngày đổi thì offer có thể đã hết hạn; version
 * đổi thì chính engine đã khác. Không kiểm bộ dữ liệu: nó đổi trong ngày (một
 * lần publish Contentful) mà khuyến nghị thì không cần chạy lại mỗi lần người
 * dùng bấm F5 — bản ghi mang dấu vân tay của bộ dữ liệu nó đã đọc, nên chuyện
 * này tra lại được.
 */
export async function runForDisplay(
  userId: string,
  stored: StoredUserState,
): Promise<RunContext> {
  const { runs } = stores();
  const [latest] = await runs.listRuns({ userId, limit: 1 });
  const asOf = todayInSiteZone();
  if (latest !== undefined && latest.asOf === asOf && latest.engineVersion === ENGINE_VERSION) {
    const record = await runs.getRun(latest.id);
    if (record !== null && record.inputSnapshot.stateFingerprint === fingerprint(stored.state)) {
      const dataset = await runs.getDataset(record.inputSnapshot.datasetFingerprint);
      if (dataset !== null) return { record, dataset };
    }
  }
  return runAndSave(userId, stored.state);
}

/* ------------------------------------------------------------------ *
 * Lời giải thích Phase 6
 * ------------------------------------------------------------------ */

/**
 * Trần gọi Claude cho lời giải thích.
 *
 * Mỗi lượt chạy chỉ cần MỘT lần gọi (bản đã lưu được đọc lại), nên trần theo
 * lượt chạy chỉ chặn vòng lặp F5 khi mô hình đang lỗi đường truyền — lỗi đó
 * không được lưu nên mỗi lần mở trang lại thử. Trần chung giới hạn hoá đơn khi
 * có ai bấm hàng loạt: quá trần thì trang dùng bảng tra, không ai thấy lỗi.
 */
const EXPLAIN_CALLS_PER_RUN_PER_HOUR = 3;
const EXPLAIN_CALLS_SITE_WIDE_PER_HOUR = 300;

export function explanationStore(): ExplanationStore | null {
  const db = recoDatabaseFromEnv();
  return db === null ? null : mysqlExplanationStore(db);
}

export function allowExplanationCall(runId: string): boolean {
  // Trần chung kiểm SAU trần theo lượt chạy: lượt đã bị chặn không được ăn vào
  // phần của người khác.
  return (
    rateLimit(`reco:explain:${runId}`, EXPLAIN_CALLS_PER_RUN_PER_HOUR, 60 * 60 * 1000).ok &&
    rateLimit("reco:explain:all", EXPLAIN_CALLS_SITE_WIDE_PER_HOUR, 60 * 60 * 1000).ok
  );
}
