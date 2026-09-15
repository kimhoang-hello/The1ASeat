/**
 * Kho `recommendation_runs` — CHỈ THÊM, không sửa.
 *
 * Phase 2 và 3 chỉ đọc; đây là chỗ đầu tiên của cả dự án cần GHI thật, nên
 * hợp đồng ghi được viết cho hai backend ngay từ đầu (bộ nhớ + file) thay vì
 * một. Bài học của Phase 1–3: một interface chưa từng chạy với backend thứ hai
 * là rủi ro lớn nhất còn lại, và bản file ở `run-store-fs.ts` đi qua JSON THẬT
 * — đúng chỗ `Map`, `undefined` và `-0` biến dạng.
 *
 * Bảng `recommendation_runs` ghi nhiều, đọc ít, không join — nên nó KHÔNG ép
 * lựa chọn database nào. Chọn backend cho dữ liệu người dùng là quyết định
 * riêng; interface này đủ hẹp để một bản Postgres/MySQL chỉ là thêm một file.
 *
 * HAI LUẬT, cưỡng chế ở MỌI backend:
 *
 *  1. **Lượt chạy không bị ghi đè.** `saveRun` với một `id` đã có là LỖI.
 *     Sửa một lượt chạy cũ là xoá bằng chứng của đúng câu hỏi §20 sinh ra để
 *     trả lời.
 *  2. **Bộ dữ liệu khoá theo nội dung.** `saveDataset` tính lại dấu vân tay và
 *     từ chối nếu không khớp khoá được đưa vào; trùng khoá mà khác nội dung
 *     (va chạm băm) cũng là LỖI, không phải một lần ghi đè im lặng.
 */

import { canonicalJson, fingerprintOf } from "./fingerprint.ts";
import { checkStoreKey } from "./store-keys.ts";
import type { RecommendationDataset } from "./types.ts";
import type { RecommendationRunRecord } from "./runs.ts";

/** Một dòng trong danh sách — đủ để chọn lượt nào mở ra xem. */
export interface RunSummary {
  id: string;
  userId: string | null;
  createdAt: string;
  asOf: string;
  engineVersion: string;
  ruleVersion: string;
  /** Slug người thắng của mục tiêu đầu, hoặc `NO_NEW_CARD`. */
  primary: string | null;
  confidence: string | null;
}

export interface RunStore {
  saveDataset(fingerprint: string, dataset: RecommendationDataset): Promise<void>;
  getDataset(fingerprint: string): Promise<RecommendationDataset | null>;
  saveRun(record: RecommendationRunRecord): Promise<void>;
  getRun(id: string): Promise<RecommendationRunRecord | null>;
  /** Mới nhất trước. */
  listRuns(filter?: { userId?: string; limit?: number }): Promise<RunSummary[]>;
}

export function summarize(record: RecommendationRunRecord): RunSummary {
  const first = record.outputSnapshot.results[0];
  return {
    id: record.id,
    userId: record.userId,
    createdAt: record.createdAt,
    asOf: record.dataSnapshotAt,
    engineVersion: record.engineVersion,
    ruleVersion: record.ruleVersion,
    primary:
      first === undefined
        ? null
        : first.primaryAction.kind === "no_new_card"
          ? "NO_NEW_CARD"
          : first.primaryAction.productSlug,
    confidence: first?.confidence.level ?? null,
  };
}

/**
 * Kiểm một bộ dữ liệu trước khi lưu theo khoá: trả về chuỗi chuẩn hoá để
 * backend ghi thẳng, khỏi băm hai lần.
 */
export function checkedDataset(fingerprint: string, dataset: RecommendationDataset): string {
  checkStoreKey(fingerprint, "dấu vân tay");
  const canonical = canonicalJson(dataset);
  const actual = fingerprintOf(canonical);
  if (actual !== fingerprint) {
    throw new Error(`saveDataset: khoá ${fingerprint} không phải dấu vân tay của nội dung (${actual})`);
  }
  return canonical;
}

/**
 * Khoá của một bản ghi — kiểm ở MỌI backend, kể cả bộ nhớ: một id kho này
 * nhận mà kho kia từ chối là bản ghi không chuyển được giữa hai kho.
 */
export function checkedRunKeys(record: RecommendationRunRecord): void {
  checkStoreKey(record.id, "id lượt chạy");
  if (record.userId !== null) checkStoreKey(record.userId, "userId");
}

/** Sắp mới nhất trước, hoà thì theo id — thứ tự cố định cho cùng một kho. */
export function newestFirst(a: RunSummary, b: RunSummary): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Kho trong bộ nhớ. Lưu CHUỖI JSON, không lưu object: trả về object gốc thì
 * người gọi sửa được bản ghi đã lưu qua một tham chiếu — đúng thứ luật "không
 * ghi đè" cấm, chỉ bằng một đường khác. Cùng lý do `inMemoryUserStore` trả
 * về bản sao.
 */
export function inMemoryRunStore(): RunStore {
  const datasets = new Map<string, string>();
  const runs = new Map<string, string>();
  return {
    async saveDataset(fingerprint, dataset) {
      const canonical = checkedDataset(fingerprint, dataset);
      const existing = datasets.get(fingerprint);
      if (existing !== undefined && existing !== canonical) {
        throw new Error(`saveDataset: va chạm dấu vân tay ${fingerprint} — hai nội dung khác nhau`);
      }
      datasets.set(fingerprint, canonical);
    },
    async getDataset(fingerprint) {
      checkStoreKey(fingerprint, "dấu vân tay");
      const raw = datasets.get(fingerprint);
      return raw === undefined ? null : (JSON.parse(raw) as RecommendationDataset);
    },
    async saveRun(record) {
      checkedRunKeys(record);
      if (runs.has(record.id)) throw new Error(`saveRun: lượt chạy ${record.id} đã có — kho chỉ thêm, không ghi đè`);
      runs.set(record.id, JSON.stringify(record));
    },
    async getRun(id) {
      checkStoreKey(id, "id lượt chạy");
      const raw = runs.get(id);
      return raw === undefined ? null : (JSON.parse(raw) as RecommendationRunRecord);
    },
    async listRuns(filter = {}) {
      if (filter.userId !== undefined) checkStoreKey(filter.userId, "userId");
      const all = [...runs.values()]
        .map((raw) => summarize(JSON.parse(raw) as RecommendationRunRecord))
        .filter((row) => filter.userId === undefined || row.userId === filter.userId)
        .sort(newestFirst);
      return filter.limit === undefined ? all : all.slice(0, filter.limit);
    },
  };
}
