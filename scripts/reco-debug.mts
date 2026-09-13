/**
 * §22 Recommendation Debugger — bản dòng lệnh.
 *
 *   npm run reco:debug -- run <hồ sơ> [--save] [--goal N] [--top N] [--json]
 *   npm run reco:debug -- why <hồ sơ|run-id> <slug|NO_NEW_CARD>
 *   npm run reco:debug -- compare <hồ sơ|run-id> <slugA> <slugB|NO_NEW_CARD>
 *   npm run reco:debug -- what-if <hồ sơ|run-id> --set đường.dẫn=giá-trị [...]
 *   npm run reco:debug -- replay <run-id>
 *   npm run reco:debug -- diff <run-id-cũ> <run-id-mới>
 *   npm run reco:debug -- list | fixtures
 *
 * `<hồ sơ>` là id một nhân vật mẫu (`u_beginner`), tên export của nó
 * (`beginnerNoCards`), hoặc đường dẫn tới một file JSON `UserState` — hồ sơ
 * giả của §22. Tuỳ chọn chung: `--as-of YYYY-MM-DD` (mặc định hôm nay, giờ
 * Toronto), `--known-at YYYY-MM-DD`.
 *
 * Bộ dữ liệu là bộ OFFLINE trong repo (không gọi Contentful), lịch sử offer
 * là nhật ký THẬT `data/offer-history.json` qua đúng hàm production dùng.
 * Khác biệt duy nhất với production là cờ `affiliateAvailable` — thứ engine
 * không bao giờ đọc (§16 Rule 7).
 *
 * Lượt chạy `--save` vào `.reco-runs/` (gitignore), kèm bản chụp bộ dữ liệu
 * theo dấu vân tay — nên `replay` và `diff` chạy lại đúng thế giới lúc đó dù
 * dữ liệu trong repo đã đổi.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { offlineDataset } from "../src/lib/recommendation/data/index.ts";
import { datasetAt } from "../src/lib/recommendation/temporal.ts";
import { USER_FIXTURES } from "../src/lib/recommendation/data/user-fixtures.ts";
import * as FIXTURE_EXPORTS from "../src/lib/recommendation/data/user-fixtures.ts";
import { repoOfferHistory } from "../src/lib/recommendation/offer-history-source.ts";
import { historyCutoff } from "../src/lib/recommendation/offer-history.ts";
import { executeRun, inputOf, replayRun, type RecommendationRunRecord } from "../src/lib/recommendation/runs.ts";
import { compareCandidates, explainProduct } from "../src/lib/recommendation/debug.ts";
import { diffRecords, explainChange } from "../src/lib/recommendation/run-diff.ts";
import {
  renderChangeExplanation,
  renderComparison,
  renderProductExplanation,
  renderRunReport,
  renderStageDiffs,
} from "../src/lib/recommendation/debug-render.ts";
import { fileRunStore } from "../src/lib/recommendation/run-store-fs.ts";
import { todayInSiteZone } from "../src/lib/format-date.ts";
import type { OfferHistoryPoint } from "../src/lib/recommendation/offer-history.ts";
import type { RecommendationDataset } from "../src/lib/recommendation/types.ts";
import type { UserState } from "../src/lib/recommendation/user-types.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = fileRunStore(path.join(ROOT, ".reco-runs"));

/* ---- Tham số ------------------------------------------------------ */

const argv = process.argv.slice(2);
const flags = new Map<string, string[]>();
const positional: string[] = [];
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg.startsWith("--")) {
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    const name = eq === -1 ? body : body.slice(0, eq);
    const inline = eq === -1 ? undefined : body.slice(eq + 1);
    const takesValue = !["save", "json"].includes(name);
    const value = inline ?? (takesValue ? argv[++i] : "true");
    flags.set(name, [...(flags.get(name) ?? []), value]);
  } else {
    positional.push(arg);
  }
}
const flag = (name: string) => flags.get(name)?.at(-1);
const [command, ...rest] = positional;

function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/* ---- Nạp hồ sơ / lượt chạy ---------------------------------------- */

function fixtureState(ref: string): UserState | null {
  const byId = USER_FIXTURES.find((state) => state.profile.id === ref);
  if (byId !== undefined) return byId;
  const byExport = (FIXTURE_EXPORTS as Record<string, unknown>)[ref];
  if (byExport !== null && typeof byExport === "object" && "profile" in byExport) {
    return byExport as UserState;
  }
  return null;
}

function stateFrom(ref: string): UserState {
  const fixture = fixtureState(ref);
  if (fixture !== null) return fixture;
  try {
    return JSON.parse(readFileSync(path.resolve(ref), "utf8")) as UserState;
  } catch {
    return die(`không tìm thấy hồ sơ "${ref}" — dùng id nhân vật (xem \`fixtures\`), tên export, hoặc đường dẫn file JSON`);
  }
}

function newRunId(): string {
  // Có giờ trong id để `ls .reco-runs/runs` tự sắp theo thời gian; phần ngẫu
  // nhiên chặn hai lượt chạy cùng giây đè nhau.
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
  return `run_${stamp}_${randomUUID().slice(0, 8)}`;
}

/**
 * Lịch sử offer của MỌI sản phẩm, cắt ở ngày chạy — đúng như
 * `loadOfferHistory` của production. Mọi sản phẩm để `what-if` trên một lượt
 * đã lưu vẫn có lịch sử cho thẻ mới vào tập ứng viên.
 */
function historyFor(data: RecommendationDataset, asOf: string, knownAt: string | null) {
  const cutoff = historyCutoff(asOf, knownAt);
  return new Map<string, OfferHistoryPoint[]>(
    data.products.map((product) => [product.id as string, repoOfferHistory(product.id, cutoff)]),
  );
}

function freshRun(state: UserState, overrides: { asOf?: string } = {}) {
  const asOf = overrides.asOf ?? flag("as-of") ?? todayInSiteZone();
  const knownAt = flag("known-at") ?? null;
  const data = datasetAt(offlineDataset(), asOf, knownAt === null ? {} : { knownAt });
  return executeRun(
    { state, data, asOf, knownAt, offerHistory: historyFor(data, asOf, knownAt) },
    { id: newRunId(), createdAt: new Date().toISOString(), userId: null },
  );
}

/** `<hồ sơ|run-id>` → bản ghi + bộ dữ liệu của CHÍNH nó. */
async function loadSubject(ref: string): Promise<{ record: RecommendationRunRecord; dataset: RecommendationDataset }> {
  if (ref.startsWith("run_")) {
    const record = await store.getRun(ref);
    if (record === null) die(`không có lượt chạy ${ref} trong .reco-runs — xem \`list\``);
    const dataset = await store.getDataset(record.inputSnapshot.datasetFingerprint);
    if (dataset === null) die(`thiếu bản chụp bộ dữ liệu ${record.inputSnapshot.datasetFingerprint}`);
    return { record, dataset };
  }
  const executed = freshRun(stateFrom(ref));
  return { record: executed.record, dataset: executed.dataset };
}

async function save(record: RecommendationRunRecord, dataset: RecommendationDataset) {
  await store.saveDataset(record.inputSnapshot.datasetFingerprint, dataset);
  await store.saveRun(record);
  console.log(`\n✓ đã lưu ${record.id} vào .reco-runs/`);
}

/** `a.b[2].c=giá-trị` — giá trị đọc như JSON nếu được, không thì là chuỗi. */
function applySet(target: unknown, assignment: string): void {
  const eq = assignment.indexOf("=");
  if (eq <= 0) die(`--set cần dạng đường.dẫn=giá-trị, nhận được "${assignment}"`);
  const pathText = assignment.slice(0, eq);
  const rawValue = assignment.slice(eq + 1);
  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    value = rawValue;
  }
  const keys = pathText.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let node = target as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    if (node[key] === null || typeof node[key] !== "object") die(`--set: "${key}" trong "${pathText}" không phải object`);
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

/* ---- Lệnh --------------------------------------------------------- */

async function main() {
  switch (command) {
    case "fixtures": {
      for (const state of USER_FIXTURES) {
        const exportName = Object.entries(FIXTURE_EXPORTS).find(([, value]) => value === state)?.[0] ?? "";
        console.log(`${state.profile.id.padEnd(22)} ${exportName}`);
      }
      return;
    }
    case "list": {
      const rows = await store.listRuns({ limit: Number(flag("limit") ?? 30) });
      if (rows.length === 0) console.log("chưa có lượt chạy nào — `run <hồ sơ> --save` để lưu");
      for (const row of rows) {
        console.log(
          `${row.id}  ${row.createdAt}  asOf ${row.asOf}  engine ${row.engineVersion}  → ${row.primary} (${row.confidence})`,
        );
      }
      return;
    }
    case "run": {
      const ref = rest[0] ?? die("thiếu <hồ sơ>");
      const executed = freshRun(stateFrom(ref));
      if (flag("json") === "true") {
        console.log(JSON.stringify(executed.record, null, 2));
      } else {
        console.log(
          renderRunReport(executed.record, {
            goalIndex: flag("goal") === undefined ? undefined : Number(flag("goal")),
            rankingLimit: flag("top") === undefined ? undefined : Number(flag("top")),
          }),
        );
      }
      if (flag("save") === "true") await save(executed.record, executed.dataset);
      return;
    }
    case "why": {
      const [ref, product] = rest;
      if (ref === undefined || product === undefined) die("cần: why <hồ sơ|run-id> <slug|NO_NEW_CARD>");
      const { record, dataset } = await loadSubject(ref);
      const goalIndex = Number(flag("goal") ?? 0);
      console.log(renderProductExplanation(explainProduct(record, product, { goalIndex, dataset })));
      return;
    }
    case "compare": {
      const [ref, a, b] = rest;
      if (ref === undefined || a === undefined || b === undefined) die("cần: compare <hồ sơ|run-id> <A> <B>");
      const { record } = await loadSubject(ref);
      const goal = record.derivedState.goals[Number(flag("goal") ?? 0)];
      const find = (key: string) =>
        goal?.ranking.find((row) =>
          key === "NO_NEW_CARD" ? row.candidate.kind === "no_new_card" : row.candidate.productSlug === key,
        )?.candidate ?? die(`"${key}" không nằm trong bảng xếp hạng — dùng \`why\` để xem nó dừng ở đâu`);
      console.log(renderComparison(compareCandidates(find(a), find(b)), 40));
      return;
    }
    case "what-if": {
      const ref = rest[0] ?? die("thiếu <hồ sơ|run-id>");
      const sets = flags.get("set") ?? [];
      const asOf = flag("new-as-of");
      if (sets.length === 0 && asOf === undefined) die("cần ít nhất một --set đường.dẫn=giá-trị (hoặc --new-as-of)");
      const { record, dataset } = await loadSubject(ref);
      const input = inputOf(record, dataset);
      const state = structuredClone(input.state);
      for (const assignment of sets) applySet(state, assignment);
      let after;
      if (asOf === undefined) {
        after = executeRun({ ...input, state }, { id: newRunId(), createdAt: new Date().toISOString() });
      } else {
        after = freshRun(state, { asOf });
      }
      console.log(
        renderChangeExplanation(
          explainChange(record, after.record, { before: dataset, after: after.dataset }),
        ),
      );
      if (flag("save") === "true") await save(after.record, after.dataset);
      return;
    }
    case "replay": {
      const ref = rest[0] ?? die("thiếu <run-id>");
      const { record, dataset } = await loadSubject(ref);
      const result = replayRun(record, dataset);
      console.log(
        `engine ${result.engineVersion.recorded} → ${result.engineVersion.current} · ` +
          `luật ${result.ruleVersion.recorded} → ${result.ruleVersion.current}`,
      );
      if (result.identical) {
        console.log("✓ chạy lại ra ĐÚNG bản đã lưu — đầu ra và derived state khớp tới từng chữ số");
        return;
      }
      console.log(
        result.regression
          ? "✗ HỒI QUY: version không đổi mà kết quả đổi — engine không còn tất định (§35)"
          : "≠ kết quả đổi vì engine/luật đã đổi version — đây là tác động của lần đổi đó:",
      );
      console.log(renderStageDiffs(diffRecords(record, result.replayed)));
      if (result.regression) process.exit(1);
      return;
    }
    case "diff": {
      const [a, b] = rest;
      if (a === undefined || b === undefined) die("cần: diff <run-id-cũ> <run-id-mới>");
      const before = await loadSubject(a);
      const after = await loadSubject(b);
      console.log(
        renderChangeExplanation(
          explainChange(before.record, after.record, { before: before.dataset, after: after.dataset }),
        ),
      );
      return;
    }
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
      process.exit(command === undefined ? 0 : 1);
  }
}

await main();
