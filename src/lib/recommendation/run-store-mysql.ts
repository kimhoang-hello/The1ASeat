/**
 * Kho `recommendation_runs` trên MySQL/MariaDB — backend thứ ba của `RunStore`,
 * và là kho của người dùng thật.
 *
 * Cùng hai luật với bộ nhớ và file (xem `run-store.ts`), và cưỡng chế bằng
 * KHOÁ CHÍNH chứ không bằng một phép "đọc xem có chưa rồi ghi": hai request
 * cùng lưu một id thì database cho đúng một cái qua, như cờ `wx` của kho file.
 *
 * Bản ghi lưu NGUYÊN VẸN dưới dạng gzip của `JSON.stringify(record)` — đúng
 * chuỗi kho file ghi ra đĩa, nên ba backend trả về cùng một thứ. ~200 KB một
 * lượt chạy còn ~19 KB; MariaDB không nén LONGTEXT hộ.
 */

import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import type { RowDataPacket } from "mysql2/promise";
import { isDuplicateKey, type RecoDatabase } from "./mysql.ts";
import { checkedDataset, checkedRunKeys, summarize, type RunStore, type RunSummary } from "./run-store.ts";
import { checkStoreKey } from "./store-keys.ts";
import type { RecommendationDataset } from "./types.ts";
import type { RecommendationRunRecord } from "./runs.ts";

const pack = promisify(gzip);
const unpack = promisify(gunzip);

async function readBody<T>(body: Buffer): Promise<T> {
  return JSON.parse((await unpack(body)).toString("utf8")) as T;
}

export function mysqlRunStore(db: RecoDatabase): RunStore {
  const { pool } = db;
  return {
    async saveDataset(fingerprint, dataset) {
      const canonical = checkedDataset(fingerprint, dataset);
      await db.ready();
      try {
        await pool.query("INSERT INTO reco_datasets (fingerprint, body) VALUES (?, ?)", [
          fingerprint,
          await pack(canonical),
        ]);
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        // Đã có: phải là CÙNG nội dung. Khác là va chạm băm — nổ, không đè.
        const [rows] = await pool.query<RowDataPacket[]>(
          "SELECT body FROM reco_datasets WHERE fingerprint = ?",
          [fingerprint],
        );
        const existing = (await unpack(rows[0].body as Buffer)).toString("utf8");
        if (existing !== canonical) {
          throw new Error(`saveDataset: va chạm dấu vân tay ${fingerprint} — hai nội dung khác nhau`);
        }
      }
    },
    async getDataset(fingerprint) {
      checkStoreKey(fingerprint, "dấu vân tay");
      await db.ready();
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT body FROM reco_datasets WHERE fingerprint = ?",
        [fingerprint],
      );
      return rows.length === 0 ? null : readBody<RecommendationDataset>(rows[0].body as Buffer);
    },
    async saveRun(record) {
      checkedRunKeys(record);
      const summary = summarize(record);
      await db.ready();
      try {
        await pool.query(
          `INSERT INTO reco_runs
             (id, user_id, created_at, data_snapshot_at, engine_version, rule_version,
              dataset_fingerprint, primary_action, confidence, body)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            summary.id,
            summary.userId,
            summary.createdAt,
            summary.asOf,
            summary.engineVersion,
            summary.ruleVersion,
            record.inputSnapshot.datasetFingerprint,
            summary.primary,
            summary.confidence,
            await pack(JSON.stringify(record)),
          ],
        );
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new Error(`saveRun: lượt chạy ${record.id} đã có — kho chỉ thêm, không ghi đè`);
        }
        throw error;
      }
    },
    async getRun(id) {
      checkStoreKey(id, "id lượt chạy");
      await db.ready();
      const [rows] = await pool.query<RowDataPacket[]>("SELECT body FROM reco_runs WHERE id = ?", [id]);
      return rows.length === 0 ? null : readBody<RecommendationRunRecord>(rows[0].body as Buffer);
    },
    async listRuns(filter = {}) {
      if (filter.userId !== undefined) checkStoreKey(filter.userId, "userId");
      if (filter.limit !== undefined && !(Number.isSafeInteger(filter.limit) && filter.limit >= 0)) {
        throw new Error(`listRuns: limit phải là số nguyên không âm (nhận ${filter.limit})`);
      }
      await db.ready();
      // Cột `_bin` so theo mã ký tự — cùng thứ tự với phép so chuỗi của
      // `newestFirst` trên mọi `createdAt` ISO, nên ba backend trả cùng một
      // thứ tự. Hoà thì theo id, cũng như ở đó.
      const where = filter.userId === undefined ? "" : "WHERE user_id = ?";
      const limit = filter.limit === undefined ? "" : `LIMIT ${filter.limit}`;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, user_id, created_at, data_snapshot_at, engine_version, rule_version,
                primary_action, confidence
           FROM reco_runs ${where}
          ORDER BY created_at DESC, id DESC ${limit}`,
        filter.userId === undefined ? [] : [filter.userId],
      );
      return rows.map(
        (row): RunSummary => ({
          id: row.id,
          userId: row.user_id,
          createdAt: row.created_at,
          asOf: row.data_snapshot_at,
          engineVersion: row.engine_version,
          ruleVersion: row.rule_version,
          primary: row.primary_action,
          confidence: row.confidence,
        }),
      );
    },
  };
}
