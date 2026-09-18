/**
 * Xoá dữ liệu công cụ gợi ý của MỘT người, theo yêu cầu của chính họ.
 *
 *   npm run reco:forget -- <user-id | run-id>            # chạy thử, chỉ đếm
 *   npm run reco:forget -- <user-id | run-id> --confirm  # xoá thật
 *
 * Vì sao có script này: trang `/privacy` hứa xoá hồ sơ khi người đọc yêu cầu,
 * mà kho lượt chạy (§20) CHỈ THÊM và không có đường xoá — một lời hứa không
 * thực thi được thì tệ hơn không hứa (rà production 17/09/2026). Người đọc chỉ
 * có trong tay MÃ TRA CỨU in dưới mỗi kết quả (`run_…`), nên script nhận cả
 * run-id: nó tra ra `user_id` của lượt chạy đó rồi xoá theo người.
 *
 * Xoá theo đúng thứ tự khoá ngoại: lời giải thích → lượt chạy → hồ sơ. Bộ dữ
 * liệu (`reco_datasets`) KHÔNG xoá: nó là bản chụp dữ liệu thẻ dùng chung cho
 * mọi người, không có gì của riêng ai.
 *
 * Mặc định là CHẠY THỬ. Xoá là không lùi được, và `--confirm` là chỗ người chạy
 * ký tên vào việc đó.
 */

import type { RowDataPacket } from "mysql2/promise";
import { recoDatabaseFromEnv } from "../src/lib/recommendation/mysql.ts";

const [ref, ...rest] = process.argv.slice(2);
const confirm = rest.includes("--confirm");

if (!ref) {
  console.error("Thiếu tham số. Dùng: npm run reco:forget -- <user-id | run-id> [--confirm]");
  process.exit(1);
}

const db = recoDatabaseFromEnv();
if (db === null) {
  console.error(
    "Không có biến database (DATABASE_URL hoặc bộ DB_*). Chạy script này ở nơi có kết nối tới database production.",
  );
  process.exit(1);
}

await db.ready();

/** Mã tra cứu của người dùng là `run_…`; hồ sơ là `u_…`. */
async function resolveUserId(value: string): Promise<string | null> {
  if (value.startsWith("u_")) return value;
  const [rows] = await db!.pool.query<RowDataPacket[]>("SELECT user_id FROM reco_runs WHERE id = ?", [value]);
  const found = (rows[0]?.user_id as string | null | undefined) ?? null;
  if (found === null) console.error(`Lượt chạy ${value} không có (hoặc không gắn với người dùng nào).`);
  return found;
}

const userId = await resolveUserId(ref);
if (userId === null) {
  await db.close();
  process.exit(1);
}

const count = async (sql: string) => {
  const [rows] = await db!.pool.query<RowDataPacket[]>(sql, [userId]);
  return Number(rows[0]?.n ?? 0);
};

const runs = await count("SELECT COUNT(*) AS n FROM reco_runs WHERE user_id = ?");
const explanations = await count(
  "SELECT COUNT(*) AS n FROM reco_explanations WHERE run_id IN (SELECT id FROM reco_runs WHERE user_id = ?)",
);
const states = await count("SELECT COUNT(*) AS n FROM reco_user_states WHERE user_id = ?");

console.log(`Người dùng ${userId}: ${states} hồ sơ · ${runs} lượt chạy · ${explanations} lời giải thích`);

if (states + runs + explanations === 0) {
  console.log("Không có gì để xoá.");
  await db.close();
  process.exit(0);
}

if (!confirm) {
  console.log("\nCHẠY THỬ — chưa xoá gì. Thêm --confirm để xoá thật (không lùi được).");
  await db.close();
  process.exit(0);
}

// Thứ tự theo khoá ngoại: `reco_explanations.run_id` trỏ vào `reco_runs.id`.
await db.pool.query(
  "DELETE FROM reco_explanations WHERE run_id IN (SELECT id FROM reco_runs WHERE user_id = ?)",
  [userId],
);
await db.pool.query("DELETE FROM reco_runs WHERE user_id = ?", [userId]);
await db.pool.query("DELETE FROM reco_user_states WHERE user_id = ?", [userId]);

const left = (await count("SELECT COUNT(*) AS n FROM reco_runs WHERE user_id = ?")) +
  (await count("SELECT COUNT(*) AS n FROM reco_user_states WHERE user_id = ?"));
console.log(left === 0 ? `✓ đã xoá toàn bộ dữ liệu của ${userId}` : `✗ còn ${left} dòng của ${userId}`);
await db.close();
process.exit(left === 0 ? 0 : 1);
