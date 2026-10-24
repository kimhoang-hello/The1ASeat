/**
 * Người dùng giả đi hết luồng câu hỏi của `/credit-cards/goi-y`.
 *
 *   npm run reco:walk -- [--n 300] [--seed 1] [--as-of YYYY-MM-DD] [--out lượt.json]
 *   npm run reco:walk -- --replay lượt.json      # chạy lại trạng thái cuối qua code HIỆN TẠI
 *
 * Mỗi hồ sơ có MỘT "sự thật" nhất quán (thu nhập, chi tiêu từng hạng mục, thẻ
 * đang giữ/đã đóng, số dư, chuyến đi) và đi đúng thứ tự trang làm: `executeRun`
 * → `presentForPage` → `questionFor` → `applyAnswerChecked`, trả lời bằng nấc
 * chứa sự thật đó, bỏ qua ngẫu nhiên 0/15/40%. Trả lời NGẪU NHIÊN thì validator
 * từ chối đúng (cận dưới các hạng mục vượt cận trên tổng chi) — chỉ đẻ nhiễu.
 *
 * Vì sao có script này: hai lần liền nó là cách tìm lỗi engine tốt nhất, trong
 * khi hàng trăm test và >70,000 lượt kiểm thử biến hình xanh (AGENTS.md, mục
 * 17/10/2026 và 21/10/2026). Thứ lộ lỗi thường KHÔNG phải một phép kiểm mà là
 * PHÂN BỐ NGƯỜI THẮNG theo nhóm hồ sơ — đọc nó như một chuyên gia points. Bản
 * 17/10 sống ở scratchpad và mất; bản này nằm trong repo để khỏi dựng lại.
 *
 * `--out` ghi trạng thái cuối + người thắng + ngày chạy; `--replay` chạy lại
 * đúng các trạng thái đó ở ĐÚNG ngày đó qua code hiện tại và đếm người thắng /
 * hướng đi đổi — phép đo tác động của một bản vá (chạy `--out` TRƯỚC khi sửa,
 * `--replay` sau).
 *
 * Welcome bonus / annual fee trên trang lấy từ Contentful (GET) nếu `.env.local`
 * có token; không có thì trang dựng không có phần chữ đó — engine không đổi.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { offlineDataset } from "../src/lib/recommendation/data/index.ts";
import { datasetAt, isAvailableAt } from "../src/lib/recommendation/temporal.ts";
import { executeRun } from "../src/lib/recommendation/runs.ts";
import { repoOfferHistory } from "../src/lib/recommendation/offer-history-source.ts";
import { historyCutoff } from "../src/lib/recommendation/offer-history.ts";
import { validateUserState } from "../src/lib/recommendation/user-validate.ts";
import { presentForPage } from "../src/lib/recommender/follow-up.ts";
import {
  GOAL_OPTIONS,
  applyAnswerChecked,
  goalFrom,
  newUserState,
  questionFor,
  questionKey,
  type AnswerForm,
  type QuestionSpec,
} from "../src/lib/recommender/questions.ts";
import { todayInSiteZone } from "../src/lib/format-date.ts";
import type { Recommendation } from "../src/lib/recommendation/engine-types.ts";
import type { UserState } from "../src/lib/recommendation/user-types.ts";
import type { CreditCardOffer } from "../src/lib/content/types.ts";
import type { OfferHistoryPoint } from "../src/lib/recommendation/offer-history.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? null : (args[at + 1] ?? null);
};

/** File `--out` mang theo ngày của lượt gốc: chạy lại ở ngày khác là đo dữ liệu đã đổi, không đo bản vá. */
interface WalkFile {
  asOf: string;
  rows: WalkRow[];
}
const replay = flag("replay");
const replayed = replay === null ? null : (JSON.parse(readFileSync(path.resolve(replay), "utf8")) as WalkFile);
if (replayed !== null && flag("as-of") !== null && flag("as-of") !== replayed.asOf) {
  console.error(`--as-of ${flag("as-of")} khác ngày của lượt gốc (${replayed.asOf}) — replay luôn chạy ở ngày gốc.`);
  process.exit(1);
}
const ASOF = replayed?.asOf ?? flag("as-of") ?? todayInSiteZone();
const N = Number(flag("n") ?? 300);
const SEED = Number(flag("seed") ?? 1);

const data = datasetAt(offlineDataset(), ASOF);
const cutoff = historyCutoff(ASOF, null);
const history = new Map<string, OfferHistoryPoint[]>(
  data.products.map((product) => [product.id as string, repoOfferHistory(product.id, cutoff)]),
);
const ctx = { dataset: data, today: ASOF };
const validate = (state: UserState) => validateUserState(state, data);

/** Họ chiến lược đi cùng "chưa mở thẻ" — đối chiếu ĐỘC LẬP với `strategies.ts`. */
const STAND_STILL = new Set(["USE_EXISTING_POINTS", "FOCUS_ON_AVAILABILITY", "WAIT_FOR_BETTER_OFFER", "NO_NEW_CARD"]);

function winnerOf(result: Recommendation): string {
  return result.primaryAction.kind === "no_new_card" ? "NO_NEW_CARD" : (result.primaryAction.productSlug ?? "?");
}

function run(state: UserState, id: string) {
  return executeRun({ state, data, asOf: ASOF, offerHistory: history }, { id, createdAt: `${ASOF}T00:00:00.000Z` });
}

/* ------------------------------------------------------------------ *
 * --replay: cùng trạng thái cuối, code hiện tại
 * ------------------------------------------------------------------ */

interface WalkRow {
  id: string;
  goal: string;
  winner: string;
  strategy: string;
  steps: number;
  state: UserState;
  truth: Truth;
}

if (replayed !== null) {
  const rows = replayed.rows;
  const moves = new Map<string, number>();
  let strategyChanged = 0;
  for (const row of rows) {
    const result = run(row.state, row.id).record.outputSnapshot.results[0];
    if (result === undefined) continue;
    const winner = winnerOf(result);
    if (winner !== row.winner) moves.set(`${row.winner} → ${winner}`, (moves.get(`${row.winner} → ${winner}`) ?? 0) + 1);
    if (result.strategy.strategy !== row.strategy) strategyChanged += 1;
  }
  const changed = [...moves.values()].reduce((sum, count) => sum + count, 0);
  console.log(`asOf ${ASOF} · hồ sơ ${rows.length} · đổi người thắng ${changed} · đổi hướng đi ${strategyChanged}`);
  for (const [move, count] of [...moves].sort((a, b) => b[1] - a[1])) console.log(`  ${move} ×${count}`);
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * Sự thật của một hồ sơ
 * ------------------------------------------------------------------ */

let seed = SEED >>> 0;
/** mulberry32 — tất định theo `--seed`, để hai lượt cùng seed ra cùng hồ sơ. */
function rnd(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
const shuffle = <T,>(items: T[]): T[] =>
  items
    .map((item) => [rnd(), item] as const)
    .sort((a, b) => a[0] - b[0])
    .map((row) => row[1]);
function shiftMonth(months: number, day: number): string {
  const [year, month] = ASOF.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day)).toISOString().slice(0, 10);
}

const CATEGORIES = [
  "grocery", "dining", "food_delivery", "gas", "ev_charging", "travel", "airline_direct", "hotel",
  "car_rental", "drugstore", "recurring", "streaming", "transit", "rideshare", "entertainment", "foreign_currency",
];

function makeTruth(index: number) {
  const student = rnd() < 0.08;
  const personal = student ? Math.round(rnd() * 25_000) : Math.round(25_000 + rnd() ** 1.6 * 275_000);
  const household = rnd() < 0.5 ? personal : personal + Math.round(rnd() * 180_000);
  const monthly = student ? 300 + Math.round(rnd() * 1_200) : Math.round(600 + rnd() ** 1.4 * 11_000);
  // Hạng mục cộng lại không vượt tổng — sự thật phải nhất quán, nếu không
  // validator từ chối đúng và lượt chạy chỉ đo nhiễu.
  const categories: Record<string, number> = {};
  let left = monthly;
  for (const category of shuffle([...CATEGORIES]).slice(0, 2 + Math.floor(rnd() * 6))) {
    const amount = Math.round(rnd() * left * 0.5);
    categories[category] = amount;
    left -= amount;
  }
  const pool = shuffle([...data.products]);
  const heldCount = Math.floor(rnd() ** 1.5 * 6);
  const held = pool.slice(0, heldCount);
  const closed = pool.slice(heldCount, heldCount + Math.floor(rnd() ** 2 * 4));
  const balances: Record<string, number> = {};
  for (const product of held) {
    if (product.pointsProgramId !== null && rnd() < 0.8) balances[product.pointsProgramId] = Math.round(rnd() ** 1.5 * 250_000);
  }
  if (rnd() < 0.2) balances[pick(data.pointsPrograms).id] = Math.round(rnd() * 120_000);
  return {
    id: `walk_${SEED}_${index}`,
    goal: pick(GOAL_OPTIONS).value,
    student,
    personal: rnd() < 0.08 ? null : personal,
    household: rnd() < 0.1 ? null : household,
    fee: pick(["0", "150", "400", "800", "unlimited"]),
    businessAllowed: rnd() < 0.35,
    hasBusiness: rnd() < 0.25,
    monthly,
    capacity: Math.round(monthly * (0.5 + rnd() * 3)),
    categories,
    held: held.map((product) => product.slug),
    closed: closed.map((product) => ({ slug: product.slug, month: shiftMonth(-1 - Math.floor(rnd() * 48), 15).slice(0, 7) })),
    balances,
    cabin: pick(["economy", "premium_economy", "business", "first"]),
    passengers: 1 + Math.floor(rnd() ** 2 * 4),
    roundTrip: rnd() < 0.7,
    travelMonth: shiftMonth(1 + Math.floor(rnd() * 16), 1).slice(0, 7),
    flexibility: pick(["low", "medium", "high"]),
    skip: pick([0, 0.15, 0.4]),
  };
}
type Truth = ReturnType<typeof makeTruth>;

/* ------------------------------------------------------------------ *
 * Trả lời đúng nấc chứa sự thật
 * ------------------------------------------------------------------ */

function form(values: Record<string, string | string[]>): AnswerForm {
  return {
    get: (name) => {
      const value = values[name];
      return value === undefined ? null : Array.isArray(value) ? (value[0] ?? null) : value;
    },
    getAll: (name) => {
      const value = values[name];
      return value === undefined ? [] : Array.isArray(value) ? value : [value];
    },
  };
}

/** Nấc chứa `x`: giá trị "low-high", "low-" hoặc "0". */
function band(options: { value: string }[], x: number): string {
  if (x === 0 && options.some((option) => option.value === "0")) return "0";
  for (const option of options) {
    const match = /^(\d+)-(\d*)$/.exec(option.value);
    if (match === null) continue;
    const high = match[2] === "" ? Infinity : Number(match[2]);
    if (x >= Number(match[1]) && x < high) return option.value;
  }
  throw new Error(`không có nấc cho ${x}: ${options.map((option) => option.value).join(",")}`);
}

function answerFor(spec: QuestionSpec, truth: Truth): AnswerForm | null {
  const options = spec.input.type === "choice" ? spec.input.options : [];
  switch (spec.kind) {
    case "goal_missing":
      return form({ answer: truth.goal });
    case "country_unknown":
      return form({ answer: "ca" });
    case "cards_undeclared":
      return truth.held.length + truth.closed.length === 0
        ? form({ none: "1" })
        : form({ holding: truth.held, closed: truth.closed.map((card) => card.slug) });
    case "balances_undeclared": {
      const programs = Object.keys(truth.balances);
      return programs.length === 0 ? form({ none: "1" }) : form({ programs });
    }
    case "point_balance_amount_unknown":
      return form({ answer: String(truth.balances[spec.subject] ?? 0) });
    case "minimum_spend_capacity_unknown":
      return form({ answer: band(options, truth.capacity) });
    case "spend_profile_missing":
    case "monthly_total_unknown":
      return form({ answer: band(options, truth.monthly) });
    case "spend_category_unknown":
      return form({ answer: band(options, truth.categories[spec.subject] ?? 0) });
    case "personal_income_unknown":
      return form({ answer: truth.personal === null ? "decline" : band(options, truth.personal) });
    case "household_income_unknown":
      return form({ answer: truth.household === null ? "decline" : band(options, truth.household) });
    case "annual_fee_tolerance_unknown":
      return form({ answer: truth.fee });
    case "business_cards_preference_unknown":
      return form({ answer: truth.businessAllowed ? "yes" : "no" });
    case "business_ownership_unknown":
      return form({ answer: truth.hasBusiness ? "yes" : "no" });
    case "student_status_unknown":
      return form({ answer: truth.student ? "yes" : "no" });
    case "trip_cabin_unknown":
      // Trang không đưa hạng không có giá; người muốn bay hạng nhất chọn thương gia.
      return form({ answer: options.some((option) => option.value === truth.cabin) ? truth.cabin : "business" });
    case "trip_passengers_unknown":
      return form({ answer: String(truth.passengers) });
    case "trip_round_trip_unknown":
      return form({ answer: truth.roundTrip ? "round" : "one_way" });
    case "trip_flexibility_unknown":
      return form({ answer: truth.flexibility });
    case "trip_dates_unknown":
      return form({ month: truth.travelMonth });
    case "card_closed_date_unknown": {
      if (spec.input.type !== "month") return null;
      const months = spec.input.months.map((row) => row.value);
      const month = truth.closed.find((card) => `uc_${card.slug}` === spec.subject)?.month;
      return form({ month: month !== undefined && months.includes(month) ? month : (months.at(-1) ?? "") });
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Đi luồng
 * ------------------------------------------------------------------ */

function loadOffers(): Promise<CreditCardOffer[]> {
  try {
    for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
      const match = /^(CONTENTFUL_[A-Z_]+)=(.*)$/.exec(line.trim());
      if (match !== null && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  } catch {
    // Không có .env.local: chạy không có chữ Contentful.
  }
  if (!process.env.CONTENTFUL_SPACE_ID || !process.env.CONTENTFUL_ACCESS_TOKEN) return Promise.resolve([]);
  return import("../src/lib/content/contentful.ts").then((module) => module.fetchContentfulCreditCardOffers());
}

const offers = await loadOffers();
const MAX_STEPS = 45;
const rows: WalkRow[] = [];
const issues = new Map<string, string[]>();
const issue = (kind: string, detail: string) => issues.set(kind, [...(issues.get(kind) ?? []), detail]);

for (let index = 0; index < N; index += 1) {
  const truth = makeTruth(index);
  const goal = goalFrom(truth.goal, truth.id, ASOF);
  let state: UserState = { ...newUserState(truth.id, ASOF, "CA"), goals: goal === null ? [] : [goal] };
  const skipped = new Set<string>();
  const asked = new Set<string>();
  let last: ReturnType<typeof run> | null = null;
  let view: ReturnType<typeof presentForPage>["view"] = null;
  let steps = 0;
  for (; steps < MAX_STEPS; steps += 1) {
    try {
      last = run(state, `${truth.id}_${steps}`);
    } catch (error) {
      issue("executeRun_throws", `${truth.id}: ${(error as Error).message.slice(0, 120)}`);
      break;
    }
    const page = presentForPage(last.record, last.dataset, offers, skipped);
    view = page.view;
    if (page.followUp === null) break;
    const key = questionKey(page.followUp.gapKind, page.followUp.subject);
    if (asked.has(key)) issue("asked_twice", `${truth.id}: ${key}`);
    asked.add(key);
    const spec = questionFor({ kind: page.followUp.gapKind, subject: page.followUp.subject }, state, ctx);
    if (spec === null) {
      issue("question_null", `${truth.id}: ${key}`);
      skipped.add(key);
      continue;
    }
    if (rnd() < truth.skip) {
      skipped.add(key);
      continue;
    }
    const answer = answerFor(spec, truth);
    const applied = answer === null ? null : applyAnswerChecked(state, spec, answer, ctx, validate);
    if (applied === null || !applied.ok) {
      issue("answer_rejected", `${truth.id}: ${key}`);
      skipped.add(key);
      continue;
    }
    state = applied.state;
  }
  if (steps >= MAX_STEPS) issue("too_many_steps", truth.id);
  const result = last?.record.outputSnapshot.results[0];
  if (result === undefined || view === null) {
    issue("no_view", truth.id);
    continue;
  }
  const winner = winnerOf(result);
  if (STAND_STILL.has(result.strategy.strategy) !== (result.primaryAction.kind === "no_new_card")) {
    issue("strategy_vs_winner", `${truth.id}: ${result.strategy.strategy} / ${winner}`);
  }
  // Một bit họ hướng đi là chưa đủ (Codex 24/10/2026): "Tích điểm ở nhiều
  // chương trình" trên một thẻ kiếm đúng đồng tiền người dùng đang dồn 100%
  // vẫn qua. Đối chiếu độc lập: chương trình của thẻ thắng ≠ hệ sinh thái đầu.
  const winnerProgram = data.products.find((product) => product.id === result.primaryAction.productId)?.pointsProgramId;
  const topEcosystem = last?.record.derivedState.portfolio.concentration[0]?.ecosystem;
  if (result.strategy.strategy === "DIVERSIFY" && winnerProgram != null && winnerProgram === topEcosystem) {
    issue("diversify_same_program", `${truth.id}: ${winner} / ${topEcosystem}`);
  }
  if (result.strategy.score <= 0 && result.strategy.strategy !== "OPEN_CARD" && result.strategy.strategy !== "NO_NEW_CARD") {
    issue("zero_score_strategy", `${truth.id}: ${result.strategy.strategy}`);
  }
  if (/undefined|NaN|\[object/.test(JSON.stringify(view))) issue("broken_text", truth.id);
  const held = new Set(state.cards.filter((card) => card.status === "active").map((card) => card.productId as string));
  if (result.primaryAction.productId !== null && held.has(result.primaryAction.productId)) {
    issue("recommends_held", `${truth.id}: ${winner}`);
  }
  rows.push({ id: truth.id, goal: truth.goal, winner, strategy: result.strategy.strategy, steps, state, truth });
}

/* ------------------------------------------------------------------ *
 * Báo cáo: phân bố người thắng — thứ lộ lỗi, không phải phép kiểm
 * ------------------------------------------------------------------ */

function top(list: readonly WalkRow[], limit = 6): string {
  const counts = new Map<string, number>();
  for (const row of list) counts.set(row.winner, (counts.get(row.winner) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([slug, count]) => `${slug} ${count}`).join(" · ");
}

const available = data.products.filter((product) =>
  isAvailableAt(data.productAvailability.filter((row) => row.productId === product.id), ASOF),
).length;
console.log(`asOf ${ASOF} · seed ${SEED} · ${rows.length} hồ sơ · ${available} thẻ còn bán · bước TB ${(rows.reduce((sum, row) => sum + row.steps, 0) / Math.max(1, rows.length)).toFixed(1)}`);
console.log(`người thắng: ${top(rows, 12)}`);
for (const goal of [...new Set(rows.map((row) => row.goal))].sort()) {
  const list = rows.filter((row) => row.goal === goal);
  console.log(`  ${goal} (${list.length}): ${top(list)}`);
}
// Chuyến bay có giá: đủ ba thừa số giá hay không — chỗ trống của chúng đổi cả bảng điểm.
const trips = rows.filter((row) => row.goal.startsWith("trip:") && row.goal !== "trip:CANADA_US");
const tripOf = (row: WalkRow) => row.state.goals.find((goal) => goal.type === "trip");
const complete = (row: WalkRow) => {
  const trip = tripOf(row);
  return trip?.type === "trip" && trip.cabin !== null && trip.passengers !== null && trip.roundTrip !== null;
};
console.log(`chuyến bay có giá, đủ hạng ghế/số người/khứ hồi (${trips.filter(complete).length}): ${top(trips.filter(complete))}`);
console.log(`chuyến bay có giá, thiếu một thừa số (${trips.filter((row) => !complete(row)).length}): ${top(trips.filter((row) => !complete(row)))}`);
for (const [kind, details] of issues) console.log(`! ${kind}: ${details.length}  ${details.slice(0, 4).join(" | ")}`);
if (issues.size === 0) console.log("✓ không câu hỏi lặp, không câu trả lời đúng bị từ chối, không chữ hỏng, hướng đi khớp người thắng");

const out = flag("out");
if (out !== null) {
  writeFileSync(path.resolve(out), JSON.stringify({ asOf: ASOF, rows } satisfies WalkFile));
  console.log(`đã ghi ${rows.length} trạng thái cuối → ${out}`);
}
