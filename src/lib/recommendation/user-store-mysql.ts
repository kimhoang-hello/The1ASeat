/**
 * Trạng thái người dùng trên MySQL/MariaDB — bản database của `UserStateStore`.
 *
 * Một dòng mỗi người: `UserState` nguyên khối (JSON chuẩn hoá) cộng `version`.
 * Không tách ra năm bảng như spec §4 vẽ: engine đọc và bảng câu hỏi ghi đúng
 * MỘT khối, validator kiểm đúng một khối, và mỗi bảng thêm là một phép dịch
 * hàng ↔ object có thể lệch (Phase 1 đã trả giá cho phép dịch viết tay ba lần).
 * Muốn đếm "bao nhiêu người đang giữ thẻ X" thì đọc từ `reco_runs`, nơi mỗi
 * lượt chạy đã chép nguyên trạng thái nó đọc.
 *
 * Ghi có điều kiện bằng CHÍNH câu UPDATE (`WHERE version = ?`) chứ không bằng
 * đọc-rồi-ghi: hai request cùng mang version 3 thì đúng một cái đổi được dòng.
 */

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { isDuplicateKey, type RecoDatabase } from "./mysql.ts";
import { checkStoreKey } from "./store-keys.ts";
import {
  checkExpectedVersion,
  serializeUserState,
  UserStateConflictError,
  type StoredUserState,
  type UserStateStore,
} from "./user-source.ts";
import type { UserState } from "./user-types.ts";

export function mysqlUserStore(db: RecoDatabase): UserStateStore {
  const { pool } = db;

  async function read(userId: string): Promise<StoredUserState | null> {
    checkStoreKey(userId, "userId");
    await db.ready();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT version, state FROM reco_user_states WHERE user_id = ?",
      [userId],
    );
    if (rows.length === 0) return null;
    return { state: JSON.parse(rows[0].state as string) as UserState, version: Number(rows[0].version) };
  }

  return {
    async getUserState(userId) {
      return (await read(userId))?.state ?? null;
    },
    getStoredUserState: read,
    async createUserState(state) {
      const { userId, json } = serializeUserState(state);
      await db.ready();
      try {
        await pool.query("INSERT INTO reco_user_states (user_id, version, state) VALUES (?, 1, ?)", [userId, json]);
      } catch (error) {
        if (isDuplicateKey(error)) throw new Error(`createUserState: người dùng ${userId} đã có — không ghi đè`);
        throw error;
      }
      return { state: JSON.parse(json) as UserState, version: 1 };
    },
    async replaceUserState(state, expectedVersion) {
      checkExpectedVersion(expectedVersion);
      const { userId, json } = serializeUserState(state);
      await db.ready();
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE reco_user_states
            SET state = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP(3)
          WHERE user_id = ? AND version = ?`,
        [json, userId, expectedVersion],
      );
      // `affectedRows`, không phải `changedRows`: `version` luôn tăng nên dòng
      // khớp luôn là dòng đổi — nhưng nếu một ngày ai đó bỏ vế tăng version,
      // `changedRows` sẽ báo xung đột cho mọi lần ghi lại cùng nội dung.
      if (result.affectedRows !== 1) {
        const current = await read(userId);
        throw new UserStateConflictError(userId, expectedVersion, current?.version ?? null);
      }
      return { state: JSON.parse(json) as UserState, version: expectedVersion + 1 };
    },
  };
}
