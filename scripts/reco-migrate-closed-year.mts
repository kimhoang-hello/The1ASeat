/**
 * Chạy MỘT LẦN sau khi deploy câu hỏi "tháng đóng thẻ": xoá các ngày đóng thẻ
 * mà câu hỏi "NĂM đóng thẻ" cũ đã ghi, để trang hỏi lại bằng tháng.
 *
 *   npx tsx scripts/reco-migrate-closed-year.mts            # chạy thử, chỉ đếm
 *   npx tsx scripts/reco-migrate-closed-year.mts --confirm  # ghi thật
 *
 * Vì sao: từ 15/09/2026 câu hỏi năm ghi mọi năm cũ thành `YYYY-06-30`. Luật
 * "không có bonus nếu từng giữ trong 24 tháng" đọc ngày đó như ngày thật, nên
 * người đóng Scotiabank® tháng 12/2024 mà đã trả lời "2024" được kết luận là
 * ngoài cửa sổ và được hứa bonus ngân hàng sẽ từ chối (vòng Codex 3,
 * 21/09/2026). Không có trường nào nói ngày đó đến từ câu hỏi năm, nên chỉ có
 * thể sửa bằng một lượt quét lúc chuyển phiên bản.
 *
 * Nhận diện: thẻ không còn giữ, `closedDate` dạng `YYYY-06-30` với YYYY ≤ 2025.
 * Câu hỏi năm chỉ sống trong năm 2026 và ghi năm HIỆN TẠI thành chính ngày trả
 * lời, nên mọi `…-06-30` của năm trước đều từ nó. Câu hỏi tháng mới cũng ghi
 * được `2025-06-30` (tháng 6/2025) — chạy script trễ thì những câu trả lời đó
 * bị hỏi lại một lần. Vô hại, và là lý do nên chạy ngay sau deploy.
 *
 * Đặt về `null` chứ không đoán một ngày khác: `null` sinh lại chỗ trống
 * `card_closed_date_unknown`, engine coi là CHƯA BIẾT, và trang hỏi lại.
 *
 * Ghi có điều kiện theo `version` như mọi lần ghi khác của kho — người dùng
 * đang trả lời dở thì dòng của họ bị bỏ qua, chạy lại script là xong.
 */

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { recoDatabaseFromEnv } from "../src/lib/recommendation/mysql.ts";
import { serializeUserState } from "../src/lib/recommendation/user-source.ts";
import type { UserState } from "../src/lib/recommendation/user-types.ts";

const confirm = process.argv.slice(2).includes("--confirm");
const LEGACY = /^(\d{4})-06-30$/;

const db = recoDatabaseFromEnv();
if (db === null) {
  console.error("Không có biến database (DATABASE_URL hoặc bộ DB_*). Chạy ở nơi có kết nối tới database production.");
  process.exit(1);
}
await db.ready();

const [rows] = await db.pool.query<RowDataPacket[]>("SELECT user_id, version, state FROM reco_user_states");
let touched = 0;
let cards = 0;
let conflicts = 0;
let unreadable = 0;

/** Hồ sơ hỏng thì BỎ QUA và báo, không để một dòng xấu dừng script giữa chừng. */
function parse(raw: unknown): UserState | null {
  try {
    const value = JSON.parse(String(raw)) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UserState) : null;
  } catch {
    return null;
  }
}

for (const row of rows) {
  const state = parse(row.state);
  if (state === null) {
    unreadable += 1;
    console.log(`${row.user_id as string}: hồ sơ không đọc được — bỏ qua`);
    continue;
  }
  let changed = 0;
  for (const card of Array.isArray(state.cards) ? state.cards : []) {
    // Chỉ hai status "không còn giữ" hợp lệ. Status lạ là dữ liệu hỏng, không
    // phải việc của script này.
    const past = card?.status === "closed" || card?.status === "previously_held";
    const match = past && typeof card.closedDate === "string" ? LEGACY.exec(card.closedDate) : null;
    if (match !== null && Number(match[1]) <= 2025) {
      card.closedDate = null;
      changed += 1;
    }
  }
  if (changed === 0) continue;
  touched += 1;
  cards += changed;
  console.log(`${row.user_id as string}: ${changed} thẻ`);
  if (!confirm) continue;
  const { json } = serializeUserState(state);
  const [result] = await db.pool.query<ResultSetHeader>(
    `UPDATE reco_user_states
        SET state = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP(3)
      WHERE user_id = ? AND version = ?`,
    [json, row.user_id, row.version],
  );
  if (result.affectedRows !== 1) conflicts += 1;
}

console.log(`\n${rows.length} hồ sơ · ${touched} hồ sơ có ngày kiểu cũ · ${cards} thẻ · ${unreadable} không đọc được`);
if (!confirm) console.log("CHẠY THỬ — chưa ghi gì. Thêm --confirm để ghi.");
else if (conflicts > 0) console.log(`✗ ${conflicts} hồ sơ đổi trong lúc chạy — chạy lại script.`);
else console.log("✓ xong");
await db.close();
process.exit(conflicts > 0 ? 1 : 0);
