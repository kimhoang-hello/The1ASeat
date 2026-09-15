/**
 * Kho `recommendation_runs` trên đĩa — cho debugger chạy cục bộ và cho CLI.
 *
 * Tách khỏi `run-store.ts` vì file này import `node:fs`: để chung thì bất kỳ
 * component nào lỡ import kho trong bộ nhớ cũng kéo `fs` vào bundle trình
 * duyệt.
 *
 * Bố cục: `<dir>/runs/<id>.json` và `<dir>/datasets/<vân tay>.json`. Mở file
 * bằng cờ `wx` (tạo mới, lỗi nếu đã có) — luật "không ghi đè" được cưỡng chế
 * bởi HỆ ĐIỀU HÀNH, không bởi một phép kiểm tồn tại rồi mới ghi (hai tiến
 * trình cùng kiểm thì cùng thấy "chưa có").
 *
 * HỆ THỐNG FILE CÓ THỂ KHÔNG PHÂN BIỆT HOA THƯỜNG (APFS mặc định của macOS):
 * `Run_A.json` và `run_a.json` là MỘT file. Nên mọi lần đọc đối chiếu `id`
 * trong bản ghi với id được hỏi, và một lần lưu đụng file của id khác thì nổ
 * đích danh — kho này không được trả về lượt chạy của người khác. Hai kho kia
 * lưu được cả hai id; kho này từ chối id thứ hai (xem `stores.test.ts`).
 *
 * KHÔNG phải kho production. Site deploy lên Hostinger, và đĩa ở đó không hứa
 * sống sót qua một lần deploy. Đây là kho của admin trên máy mình; kho của
 * người dùng thật là `run-store-mysql.ts`.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkedDataset, checkedRunKeys, checkListFilter, newestFirst, summarize, type RunStore } from "./run-store.ts";
import { checkStoreKey } from "./store-keys.ts";
import type { RecommendationDataset } from "./types.ts";
import type { RecommendationRunRecord } from "./runs.ts";

/** Id đi vào tên file NGUYÊN VẸN — luật chung của mọi kho, xem `store-keys.ts`. */
function safeName(value: string): string {
  return checkStoreKey(value, "id");
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function fileRunStore(dir: string): RunStore {
  const runsDir = path.join(dir, "runs");
  const datasetsDir = path.join(dir, "datasets");
  return {
    async saveDataset(fingerprint, dataset) {
      const canonical = checkedDataset(fingerprint, dataset);
      await mkdir(datasetsDir, { recursive: true });
      const file = path.join(datasetsDir, `${safeName(fingerprint)}.json`);
      try {
        await writeFile(file, canonical, { encoding: "utf8", flag: "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        // Đã có: phải là CÙNG nội dung. Khác là va chạm băm — nổ, không đè.
        const existing = await readFile(file, "utf8");
        if (existing !== canonical) {
          throw new Error(`saveDataset: va chạm dấu vân tay ${fingerprint} — hai nội dung khác nhau`);
        }
      }
    },
    async getDataset(fingerprint) {
      return readJson<RecommendationDataset>(path.join(datasetsDir, `${safeName(fingerprint)}.json`));
    },
    async saveRun(record) {
      checkedRunKeys(record);
      await mkdir(runsDir, { recursive: true });
      const file = path.join(runsDir, `${safeName(record.id)}.json`);
      try {
        await writeFile(file, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await readJson<RecommendationRunRecord>(file);
        if (existing !== null && existing.id !== record.id) {
          throw new Error(
            `saveRun: ${record.id} rơi vào CÙNG file với lượt chạy ${existing.id} — hệ thống file không phân biệt hoa thường`,
          );
        }
        throw new Error(`saveRun: lượt chạy ${record.id} đã có — kho chỉ thêm, không ghi đè`);
      }
    },
    async getRun(id) {
      const record = await readJson<RecommendationRunRecord>(path.join(runsDir, `${safeName(id)}.json`));
      // File của một id khác hoa thường — với id được hỏi, lượt chạy này không tồn tại.
      return record !== null && record.id !== id ? null : record;
    },
    async listRuns(filter = {}) {
      checkListFilter(filter);
      let names: string[];
      try {
        names = (await readdir(runsDir)).filter((name) => name.endsWith(".json"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
      const rows = [];
      for (const name of names) {
        const record = await readJson<RecommendationRunRecord>(path.join(runsDir, name));
        if (record !== null) rows.push(summarize(record));
      }
      const all = rows
        .filter((row) => filter.userId === undefined || row.userId === filter.userId)
        .sort(newestFirst);
      return filter.limit === undefined ? all : all.slice(0, filter.limit);
    },
  };
}
