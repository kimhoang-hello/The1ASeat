/**
 * §20 `recommendation_runs` — một lượt chạy được LƯU, CHẠY LẠI và SO SÁNH.
 *
 * Ba lời hứa, và file này tồn tại để giữ chúng:
 *
 *  1. **Tái lập được.** Bản ghi mang đủ đầu vào để chạy lại ra ĐÚNG đầu ra đã
 *     lưu, tới từng chữ số — không chỉ `{ asOf, knownAt }`. README Phase 1 đã
 *     nói thẳng giới hạn: đóng một dòng cũ là SỬA dòng đó, nên `datasetAt`
 *     dựng lại một ngày trước lần đóng sẽ thấy dòng đã đóng. Bản chụp đã lưu
 *     luôn đúng hơn mọi phép dựng lại.
 *  2. **Có version.** `engineVersion` (logic) và `ruleVersion` (luật biên tập)
 *     tách nhau, và dấu vân tay nội dung của từng đầu vào đi kèm — để "vì sao
 *     khuyến nghị tháng này khác tháng trước" có câu trả lời bằng dữ kiện:
 *     offer đổi, luật đổi, dữ liệu đổi, hay người dùng khai khác.
 *  3. **Không lưu một đằng, chạy một nẻo.** Engine chạy trên bản đầu vào ĐÃ
 *     ĐI QUA JSON — đúng bản sẽ nằm trong kho. Chạy trên object gốc rồi lưu
 *     bản JSON của nó thì mọi khác biệt giữa hai thứ (`undefined` biến mất,
 *     `-0` thành `0`) là một lượt chạy không tái lập được, và không ai biết
 *     tại sao.
 *
 * Mọi hàm ở đây THUẦN. `id` và `createdAt` do người gọi đưa vào — engine
 * không gọi đồng hồ, không sinh số ngẫu nhiên (§35), và bản ghi của nó cũng
 * không được làm vậy.
 */

import { canonicalJson, fingerprint, fingerprintOf } from "./fingerprint.ts";
import { indexDataset } from "./indexes.ts";
import { datasetAt } from "./temporal.ts";
import { historyCutoff } from "./offer-history.ts";
import { ENGINE_VERSION, recommend } from "./engine.ts";
import { RULE_VERSION } from "./rules.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { RecommendationDataset } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { DerivedState, RecommendationRun } from "./engine-types.ts";

/** Đầu ra §18 — mọi thứ trừ `derived`, thứ đi vào cột riêng. */
export type RecommendationOutput = Omit<RecommendationRun, "derived">;

/** Lịch sử offer ở dạng lưu được: danh sách đã sắp theo `productId`. */
export interface OfferHistoryEntry {
  productId: string;
  points: OfferHistoryPoint[];
}

/**
 * `input_snapshot` của §20.
 *
 * Bộ dữ liệu KHÔNG nằm ở đây, chỉ dấu vân tay của nó. Nó nặng ~300 KB và gần
 * như mọi lượt chạy trong cùng một ngày dùng CÙNG một bộ — lưu kèm từng lượt
 * là chép lại hàng nghìn lần một thứ không đổi. Kho lưu giữ nó MỘT lần theo
 * dấu vân tay (`RunStore.saveDataset`), và vì khoá chính là băm của nội dung
 * nên bản đã lưu không thể bị sửa mà khoá vẫn đứng yên: đó là cam kết bất biến
 * mà một cột `data_snapshot_at` một mình không cho được.
 *
 * `offerHistory` thì Ở ĐÂY, và là thứ dễ quên nhất: nó là THAM SỐ của
 * `recommend()`, không nằm trong `RecommendationDataset`, và thiếu nó thì
 * percentile §12 chạy lại ra khác.
 */
export interface InputSnapshot {
  asOf: string;
  /** Trục thời gian ghi nhận — `null` = lấy mọi bản ghi đã có. */
  knownAt: string | null;
  state: UserState;
  stateFingerprint: string;
  datasetFingerprint: string;
  offerHistory: OfferHistoryEntry[];
  offerHistoryFingerprint: string;
}

/** Một dòng `recommendation_runs`, đúng các cột của §20. */
export interface RecommendationRunRecord {
  id: string;
  userId: string | null;
  engineVersion: string;
  ruleVersion: string;
  /** = `asOf`: thế giới được nhìn ở ngày nào. */
  dataSnapshotAt: string;
  inputSnapshot: InputSnapshot;
  derivedState: DerivedState;
  outputSnapshot: RecommendationOutput;
  /**
   * Dấu vân tay của `derivedState` + `outputSnapshot` LÚC LƯU. Không phải cột
   * của spec: nó tách "bản ghi hỏng trong kho" khỏi "engine chạy lại ra khác"
   * — thiếu nó, một điểm số bị sửa trong kho làm replay báo HỒI QUY dưới cùng
   * version, và admin đi tìm lỗi trong engine (vòng Codex 17).
   *
   * VẮNG ở bản ghi tạo trước khi có trường này (ENGINE_VERSION < 4.19.0): khi
   * đó kết quả đã lưu không kiểm được, và `ReplayResult.resultVerified` nói ra
   * — chứ không kết luận bản ghi hỏng (vòng Codex 18).
   */
  resultFingerprint?: string;
  createdAt: string;
}

export interface RunInput {
  state: UserState;
  /** Bộ dữ liệu ĐÃ CẮT theo `asOf`/`knownAt` — đúng thứ engine đọc. */
  data: RecommendationDataset;
  asOf: string;
  knownAt?: string | null;
  offerHistory?: ReadonlyMap<string, OfferHistoryPoint[]>;
}

export interface RunMeta {
  id: string;
  createdAt: string;
  userId?: string | null;
}

export interface ExecutedRun {
  run: RecommendationRun;
  record: RecommendationRunRecord;
  /** Bộ dữ liệu ĐÚNG như engine đã đọc — thứ phải lưu theo `datasetFingerprint`. */
  dataset: RecommendationDataset;
}

function historyEntries(history: ReadonlyMap<string, OfferHistoryPoint[]> | undefined): OfferHistoryEntry[] {
  return [...(history ?? new Map<string, OfferHistoryPoint[]>())]
    .map(([productId, points]) => ({ productId, points }))
    .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));
}

function historyMap(entries: readonly OfferHistoryEntry[]): Map<string, OfferHistoryPoint[]> {
  return new Map(entries.map((entry) => [entry.productId, entry.points]));
}

/** Đi qua JSON chuẩn hoá rồi quay lại — kèm chính chuỗi đó để khỏi băm hai lần. */
function throughJson<T>(value: T): { value: T; canonical: string } {
  const canonical = canonicalJson(value);
  return { value: JSON.parse(canonical) as T, canonical };
}

/** Version đầu tiên mọi bản ghi đều mang `resultFingerprint`. */
const RESULT_FINGERPRINT_SINCE = "4.19.0";

/** `a` < `b` theo semver số (không có nhãn tiền phát hành). */
function olderThan(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}

function resultFingerprintOf(derived: DerivedState, output: RecommendationOutput): string {
  return fingerprint({ d: derived, o: output });
}

function splitRun(run: RecommendationRun): { output: RecommendationOutput; derived: DerivedState } {
  const { derived, ...output } = run;
  return { output, derived };
}

/**
 * Chạy engine VÀ dựng bản ghi §20 cho chính lượt chạy đó.
 *
 * Engine chạy trên đầu vào ĐÃ đi qua JSON — xem lời hứa 3 ở đầu file. Nên
 * `run` trả về ở đây có thể khác (ở chỗ `undefined`/`-0`) so với một lượt
 * `recommend()` gọi thẳng trên object gốc, và `runs.test.ts` đòi hai thứ đó
 * BẰNG NHAU trên mọi nhân vật: nếu có lúc chúng khác, engine đang đọc một
 * khác biệt mà JSON xoá mất, và đó là một lỗi của engine, không phải của kho.
 */
export function executeRun(input: RunInput, meta: RunMeta): ExecutedRun {
  const state = throughJson(input.state);
  const data = throughJson(input.data);
  const history = throughJson(historyEntries(input.offerHistory));
  const knownAt = input.knownAt ?? null;

  // Bộ dữ liệu không được mang dòng mà `asOf`/`knownAt` bản ghi khai chưa thể
  // thấy — cắt lại lần nữa phải ra y hệt. Không kiểm thì một người gọi truyền
  // bộ CHƯA cắt, bản ghi nói "biết tới ngày X" trong khi engine đã đọc cả đính
  // chính nhập sau X (vòng rà Phase 4).
  //
  // Giới hạn, nói thẳng: phép này bắt dòng THỪA, không bắt được bộ bị cắt
  // THIẾU (cắt ở một ngày sớm hơn, hay lịch sử thiếu một mốc) — dòng đã mất
  // không dựng lại được từ chính bộ đó (vòng Codex 18). Bộ thiếu vẫn được ghi
  // đúng dấu vân tay của thứ engine đã đọc, nên `diff` giữa hai lượt chạy chỉ
  // ra dòng nào vắng; lời hứa "đủ" thuộc về nguồn (`getDataset`,
  // `loadOfferHistory`), không thuộc về chỗ này.
  // Cùng lý do cho lịch sử offer: nó là THAM SỐ, và một điểm ghi sau ngày cắt
  // (hay một `until` biết trước lần ghi kế tiếp) là tương lai lọt vào §12.
  const cutoff = historyCutoff(input.asOf, knownAt);
  for (const entry of history.value) {
    for (const point of entry.points) {
      if (point.at > cutoff || (point.until !== null && point.until > cutoff)) {
        throw new Error(
          `executeRun: lịch sử offer của ${entry.productId} có mốc sau ngày cắt ${cutoff} ` +
            `(${point.at}${point.until === null ? "" : ` → ${point.until}`}) — nạp bằng loadOfferHistory của đúng hai ngày đó.`,
        );
      }
    }
  }
  const recut = canonicalJson(datasetAt(data.value, input.asOf, knownAt === null ? {} : { knownAt }));
  if (recut !== data.canonical) {
    throw new Error(
      `executeRun: bộ dữ liệu chưa được cắt theo asOf ${input.asOf}` +
        `${knownAt === null ? "" : ` / knownAt ${knownAt}`} — truyền datasetAt(...) của đúng hai ngày đó.`,
    );
  }

  const run = recommend({
    state: state.value,
    data: data.value,
    ix: indexDataset(data.value),
    asOf: input.asOf,
    offerHistory: historyMap(history.value),
  });
  const { output, derived } = splitRun(run);

  return {
    run,
    dataset: data.value,
    record: {
      id: meta.id,
      userId: meta.userId ?? null,
      engineVersion: run.engineVersion,
      ruleVersion: run.ruleVersion,
      dataSnapshotAt: input.asOf,
      inputSnapshot: {
        asOf: input.asOf,
        knownAt,
        state: state.value,
        stateFingerprint: fingerprintOf(state.canonical),
        datasetFingerprint: fingerprintOf(data.canonical),
        offerHistory: history.value,
        offerHistoryFingerprint: fingerprintOf(history.canonical),
      },
      derivedState: derived,
      outputSnapshot: output,
      resultFingerprint: resultFingerprintOf(derived, output),
      createdAt: meta.createdAt,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Chạy lại
 * ------------------------------------------------------------------ */

export interface ReplayResult {
  /** Đầu ra VÀ derived state chạy lại khớp bản đã lưu, tới từng chữ số. */
  identical: boolean;
  /**
   * Kết quả đã lưu được kiểm với dấu vân tay lúc lưu. `false` = bản ghi cũ
   * không có dấu vân tay: một `regression` khi đó CÓ THỂ là kho hỏng.
   */
  resultVerified: boolean;
  /** Version lúc lưu và version bây giờ. */
  engineVersion: { recorded: string; current: string };
  ruleVersion: { recorded: string; current: string };
  /**
   * Khác mà version KHÔNG đổi = một lỗi tất định (§35), không phải một lần
   * đổi mô hình. Đây là cờ duy nhất trong kết quả có nghĩa là "có gì đó hỏng".
   */
  regression: boolean;
  /** Lượt chạy mới, dựng lại đúng hình dạng bản ghi để so từng tầng. */
  replayed: RecommendationRunRecord;
}

/**
 * Chạy lại một bản ghi từ chính đầu vào nó đã lưu.
 *
 * Bộ dữ liệu phải là bộ ĐÃ LƯU theo `datasetFingerprint` — và được kiểm lại
 * ở đây chứ không tin người gọi: truyền nhầm bộ dữ liệu hôm nay vào thì mọi
 * khác biệt sẽ bị đọc thành "engine đã đổi" trong khi thứ đổi là dữ liệu.
 */
export function replayRun(record: RecommendationRunRecord, dataset: RecommendationDataset): ReplayResult {
  const got = fingerprint(dataset);
  if (got !== record.inputSnapshot.datasetFingerprint) {
    throw new Error(
      `replayRun: bộ dữ liệu truyền vào (${got}) không phải bộ lượt chạy ${record.id} đã đọc ` +
        `(${record.inputSnapshot.datasetFingerprint}). Lấy đúng bản chụp từ kho, đừng dùng bộ hôm nay.`,
    );
  }
  // Hồ sơ và lịch sử offer nằm NGAY TRONG bản ghi, nên chúng hỏng cùng bản
  // ghi: một migration database đổi kiểu một trường, một người sửa tay một
  // dòng. Không kiểm thì lượt chạy lại đọc đầu vào ĐÃ ĐỔI, ra kết quả khác, và
  // bị gọi là HỒI QUY — admin đi tìm lỗi trong engine trong khi lỗi nằm ở kho.
  // Cùng lý do bộ dữ liệu phải khớp dấu vân tay ở trên (vòng rà Phase 4).
  // Chỉ bản ghi TRƯỚC khi có trường này được phép thiếu nó; bản ghi từ 4.19.0
  // trở đi mà thiếu là đã bị cắt bớt trong kho (vòng Codex 19).
  if (record.resultFingerprint === undefined && !olderThan(record.engineVersion, RESULT_FINGERPRINT_SINCE)) {
    throw new Error(
      `replayRun: bản ghi ${record.id} (engine ${record.engineVersion}) thiếu dấu vân tay kết quả — ` +
        `mọi bản ghi từ ${RESULT_FINGERPRINT_SINCE} đều có, nên bản này đã hỏng trong kho.`,
    );
  }
  const stored = [
    ["hồ sơ người dùng", fingerprint(record.inputSnapshot.state), record.inputSnapshot.stateFingerprint],
    ["lịch sử offer", fingerprint(record.inputSnapshot.offerHistory), record.inputSnapshot.offerHistoryFingerprint],
    ...(record.resultFingerprint === undefined
      ? []
      : ([["kết quả đã lưu", resultFingerprintOf(record.derivedState, record.outputSnapshot), record.resultFingerprint]] as const)),
  ] as const;
  for (const [what, actual, expected] of stored) {
    if (actual !== expected) {
      throw new Error(
        `replayRun: ${what} trong bản ghi ${record.id} không còn khớp dấu vân tay lúc lưu ` +
          `(${expected} → ${actual}). Bản ghi đã bị sửa hoặc hỏng khi lưu — kết quả chạy lại sẽ không nói gì về engine.`,
      );
    }
  }
  const { record: replayed } = executeRun(
    {
      state: record.inputSnapshot.state,
      data: dataset,
      asOf: record.inputSnapshot.asOf,
      knownAt: record.inputSnapshot.knownAt,
      offerHistory: historyMap(record.inputSnapshot.offerHistory),
    },
    { id: record.id, createdAt: record.createdAt, userId: record.userId },
  );
  const identical =
    canonicalJson({ d: record.derivedState, o: record.outputSnapshot }) ===
    canonicalJson({ d: replayed.derivedState, o: replayed.outputSnapshot });
  const sameVersion =
    record.engineVersion === ENGINE_VERSION && record.ruleVersion === RULE_VERSION;
  return {
    identical,
    resultVerified: record.resultFingerprint !== undefined,
    engineVersion: { recorded: record.engineVersion, current: ENGINE_VERSION },
    ruleVersion: { recorded: record.ruleVersion, current: RULE_VERSION },
    regression: !identical && sameVersion,
    replayed,
  };
}

/** Đầu vào của một bản ghi, ở dạng `executeRun` nhận — để chạy "nếu như". */
export function inputOf(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
): RunInput {
  return {
    state: record.inputSnapshot.state,
    data: dataset,
    asOf: record.inputSnapshot.asOf,
    knownAt: record.inputSnapshot.knownAt,
    offerHistory: historyMap(record.inputSnapshot.offerHistory),
  };
}
