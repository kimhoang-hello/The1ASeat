/**
 * So hai lượt chạy THEO TỪNG TẦNG của dây chuyền — và chỉ ra tầng đầu tiên
 * khác nhau.
 *
 * Đây là công cụ cho câu hỏi của §20 ("vì sao khuyến nghị đổi theo thời
 * gian") và cho câu hỏi khó hơn của Phase 4: "khuyến nghị này SAI — lỗi nằm
 * ở tầng nào". Một thay đổi ở đầu vào lan xuống mọi tầng phía sau, nên nhìn
 * đầu ra thì thấy mọi thứ đều khác; tầng ĐẦU TIÊN khác mới là chỗ nó bắt đầu.
 *
 * Thứ tự tầng dưới đây là thứ tự của `engine.ts`, không phải thứ tự trình bày
 * đẹp mắt — "đầu tiên" chỉ có nghĩa khi thứ tự là thứ tự nhân quả.
 */

import { canonicalJson } from "./fingerprint.ts";
import { cutHistory, historyCutoff } from "./offer-history.ts";
import { alignRecords } from "./legacy.ts";
import { executeRun, inputOf, type RecommendationRunRecord, type RunInput } from "./runs.ts";
import type { RecommendationDataset } from "./types.ts";
import type { Candidate } from "./engine-types.ts";

/* ------------------------------------------------------------------ *
 * So sâu
 * ------------------------------------------------------------------ */

export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Mọi chỗ khác nhau giữa hai giá trị JSON, dạng đường dẫn.
 *
 * So CHÍNH XÁC, không có dung sai. Chạy lại một lượt chạy phải ra đúng từng
 * chữ số (§35); một dung sai ở đây là cho phép đúng thứ không được phép, và
 * khác biệt 1e-15 hôm nay là dấu hiệu của một phép cộng phụ thuộc thứ tự mà
 * ngày mai sẽ đổi người thắng.
 */
export function deepDiff(before: unknown, after: unknown, path = ""): DiffEntry[] {
  // Đi qua JSON trước để hai bên cùng một ngữ nghĩa: `undefined` vắng mặt,
  // `-0` là `0` — đúng như khi đọc từ kho.
  const a = JSON.parse(canonicalJson(before ?? null)) as unknown;
  const b = JSON.parse(canonicalJson(after ?? null)) as unknown;
  const out: DiffEntry[] = [];
  const walk = (x: unknown, y: unknown, at: string) => {
    if (Array.isArray(x) && Array.isArray(y)) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i += 1) {
        if (i >= x.length) out.push({ path: `${at}[${i}]`, before: undefined, after: y[i] });
        else if (i >= y.length) out.push({ path: `${at}[${i}]`, before: x[i], after: undefined });
        else walk(x[i], y[i], `${at}[${i}]`);
      }
      return;
    }
    if (isPlainObject(x) && isPlainObject(y)) {
      const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
      for (const key of keys) {
        const next = at === "" ? key : `${at}.${key}`;
        if (!(key in x)) out.push({ path: next, before: undefined, after: y[key] });
        else if (!(key in y)) out.push({ path: next, before: x[key], after: undefined });
        else walk(x[key], y[key], next);
      }
      return;
    }
    if (x !== y) out.push({ path: at === "" ? "(gốc)" : at, before: x, after: y });
  };
  walk(a, b, path);
  return out;
}

/* ------------------------------------------------------------------ *
 * Các tầng
 * ------------------------------------------------------------------ */

/**
 * Tên tầng — đúng danh sách nguồn lỗi Phase 4 phải phân biệt được, cộng các
 * tầng giữa (chuẩn hoá, dữ kiện ứng viên, thang đo chung, độ tin cậy) mà một
 * thay đổi có thể đi qua.
 *
 * Thứ tự là thứ tự TÍNH của `engine.ts`, không phải thứ tự trình bày của spec.
 * Chúng khác nhau ở một chỗ, và chỗ đó quyết định: spec vẽ Strategies → Needs
 * → Eligibility, nhưng engine tính dữ kiện từng thẻ và điều kiện TRƯỚC, vì
 * chiến lược `WAIT_FOR_BETTER_OFFER` đọc thị trường offer của tập ứng viên
 * chọn được. Xếp theo spec thì một lần đổi lịch sử offer báo "lan từ tầng
 * chiến lược" trong khi nó bắt đầu ở percentile của một thẻ.
 */
export const PIPELINE_STAGES = [
  "source_data",
  "user_input",
  "normalization",
  "portfolio_analysis",
  "candidate_facts",
  "eligibility",
  "suitability",
  "offer_climate",
  "strategy_generation",
  "needs_calculation",
  "scoring",
  "rules",
  "editorial",
  "ranking",
  "final_recommendation",
  "confidence",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  source_data: "Dữ liệu nguồn (bộ dữ liệu, lịch sử offer, ngày chạy)",
  user_input: "Đầu vào người dùng",
  normalization: "Chuẩn hoá (mục tiêu, chỗ trống, tập ứng viên)",
  portfolio_analysis: "Phân tích danh mục §7",
  strategy_generation: "Sinh chiến lược §8",
  needs_calculation: "Tính nhu cầu §9",
  eligibility: "Điều kiện §14 (ngân hàng có nhận không)",
  suitability: "Phù hợp §14 (người dùng có nên/muốn không)",
  candidate_facts: "Dữ kiện ứng viên (offer §11–12, tích điểm, quyền lợi)",
  offer_climate: "Thang đo chung của tập chọn được (thị trường offer, thang điểm)",
  scoring: "Chấm điểm theo ý định §10",
  rules: "Luật §16 (code)",
  editorial: "Biên tập §17 (dữ liệu biên tập, RULE_VERSION)",
  ranking: "Xếp hạng §18",
  final_recommendation: "Khuyến nghị cuối",
  confidence: "Độ tin cậy §29 + câu hỏi tiếp §30",
};

/** Khoá ổn định của một ứng viên trong bảng so: slug, hoặc `NO_NEW_CARD`. */
export function candidateKey(candidate: Pick<Candidate, "kind" | "productSlug">): string {
  return candidate.kind === "no_new_card" ? "NO_NEW_CARD" : (candidate.productSlug ?? "?");
}

function keyed<T, V>(rows: readonly T[], key: (row: T) => string, value: (row: T) => V): Record<string, V> {
  const out: Record<string, V> = {};
  for (const row of rows) out[key(row)] = value(row);
  return out;
}

/** Mục tiêu nào — dùng làm khoá khi một lượt chạy có nhiều mục tiêu hoà nhau. */
function goalKey(goal: { goalId: string | null; goalType: string }, index: number): string {
  return `${index}:${goal.goalType}`;
}

/**
 * Giá trị của từng tầng, ở dạng so được.
 *
 * Mảng ứng viên được đổi thành object KHOÁ THEO SLUG trước khi so: so theo vị
 * trí thì một thẻ tụt một bậc làm mọi dòng phía dưới "khác", và bảng diff chôn
 * mất đúng dòng đáng đọc.
 */
export function stageValue(record: RecommendationRunRecord, stage: PipelineStage): unknown {
  const derived = record.derivedState;
  const output = record.outputSnapshot;
  switch (stage) {
    case "source_data":
      return {
        asOf: record.inputSnapshot.asOf,
        knownAt: record.inputSnapshot.knownAt,
        dataset: record.inputSnapshot.datasetFingerprint,
        offerHistory: record.inputSnapshot.offerHistoryFingerprint,
      };
    case "user_input":
      return record.inputSnapshot.state;
    case "normalization":
      return {
        goalResolution: output.goalResolution,
        // Mã cấp lượt chạy (`GOAL_MISSING`, `GOAL_AMBIGUOUS`) sinh từ phép giải mục tiêu.
        runReasonCodes: output.reasonCodes,
        goals: derived.goals.map((goal) => goal.goal),
        userGaps: output.userGaps,
        // KHÔNG có `dataGaps`: chỗ trống dữ liệu của lượt chạy được lọc theo
        // `read-set.ts` — tức theo thẻ CHỌN ĐƯỢC, sau tầng điều kiện. Để nó ở
        // đây thì một thẻ trượt luật cứng làm mất chỗ trống của nó, và tầng
        // khác đầu tiên bị báo là chuẩn hoá thay vì điều kiện (vòng Codex 15).
        // Chỗ trống thô là hàm của dữ liệu + tập ứng viên, cả hai đã có ở trên.
        universe: derived.universe,
        // Cửa chặn của tập ứng viên thuộc về tầng NÀY. Để nó ở tầng điều kiện
        // thì một thẻ vẫn bị loại nhưng đổi LÝ DO (đang giữ → hết nhận đơn)
        // làm tập ứng viên đứng yên, và tầng khác đầu tiên bị báo sai chỗ.
        universeExclusions: keyed(
          derived.excluded.filter((row) => row.stage === "universe"),
          (row) => row.productSlug,
          (row) => row.reason,
        ),
      };
    case "portfolio_analysis":
      return {
        portfolio: derived.portfolio,
        // Cảnh báo cấp lượt chạy (`CARDS_UNDECLARED`, `BALANCES_UNDECLARED`) sinh từ danh mục.
        runWarnings: output.warnings,
        // Tỷ lệ phủ chuyến đi là phép phân tích danh mục §7 NHÌN QUA chặng
        // đang hỏi — chỉ đọc hồ sơ và giá chặng, tính trước mọi tầng sau. Nó
        // từng không nằm ở tầng nào, nên cả chuỗi lỗi `tripCoverage` (Codex
        // vòng 3–7) chỉ hiện ra ở các tầng hạ nguồn (vòng rà Phase 4).
        tripCoverage: keyed(
          derived.goals.map((goal, index) => ({ goal, index })),
          ({ goal, index }) => goalKey(goal, index),
          ({ goal }) => goal.tripCoverage,
        ),
      };
    case "strategy_generation":
      return keyed(
        output.results.map((result, index) => ({ result, index })),
        ({ result, index }) => goalKey(result, index),
        ({ result }) => keyed(result.strategies, (row) => row.strategy, (row) => row),
      );
    case "needs_calculation":
      return keyed(
        derived.goals.map((goal, index) => ({ goal, index })),
        ({ goal, index }) => goalKey(goal, index),
        ({ goal }) => goal.needs,
      );
    // Điều kiện và phù hợp là HAI tầng: §14 tách chúng vì hai người sửa khác
    // nhau (luật ngân hàng / câu trả lời của người dùng). Chung một tầng thì
    // phép so nói "§14 khác" và admin phải đọc đường dẫn để biết cái nào.
    case "eligibility":
      return {
        excluded: keyed(
          derived.excluded.filter((row) => row.stage === "eligibility"),
          (row) => row.productSlug,
          (row) => row,
        ),
        verdicts: keyed(derived.candidates, (row) => row.productSlug, (row) => row.eligibility),
      };
    case "suitability":
      return {
        excluded: keyed(
          derived.excluded.filter((row) => row.stage === "suitability"),
          (row) => row.productSlug,
          (row) => row,
        ),
        // `selectable` cần CẢ hai phán quyết — nó thuộc tầng sau của hai.
        verdicts: keyed(
          derived.candidates,
          (row) => row.productSlug,
          (row) => ({ suitability: row.suitability, selectable: row.selectable }),
        ),
      };
    case "offer_climate":
      return { climate: derived.climate, scale: derived.scale };
    case "candidate_facts":
      return {
        medianFeeCents: derived.medianFeeCents,
        candidates: keyed(
          derived.candidates,
          (row) => row.productSlug,
          (row) => ({
            offer: row.offer,
            earn: row.earn,
            // Cùng tầng với hai dòng trên: chúng là CÙNG một dữ kiện đo bằng
            // thước khác, dựng ở cùng chỗ và đổi vì cùng lý do.
            offerCash: row.offerCash,
            earnCash: row.earnCash,
            benefits: row.benefits,
            travelBenefitCount: row.travelBenefitCount,
          }),
        ),
      };
    case "scoring":
      return keyed(
        derived.goals.map((goal, index) => ({ goal, index })),
        ({ goal, index }) => goalKey(goal, index),
        ({ goal }) =>
          keyed(
            goal.ranking,
            (row) => candidateKey(row.candidate),
            // NGUYÊN dòng thành phần, cả `note`: một lần đổi version sửa lời giải
            // thích mà không đổi con số vẫn là một bản ghi khác, và phép so phải
            // thấy nó.
            (row) => ({
              baseScore: row.candidate.baseScore,
              components: keyed(row.candidate.components, (c) => c.key, (c) => c),
            }),
          ),
      );
    case "rules":
      return keyed(
        derived.goals.map((goal, index) => ({ goal, index })),
        ({ goal, index }) => goalKey(goal, index),
        ({ goal }) =>
          keyed(
            goal.ranking,
            (row) => candidateKey(row.candidate),
            // Mã và cảnh báo của ứng viên được GỘP ở đây (luật + điều kiện + phù
            // hợp + offer + quyền lợi), cho MỌI ứng viên kể cả thẻ bị ẩn.
            (row) => ({
              adjustments: keyed(
                row.candidate.adjustments.filter((a) => a.layer !== "editorial"),
                (a) => a.rule,
                (a) => a,
              ),
              reasonCodes: row.candidate.reasonCodes,
              warnings: row.candidate.warnings,
            }),
          ),
      );
    // Biên tập §17 tách khỏi luật §16: luật là CODE, biên tập là DỮ LIỆU một
    // người gõ vào (`RULE_VERSION`) — hai chỗ sửa, hai người chịu trách nhiệm.
    case "editorial":
      return keyed(
        derived.goals.map((goal, index) => ({ goal, index })),
        ({ goal, index }) => goalKey(goal, index),
        ({ goal }) =>
          keyed(
            goal.ranking,
            (row) => candidateKey(row.candidate),
            (row) => keyed(row.candidate.adjustments.filter((a) => a.layer === "editorial"), (a) => a.rule, (a) => a),
          ),
      );
    case "ranking":
      return keyed(
        derived.goals.map((goal, index) => ({ goal, index })),
        ({ goal, index }) => goalKey(goal, index),
        ({ goal }) => ({
          order: goal.ranking.map((row) => candidateKey(row.candidate)),
          scores: keyed(goal.ranking, (row) => candidateKey(row.candidate), (row) => row.candidate.score),
          visibility: keyed(goal.ranking, (row) => candidateKey(row.candidate), (row) => row.visibility),
          rank: keyed(goal.ranking, (row) => candidateKey(row.candidate), (row) => row.rank),
          hiddenBy: keyed(goal.ranking, (row) => candidateKey(row.candidate), (row) => row.hiddenBy),
        }),
      );
    case "final_recommendation": {
      // Mỗi ứng viên HIỆN RA, NGUYÊN VẸN — thứ người đọc thấy. Bản trước chỉ
      // giữ slug của gợi ý thay thế và điểm của NO_NEW_CARD, nên thêm/bớt cảnh
      // báo trên một gợi ý thay thế làm bản ghi khác mà phép so báo 0/14 tầng
      // (vòng Codex 16). Trong bản ghi đã lưu, ứng viên ở đầu ra là một BẢN SAO
      // độc lập với dòng của nó trong bảng xếp hạng — nên chiếu một phần là để
      // phần còn lại khác mà không ai thấy.
      const shown = (candidate: Candidate) => candidate;
      return output.results.map((result) => ({
        // Kết quả này thuộc MỤC TIÊU nào — thứ nối nó với bảng xếp hạng.
        goalId: result.goalId,
        strategy: result.strategy.strategy,
        primary: candidateKey(result.primaryAction),
        primaryAction: shown(result.primaryAction),
        alternatives: result.alternatives.map(candidateKey),
        alternativeDetails: keyed(result.alternatives, candidateKey, shown),
        noAction: shown(result.noAction),
        reasonCodes: result.reasonCodes,
        warnings: result.warnings,
        numbers: result.numbers,
      }));
    }
    case "confidence":
      return {
        confidence: output.results.map((result) => result.confidence),
        // Bốn con số độ tin cậy ĐỌC — đổi dòng dữ liệu cũ nhất mà độ tươi vẫn
        // tròn về cùng mức thì chỉ ở đây mới thấy.
        inputs: derived.goals.map((goal) => goal.confidenceInputs),
        // Chỗ trống ĐÃ lọc theo những gì lượt chạy đọc — tính cùng lúc với độ
        // tin cậy, sau xếp hạng, và chỉ độ tin cậy + §30 đọc chúng.
        dataGaps: output.dataGaps,
        goalGaps: keyed(
          derived.goals.map((goal, index) => ({ goal, index })),
          ({ goal, index }) => goalKey(goal, index),
          ({ goal }) => ({ userGaps: goal.userGaps, dataGaps: goal.dataGaps }),
        ),
        followUp: output.followUp,
        // Phép đo §30 cũng là trạng thái của lượt chạy: một lần đổi engine
        // làm lật một câu trả lời thử mà vẫn chọn cùng câu hỏi thì bản ghi đã
        // khác, và phép so phải thấy.
        followUpProbes: keyed(
          derived.followUpProbes ?? [],
          (row) => `${row.gapKind}:${row.subject}`,
          (row) => row,
        ),
      };
  }
}

export interface StageDiff {
  /** `unmapped` — xem lưới an toàn ở `diffRecords`. */
  stage: PipelineStage | "unmapped";
  label: string;
  changed: boolean;
  /** Tổng số chỗ khác — `entries` có thể đã bị cắt. */
  count: number;
  entries: DiffEntry[];
}

/** So hai bản ghi theo từng tầng. `limit` cắt số dòng giữ lại mỗi tầng. */
export function diffRecords(
  before: RecommendationRunRecord,
  after: RecommendationRunRecord,
  limit = 30,
): StageDiff[] {
  // Cùng một hình dạng trước khi so — xem `legacy.ts`.
  [before, after] = alignRecords(before, after);
  const diffs: StageDiff[] = PIPELINE_STAGES.map((stage) => {
    const entries = deepDiff(stageValue(before, stage), stageValue(after, stage));
    return {
      stage,
      label: STAGE_LABELS[stage],
      changed: entries.length > 0,
      count: entries.length,
      entries: entries.slice(0, limit),
    };
  });
  // LƯỚI AN TOÀN, và giới hạn của nó nói thẳng: nó chỉ bắt ca IM LẶNG HOÀN
  // TOÀN — bản ghi khác mà không tầng tính nào khác. Một trường chưa ánh xạ
  // đổi CÙNG LÚC với một trường đã ánh xạ thì lưới không thấy (vòng Codex 17).
  // Thứ đóng lỗ đó là bài vét cạn trong `runs.test.ts` (mọi lá của bản ghi
  // phải có tầng báo), còn bản ghi bị sửa trong kho thì `replayRun` bắt bằng
  // dấu vân tay kết quả.
  const computedChanged = diffs.some(
    (row) => row.changed && row.stage !== "source_data" && row.stage !== "user_input",
  );
  if (!computedChanged) {
    // Bỏ siêu dữ liệu của đầu ra: version và ngày chạy đã có ở phần đầu phép
    // so (và ngày chạy ở tầng dữ liệu nguồn). Không bỏ thì chạy lại một lượt
    // cũ dưới version mới luôn "khác ở trường chưa ánh xạ: engineVersion" —
    // một lời báo động giả đúng lúc admin cần biết khuyến nghị có tái lập không.
    const content = (record: RecommendationRunRecord) => {
      const { engineVersion: _v, ruleVersion: _r, asOf: _a, ...rest } = record.outputSnapshot;
      void _v;
      void _r;
      void _a;
      return { derived: record.derivedState, output: rest };
    };
    const whole = deepDiff(content(before), content(after));
    if (whole.length > 0) {
      diffs.push({
        stage: "unmapped",
        label: UNMAPPED_LABEL,
        changed: true,
        count: whole.length,
        entries: whole.slice(0, limit),
      });
    }
  }
  return diffs;
}

const UNMAPPED_LABEL = "Khác ở một trường CHƯA tầng nào ánh xạ — sửa `stageValue` trong run-diff.ts";

/**
 * Tầng đầu tiên khác nhau, BỎ QUA hai tầng đầu vào.
 *
 * Hai tầng đầu vào là NGUYÊN NHÂN, không phải chỗ lan tới — câu hỏi ở đây là
 * thay đổi đó bắt đầu làm engine tính khác từ đâu.
 */
export function firstComputedDivergence(diffs: readonly StageDiff[]): StageDiff | null {
  return (
    diffs.find(
      (row) => row.changed && row.stage !== "source_data" && row.stage !== "user_input",
    ) ?? null
  );
}

/* ------------------------------------------------------------------ *
 * Bộ dữ liệu khác nhau ở đâu
 * ------------------------------------------------------------------ */

export interface TableChange {
  table: string;
  added: string[];
  removed: string[];
  changed: { id: string; fields: string[] }[];
}

/** Khoá của một dòng: `id` nếu có, không thì chính nội dung (dòng `gaps`). */
function rowKey(row: unknown): string {
  if (isPlainObject(row) && typeof row.id === "string") return row.id;
  return canonicalJson(row);
}

/**
 * Dòng nào được thêm, bớt, sửa — theo từng bảng.
 *
 * Đây là câu trả lời cho "lỗi ở dữ liệu nguồn": dấu vân tay chỉ nói bộ dữ liệu
 * đã đổi, còn admin cần biết offer NÀO, tỷ lệ NÀO.
 */
export function diffDatasets(
  before: RecommendationDataset,
  after: RecommendationDataset,
): TableChange[] {
  const tables = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const out: TableChange[] = [];
  for (const table of tables) {
    const a = ((before as unknown as Record<string, unknown[]>)[table] ?? []) as unknown[];
    const b = ((after as unknown as Record<string, unknown[]>)[table] ?? []) as unknown[];
    const mapA = new Map(a.map((row) => [rowKey(row), row]));
    const mapB = new Map(b.map((row) => [rowKey(row), row]));
    const added = [...mapB.keys()].filter((key) => !mapA.has(key)).sort();
    const removed = [...mapA.keys()].filter((key) => !mapB.has(key)).sort();
    const changed = [...mapA.keys()]
      .filter((key) => mapB.has(key))
      .map((key) => ({ id: key, fields: deepDiff(mapA.get(key), mapB.get(key)).map((row) => row.path) }))
      .filter((row) => row.fields.length > 0)
      .sort((x, y) => (x.id < y.id ? -1 : 1));
    if (added.length + removed.length + changed.length > 0) {
      out.push({ table, added, removed, changed });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Vì sao hai lượt chạy khác nhau — §20
 * ------------------------------------------------------------------ */

export type ChangeFactor = "engine" | "rules" | "user_input" | "source_data" | "offer_history";

export interface FactorSwap {
  factor: Exclude<ChangeFactor, "engine" | "rules">;
  /** Đầu vào của yếu tố này có khác giữa hai lượt chạy không. */
  differs: boolean;
  /** Người thắng khi CHỈ đổi yếu tố này, giữ nguyên mọi thứ khác của lượt cũ. */
  winnerAlone: string | null;
  /** Tầng đầu tiên engine tính khác đi khi chỉ đổi yếu tố này. */
  firstDivergence: StageDiff["stage"] | null;
}

export interface ChangeExplanation {
  winner: { before: string | null; after: string | null };
  engineVersion: { before: string; after: string };
  ruleVersion: { before: string; after: string };
  /** Đầu vào người dùng khác ở đâu. */
  userInput: DiffEntry[];
  /** `asOf`/`knownAt` và dấu vân tay. */
  sourceData: DiffEntry[];
  /** Dòng dữ liệu nào đổi — chỉ khi có đủ cả hai bộ dữ liệu. */
  datasetChanges: TableChange[] | null;
  /** Sản phẩm có lịch sử offer khác. */
  offerHistoryChanged: string[];
  stages: StageDiff[];
  /**
   * Engine đã đổi giữa hai lượt: chạy lại lượt CŨ bằng engine HÔM NAY cho ra
   * gì. Tách phần "engine đổi" khỏi phần "đầu vào đổi" — không có bước này thì
   * mọi khác biệt đều trông như đầu vào đã đổi.
   */
  engineEffect: StageDiff[] | null;
  /** Đổi TỪNG yếu tố một trên nền lượt cũ — yếu tố nào một mình đủ đổi kết quả. */
  swaps: FactorSwap[] | null;
}

/** Người thắng của MỌI mục tiêu, nối lại — xem `winnerKey` ở `engine.ts`. */
function winnerOf(record: RecommendationRunRecord): string | null {
  const results = record.outputSnapshot.results;
  return results.length === 0 ? null : results.map((result) => candidateKey(result.primaryAction)).join(" | ");
}

/**
 * Vì sao `after` khác `before`.
 *
 * Có đủ hai bộ dữ liệu thì làm thêm hai việc mà chỉ nhìn hai bản ghi không làm
 * được: tách tác động của ENGINE (chạy lại lượt cũ bằng engine hôm nay), và
 * đổi từng yếu tố đầu vào một để xem yếu tố nào một mình đủ đổi người thắng.
 * Nhiều yếu tố cùng đổi có thể TƯƠNG TÁC — nên đây là bằng chứng, không phải
 * một phép chia phần trăm trách nhiệm.
 */
export function explainChange(
  before: RecommendationRunRecord,
  after: RecommendationRunRecord,
  datasets?: { before: RecommendationDataset; after: RecommendationDataset },
): ChangeExplanation {
  const historyBefore = new Map(before.inputSnapshot.offerHistory.map((row) => [row.productId, row.points]));
  const historyAfter = new Map(after.inputSnapshot.offerHistory.map((row) => [row.productId, row.points]));
  const offerHistoryChanged = [...new Set([...historyBefore.keys(), ...historyAfter.keys()])]
    .filter(
      (productId) =>
        canonicalJson(historyBefore.get(productId) ?? null) !==
        canonicalJson(historyAfter.get(productId) ?? null),
    )
    .sort();

  let engineEffect: StageDiff[] | null = null;
  let swaps: FactorSwap[] | null = null;
  if (datasets !== undefined) {
    const meta = { id: before.id, createdAt: before.createdAt, userId: before.userId };
    const base = executeRun(inputOf(before, datasets.before), meta).record;
    if (before.engineVersion !== base.engineVersion || before.ruleVersion !== base.ruleVersion) {
      engineEffect = diffRecords(before, base);
    }
    const oldInput = inputOf(before, datasets.before);
    const newInput = inputOf(after, datasets.after);
    const variants: { factor: FactorSwap["factor"]; input: RunInput; differs: boolean }[] = [
      {
        factor: "user_input",
        input: { ...oldInput, state: newInput.state },
        differs: before.inputSnapshot.stateFingerprint !== after.inputSnapshot.stateFingerprint,
      },
      {
        // Ngày chạy đi CÙNG bộ dữ liệu: bộ dữ liệu đã được cắt theo đúng ngày
        // đó, và ghép bộ dữ liệu hôm nay với ngày tháng trước là dựng ra một
        // thế giới chưa từng tồn tại.
        factor: "source_data",
        input: { ...oldInput, data: newInput.data, asOf: newInput.asOf, knownAt: newInput.knownAt },
        differs:
          before.inputSnapshot.datasetFingerprint !== after.inputSnapshot.datasetFingerprint ||
          before.inputSnapshot.asOf !== after.inputSnapshot.asOf ||
          before.inputSnapshot.knownAt !== after.inputSnapshot.knownAt,
      },
      {
        factor: "offer_history",
        input: { ...oldInput, offerHistory: newInput.offerHistory },
        differs:
          before.inputSnapshot.offerHistoryFingerprint !== after.inputSnapshot.offerHistoryFingerprint,
      },
    ];
    swaps = variants.map(({ factor, input, differs }) => {
      if (!differs) return { factor, differs, winnerAlone: winnerOf(base), firstDivergence: null };
      // Lịch sử offer cắt theo NGÀY của biến thể: đổi riêng lịch sử (ngày cũ)
      // hay đổi riêng bộ dữ liệu (ngày mới) đều ghép lịch sử của ngày này vào
      // ngày kia, và `executeRun` từ chối mốc nằm sau ngày cắt (vòng Codex 18).
      const cutoff = historyCutoff(input.asOf, input.knownAt);
      const offerHistory = new Map(
        [...(input.offerHistory ?? new Map())].map(([productId, points]) => [productId, cutHistory(points, cutoff)]),
      );
      const swapped = executeRun({ ...input, offerHistory }, meta).record;
      return {
        factor,
        differs,
        winnerAlone: winnerOf(swapped),
        firstDivergence: firstComputedDivergence(diffRecords(base, swapped))?.stage ?? null,
      };
    });
  }

  return {
    winner: { before: winnerOf(before), after: winnerOf(after) },
    engineVersion: { before: before.engineVersion, after: after.engineVersion },
    ruleVersion: { before: before.ruleVersion, after: after.ruleVersion },
    userInput: deepDiff(before.inputSnapshot.state, after.inputSnapshot.state),
    sourceData: deepDiff(stageValue(before, "source_data"), stageValue(after, "source_data")),
    datasetChanges: datasets === undefined ? null : diffDatasets(datasets.before, datasets.after),
    offerHistoryChanged,
    stages: diffRecords(before, after),
    engineEffect,
    swaps,
  };
}
