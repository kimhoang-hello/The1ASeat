/**
 * Hợp đồng Phase 6 — LLM là lớp kể lại, không phải lớp quyết định.
 *
 * Bài nghiệm thu thật của Phase 6: gỡ LLM ra thì khuyến nghị vẫn ĐẦY ĐỦ, TẤT
 * ĐỊNH và GIẢI THÍCH ĐƯỢC từ dữ liệu có cấu trúc. Nên file này canh ba thứ:
 *
 *  1. Ranh giới — không file nào của engine hay lớp trình bày import Phase 6;
 *     payload là hàm thuần của `ResultView`, không mang hồ sơ, không mang
 *     affiliate, không mang lựa chọn khác.
 *  2. Cửa kiểm — Claude viết câu bịa theo từng điều cấm của §28, và từng câu
 *     phải bị chặn. Đồng thời câu CHÉP ĐÚNG dữ kiện của cả 15 nhân vật mẫu phải
 *     qua: một cửa kiểm từ chối oan thì trang lặng lẽ không bao giờ dùng LLM.
 *  3. Đường lui — mọi nhánh hỏng trả `null` (= bảng tra), câu hiện ra luôn là
 *     câu đã lưu, và không có kho thì không hiện câu nào của Claude.
 *
 * Không gọi mạng: mô hình là một hàm tiêm vào.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { after, test } from "node:test";
import { createConnection } from "mysql2/promise";

import type { CreditCardOffer } from "../content/types.ts";
import { offlineDataset } from "../recommendation/data/index.ts";
import {
  beginnerNoCards,
  japanTripShortfall,
  USER_FIXTURES,
  vietnamTripShortfall,
} from "../recommendation/data/user-fixtures.ts";
import { openRecoDatabase, type RecoDatabase } from "../recommendation/mysql.ts";
import { persistRun } from "../recommendation/run-store.ts";
import { mysqlRunStore } from "../recommendation/run-store-mysql.ts";
import { executeRun } from "../recommendation/runs.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import type { RecommendationDataset } from "../recommendation/types.ts";
import type { UserState } from "../recommendation/user-types.ts";
import { checkExplanation, numbersIn, type ExplanationDraft, type KnownNames } from "./explain-check.ts";
import { explainPrimaryAction, type ExplainDeps, type ExplanationModel } from "./explain-llm.ts";
import { explanationPayload, type ExplanationPayload } from "./explain-payload.ts";
import {
  inMemoryExplanationStore,
  mysqlExplanationStore,
  type ExplanationStore,
  type StoredExplanation,
} from "./explain-store.ts";
import { presentRun, type ResultView } from "./present.ts";

const ASOF = "2026-09-08";
const DATA = datasetAt(offlineDataset(), ASOF);
const NAMES: KnownNames = {
  products: DATA.products.map((product) => product.name),
  programs: DATA.pointsPrograms.map((program) => program.name),
};

function offersFor(data: RecommendationDataset, affiliate = true): CreditCardOffer[] {
  return data.products.map((product) => ({
    slug: product.slug,
    name: product.name,
    issuer: "Ngân hàng",
    image: `/${product.slug}.png`,
    cardImage: `/${product.slug}-card.png`,
    country: "CA" as const,
    annualFee: "$120",
    cardType: "travel",
    welcomeBonus: "60,000 điểm",
    headline: "",
    editorsTake: "",
    keyBenefits: [],
    elevatedBonus: false,
    applyUrl: affiliate
      ? `https://www.finlywealth.com/apply/${product.slug}`
      : `https://www.rbcroyalbank.com/apply/${product.slug}`,
  }));
}

let counter = 0;
function recordFor(state: UserState, data: RecommendationDataset = DATA) {
  counter += 1;
  return executeRun(
    { state, data, asOf: ASOF },
    { id: `run_explain_${counter}`, createdAt: "2026-09-08T12:00:00.000Z", userId: "u_test" },
  );
}

function viewFor(state: UserState): ResultView {
  const view = presentRun(recordFor(state).record, DATA, offersFor(DATA));
  assert.ok(view !== null);
  return view;
}

/** Câu chép NGUYÊN dữ kiện — thứ một mô hình ngoan nhất có thể viết. */
function echo(payload: ExplanationPayload, pick: (facts: ExplanationPayload["facts"]) => ExplanationPayload["facts"]): ExplanationDraft {
  return {
    sentences: pick(payload.facts).map((fact) => ({ text: fact.text, facts: [fact.id], basis: fact.basis })),
  };
}

function fact(payload: ExplanationPayload, id: string) {
  const row = payload.facts.find((candidate) => candidate.id === id);
  assert.ok(row, `thiếu dữ kiện ${id}`);
  return row;
}

/* ------------------------------------------------------------------ *
 * 1. Ranh giới
 * ------------------------------------------------------------------ */

test("gỡ LLM: engine và lớp trình bày không import Phase 6 hay SDK của Claude", async () => {
  const root = path.resolve(import.meta.dirname, "..", "..");
  const engineDir = path.join(root, "lib", "recommendation");
  const engineFiles = (await readdir(engineDir, { recursive: true }))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(engineDir, file));
  // Lớp trình bày Phase 5: dựng trang ĐẦY ĐỦ không cần một dòng nào của Phase 6.
  const presentation = ["present.ts", "copy.ts", "questions.ts", "follow-up.ts", "path.ts"].map((file) =>
    path.join(root, "lib", "recommender", file),
  );
  const resultComponent = path.join(root, "components", "recommender", "result.tsx");
  const forbidden = /from\s+["'][^"']*(explain-|explanation|@anthropic-ai\/sdk|rewrite-offer)[^"']*["']/;
  for (const file of [...engineFiles, ...presentation, resultComponent]) {
    const source = await readFile(file, "utf8");
    assert.ok(!forbidden.test(source), `${path.relative(root, file)} phụ thuộc vào lớp LLM`);
  }
});

test("payload là hàm thuần của ResultView, không đổi view, không mang hồ sơ hay lựa chọn khác", () => {
  for (const state of [beginnerNoCards, japanTripShortfall, vietnamTripShortfall]) {
    const executed = recordFor(state);
    const view = presentRun(executed.record, DATA, offersFor(DATA));
    assert.ok(view !== null);
    const before = JSON.stringify(view);
    const payload = explanationPayload(deepFreeze(structuredClone(view)));
    assert.equal(JSON.stringify(view), before);
    assert.deepEqual(explanationPayload(view), payload, "cùng view phải ra cùng payload");

    const json = JSON.stringify(payload);
    assert.ok(!json.includes(executed.record.id), "payload mang runId");
    assert.ok(!json.includes("u_test"), "payload mang id người dùng");
    assert.ok(!json.includes("http"), "payload mang link");
    assert.ok(!/score|weight|contribution/.test(json), "payload mang điểm số");
    for (const alternative of view.alternatives) {
      if (alternative.name === view.primary.name) continue;
      assert.ok(!json.includes(alternative.name), `payload nhắc lựa chọn khác: ${alternative.name}`);
    }
  }
});

test("affiliate không chạm tới payload: bật/tắt cờ và link của mọi thẻ → payload y hệt từng byte", () => {
  const on: RecommendationDataset = {
    ...DATA,
    products: DATA.products.map((product) => ({ ...product, affiliateAvailable: true })),
  };
  const off: RecommendationDataset = {
    ...DATA,
    products: DATA.products.map((product) => ({ ...product, affiliateAvailable: false })),
  };
  for (const state of USER_FIXTURES) {
    const a = presentRun(recordFor(state, on).record, on, offersFor(on, true));
    const b = presentRun(recordFor(state, off).record, off, offersFor(off, false));
    assert.ok(a !== null && b !== null);
    assert.equal(JSON.stringify(explanationPayload(a)), JSON.stringify(explanationPayload(b)));
  }
});

test("mọi dữ kiện mang đúng một nhãn, và dữ kiện ước lượng tự nói mình là ước lượng", () => {
  for (const state of USER_FIXTURES) {
    const payload = explanationPayload(viewFor(state));
    const ids = payload.facts.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length, "id dữ kiện trùng");
    for (const row of payload.facts) {
      if (row.basis === "estimate") assert.match(row.text, /ước lượng/);
    }
  }
});

/* ------------------------------------------------------------------ *
 * 2. Cửa kiểm
 * ------------------------------------------------------------------ */

test("câu chép đúng dữ kiện của cả 15 nhân vật mẫu đều QUA cửa kiểm", () => {
  let estimates = 0;
  for (const state of USER_FIXTURES) {
    const payload = explanationPayload(viewFor(state));
    estimates += payload.facts.filter((row) => row.basis === "estimate").length;
    for (const draft of [echo(payload, (rows) => rows.slice(0, 4)), echo(payload, (rows) => rows.slice(-4))]) {
      const result = checkExplanation(payload, draft, NAMES);
      assert.ok(result.ok, `${state.profile.id}: ${result.ok ? "" : result.problems.join("; ")}`);
    }
  }
  assert.ok(estimates > 0, "không nhân vật nào có dữ kiện ước lượng — bài nhãn không chạy");
});

test("câu văn tự nhiên trộn nhiều dữ kiện vẫn qua", () => {
  const payload = explanationPayload(viewFor(japanTripShortfall));
  const need = fact(payload, "trip_need");
  const range = need.text.slice(need.text.lastIndexOf(":") + 2, -1);
  const result = checkExplanation(
    payload,
    {
      sentences: [
        { text: `Chuyến bay bạn khai cần khoảng ${range}, theo ước lượng của mình từ award chart.`, facts: ["trip_need", "trip"], basis: "estimate" },
        { text: fact(payload, "strategy").text, facts: ["strategy"], basis: "editorial" },
      ],
    },
    NAMES,
  );
  assert.ok(result.ok, result.ok ? "" : result.problems.join("; "));
});

/** Mỗi ca: một câu bịa theo đúng một điều cấm → phải bị chặn, và chặn vì đúng lý do. */
test("cửa kiểm chặn từng điều cấm của §28", () => {
  const card = explanationPayload(viewFor(beginnerNoCards));
  assert.equal(card.action.kind, "open_card");
  const trip = explanationPayload(viewFor(japanTripShortfall));
  const bonus = fact(card, "bonus");
  const need = fact(trip, "trip_need");
  const firstNeed = numbersIn(need.text).at(-1)!;
  const otherCard = DATA.products.find((product) => !card.facts.some((row) => row.text.includes(product.name)) && product.name !== card.action.name)!;

  // Ngân hàng viết tắt KHÁC ngân hàng của thẻ chính — "TD", "RBC", "BMO".
  const otherIssuer = ["TD", "RBC", "BMO"].find((acronym) => !JSON.stringify(card).includes(acronym))!;
  const view = viewFor(beginnerNoCards);
  const blocked = explanationPayload({ ...view, primary: { ...view.primary, welcomeBonusBlocked: true } });
  const reason = card.facts.find((row) => row.basis === "editorial" && row.id !== "goal")!;
  const focus = explanationPayload({ ...view, strategy: "Tập trung tìm chỗ trống" });
  const cobaltProduct = DATA.products.find((product) => product.slug === "amex-cobalt")!;
  const goldName = DATA.products.find((product) => product.slug === "amex-gold-rewards")!.name;
  const cobalt = explanationPayload({ ...view, primary: { ...view.primary, name: cobaltProduct.name } });
  const cobaltReason = cobalt.facts.find((row) => row.basis === "editorial" && row.id !== "goal")!.id;

  const cases: Array<{ name: string; payload: ExplanationPayload; draft: unknown; expect: RegExp }> = [
    { name: "số bịa", payload: card, draft: one("Welcome bonus hiện hành của thẻ: 90,000 điểm.", ["bonus"], "verified"), expect: /con số không có/ },
    { name: "số của dữ kiện KHÁC", payload: trip, draft: one(`Phí thường niên đi kèm ${firstNeed.toLocaleString("en-US")} điểm.`, ["trip"], "verified"), expect: /con số không có/ },
    { name: "dữ kiện không có", payload: card, draft: one(bonus.text, ["bonus_elevated"], "verified"), expect: /không có: bonus_elevated/ },
    { name: "không trích gì", payload: card, draft: one(bonus.text, [], "verified"), expect: /không trích/ },
    { name: "ước lượng đội lốt dữ kiện", payload: trip, draft: one(need.text, ["trip_need"], "verified"), expect: /nhãn "verified"/ },
    { name: "ước lượng không nói ra", payload: trip, draft: one(`Chuyến này cần ${need.text.slice(need.text.lastIndexOf(":") + 2)}`, ["trip_need"], "estimate"), expect: /không nói ra là ước lượng/ },
    { name: "chọn thẻ khác", payload: card, draft: one(`Nếu muốn, ${otherCard.name} cũng đáng cân nhắc.`, [reason.id], "editorial"), expect: /nhắc tên không có/ },
    { name: "chọn thẻ khác bằng tên viết tắt", payload: card, draft: one(`Nếu thích ${otherIssuer} thì cũng được.`, [reason.id], "editorial"), expect: new RegExp(`nhắc tên không có trong dữ kiện: .*${otherIssuer.toLowerCase()}`) },
    { name: "hứa được duyệt", payload: card, draft: one("Hồ sơ của bạn gần như chắc được duyệt.", [reason.id], "editorial"), expect: /được duyệt/ },
    { name: "hứa chắc chắn", payload: trip, draft: one("Với số điểm ước lượng này bạn chắc chắn có chuyến đi.", ["trip_need"], "estimate"), expect: /hứa chắc chắn/ },
    { name: "đảm bảo", payload: card, draft: one("Thẻ này đảm bảo bạn có vé.", [reason.id], "editorial"), expect: /hứa chắc chắn/ },
    { name: "bịa chỗ trống", payload: trip, draft: one("Chặng này còn ghế thưởng, theo ước lượng của mình.", ["trip_need"], "estimate"), expect: /chỗ trống/ },
    { name: "bịa điều kiện", payload: card, draft: one("Bạn cần điểm tín dụng tốt để mở thẻ này.", [reason.id], "editorial"), expect: /điều kiện mở thẻ/ },
    { name: "trấn an ngược cảnh báo", payload: card, draft: one("Bạn cứ yên tâm, mốc chi không có gì khó.", [reason.id], "editorial"), expect: /trấn an/ },
    { name: "so sánh tuyệt đối", payload: card, draft: one("Đây là thẻ tốt nhất cho bạn.", [reason.id], "editorial"), expect: /tuyệt đối/ },
    { name: "affiliate", payload: card, draft: one("Đăng ký qua link để mình nhận hoa hồng.", [reason.id], "editorial"), expect: /affiliate/ },
    { name: "số kiểu Việt Nam", payload: card, draft: one("Welcome bonus hiện hành của thẻ: 60.000 điểm.", ["bonus"], "verified"), expect: /sai quy ước|con số không có/ },
    { name: "số viết bằng chữ", payload: card, draft: one("Welcome bonus là sáu mươi nghìn điểm.", ["bonus"], "verified"), expect: /bằng chữ/ },
    { name: "bonus bị chặn mà vẫn hứa", payload: blocked, draft: one("Mở thẻ này bạn sẽ nhận được welcome bonus.", ["bonus_blocked"], "verified"), expect: /bonus bị chặn/ },
    // Bốn câu Codex vòng 1 viết để lách danh sách cụm cấm — mỗi câu nói điều
    // không có trong dữ kiện mà không chạm cụm nào.
    { name: "hứa bonus bị chặn không dùng chữ 'nhận'", payload: blocked, draft: one("Welcome bonus sẽ được cộng vào tài khoản của bạn.", ["bonus_blocked"], "verified"), expect: /bonus bị chặn/ },
    { name: "nói ngược cảnh báo", payload: card, draft: one("Offer này còn lâu mới hết hạn.", ["goal"], "editorial"), expect: /chữ không có trong dữ kiện trích: .*lâu/ },
    { name: "biến lời khuyên 'tìm chỗ trống' thành chỗ trống có thật", payload: focus, draft: one("Bạn có chỗ trống cho chuyến bay này.", ["strategy"], "editorial"), expect: /chỗ trống/ },
    { name: "thẻ khác cùng ngân hàng, tên toàn từ chung", payload: cobalt, draft: one(`${goldName} cũng là một lựa chọn cho bạn.`, [cobaltReason], "editorial"), expect: /nhắc tên không có trong dữ kiện: .*gold/ },
    { name: "quá nhiều câu", payload: card, draft: { sentences: Array.from({ length: 5 }, () => ({ text: bonus.text, facts: ["bonus"], basis: "verified" })) }, expect: /có 5 câu/ },
    { name: "sai hình dạng", payload: card, draft: { text: "Thẻ này hợp với bạn." }, expect: /hình dạng/ },
  ];

  for (const row of cases) {
    const result = checkExplanation(row.payload, row.draft, NAMES);
    assert.equal(result.ok, false, `${row.name}: lọt qua cửa kiểm`);
    if (!result.ok) assert.match(result.problems.join("; "), row.expect, `${row.name}: chặn sai lý do — ${result.problems.join("; ")}`);
  }

  // Nói ĐÚNG cảnh báo thì không bị chặn nhầm.
  const honest = checkExplanation(blocked, one("Bạn sẽ không nhận được welcome bonus của thẻ này.", ["bonus_blocked"], "verified"), NAMES);
  assert.ok(honest.ok, honest.ok ? "" : honest.problems.join("; "));
  assert.ok(!JSON.stringify(blocked).includes("60,000"), "bonus bị chặn mà con số bonus vẫn vào payload");
});

function one(text: string, facts: string[], basis: string) {
  return { sentences: [{ text, facts, basis }] };
}

/* ------------------------------------------------------------------ *
 * 3. Đường lui và lưu trữ
 * ------------------------------------------------------------------ */

function harness(model: ExplanationModel | null, overrides: Partial<ExplainDeps> = {}) {
  const store = inMemoryExplanationStore();
  let calls = 0;
  const logs: string[] = [];
  const deps: ExplainDeps = {
    store,
    model: model === null ? null : async (payload) => {
      calls += 1;
      return model(payload);
    },
    names: NAMES,
    allowCall: () => true,
    now: () => "2026-09-16T10:00:00.000Z",
    log: (message) => logs.push(message),
    ...overrides,
  };
  return { store, deps, logs, calls: () => calls };
}

/** Mô hình giả: trả `output` như Claude, dưới tên mô hình đã phục vụ. */
const served = (output: unknown, model = "claude-opus-5") => ({ output, model });
const GOOD: ExplanationModel = async (payload) => served(echo(payload, (rows) => rows.slice(0, 2)));
const LIAR: ExplanationModel = async () => served(one("Thẻ này đảm bảo bạn được duyệt.", ["goal"], "editorial"));

test("câu qua cửa kiểm được LƯU rồi mới hiện; lần sau đọc kho, không gọi lại mô hình", async () => {
  const view = viewFor(beginnerNoCards);
  const input = { runId: view.runId, goalIndex: 0, payload: explanationPayload(view) };
  const h = harness(GOOD);
  const first = await explainPrimaryAction(input, h.deps);
  assert.ok(first !== null);
  const stored = await h.store.listForRun(view.runId);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "shown");
  assert.deepEqual(stored[0].draft?.sentences, first.sentences, "câu hiện ra khác câu đã lưu");
  assert.deepEqual(await explainPrimaryAction(input, h.deps), first);
  assert.equal(h.calls(), 1);
});

test("câu bịa bị từ chối: trang dùng bảng tra, bản từ chối được lưu kèm lý do, không sinh lại", async () => {
  const view = viewFor(beginnerNoCards);
  const input = { runId: view.runId, goalIndex: 0, payload: explanationPayload(view) };
  const h = harness(LIAR);
  assert.equal(await explainPrimaryAction(input, h.deps), null);
  const [row] = await h.store.listForRun(view.runId);
  assert.equal(row.status, "rejected");
  assert.equal(row.draft, null);
  assert.ok(row.problems.length > 0);
  assert.deepEqual(row.raw, one("Thẻ này đảm bảo bạn được duyệt.", ["goal"], "editorial"));
  assert.equal(await explainPrimaryAction(input, h.deps), null);
  assert.equal(h.calls(), 1);
});

test("mọi nhánh hỏng đều rơi về bảng tra", async () => {
  const view = viewFor(japanTripShortfall);
  const input = { runId: view.runId, goalIndex: 0, payload: explanationPayload(view) };

  // Không có mô hình (không key / RECO_LLM_EXPLAIN=0).
  assert.equal(await explainPrimaryAction(input, harness(null).deps), null);

  // Mô hình ném (timeout, quota, từ chối) → không lưu, lần sau thử lại.
  let fail = true;
  const flaky = harness(async (payload) => {
    if (fail) throw new Error("timeout");
    return GOOD(payload);
  });
  assert.equal(await explainPrimaryAction(input, flaky.deps), null);
  assert.equal((await flaky.store.listForRun(view.runId)).length, 0);
  fail = false;
  assert.ok((await explainPrimaryAction(input, flaky.deps)) !== null);

  // JSON trả về sai hình dạng.
  assert.equal(await explainPrimaryAction(input, harness(async () => served("not json")).deps), null);

  // Quá trần chi phí → không gọi.
  const capped = harness(GOOD, { allowCall: () => false });
  assert.equal(await explainPrimaryAction(input, capped.deps), null);
  assert.equal(capped.calls(), 0);

  // Không có kho → không gọi mô hình, không hiện câu nào của Claude.
  const noStore = harness(GOOD, { store: null });
  assert.equal(await explainPrimaryAction(input, noStore.deps), null);
  assert.equal(noStore.calls(), 0);

  // Kho ghi hỏng → không hiện câu chưa lưu.
  const broken: ExplanationStore = {
    ...inMemoryExplanationStore(),
    save: async () => {
      throw new Error("database xuống");
    },
  };
  assert.equal(await explainPrimaryAction(input, harness(GOOD, { store: broken }).deps), null);

  // Kho đọc hỏng.
  const unreadable: ExplanationStore = {
    ...inMemoryExplanationStore(),
    get: async () => {
      throw new Error("database xuống");
    },
  };
  assert.equal(await explainPrimaryAction(input, harness(GOOD, { store: unreadable }).deps), null);
});

test("hai lần mở trang cùng lúc: cả hai hiện ĐÚNG bản được lưu trước", async () => {
  const view = viewFor(beginnerNoCards);
  const input = { runId: view.runId, goalIndex: 0, payload: explanationPayload(view) };
  let turn = 0;
  const h = harness(async (payload) => {
    turn += 1;
    return served(turn === 1 ? echo(payload, (rows) => rows.slice(0, 1)) : echo(payload, (rows) => rows.slice(0, 2)));
  });
  const [a, b] = await Promise.all([explainPrimaryAction(input, h.deps), explainPrimaryAction(input, h.deps)]);
  assert.ok(a !== null && b !== null);
  assert.deepEqual(a, b);
  assert.equal((await h.store.listForRun(view.runId)).length, 1);
});

test("offer đổi trong ngày → payload mới, lời giải thích mới; câu cũ nhắc số cũ không hiện nữa", async () => {
  const record = recordFor(beginnerNoCards).record;
  const before = presentRun(record, DATA, offersFor(DATA))!;
  const after = presentRun(
    record,
    DATA,
    offersFor(DATA).map((offer) => ({ ...offer, welcomeBonus: "80,000 điểm" })),
  )!;
  // Mô hình kể lại đúng dữ kiện welcome bonus — thứ vừa đổi.
  const h = harness(async (payload) => served(echo(payload, (rows) => rows.filter((row) => row.id === "bonus"))));
  const first = await explainPrimaryAction({ runId: record.id, goalIndex: 0, payload: explanationPayload(before) }, h.deps);
  const second = await explainPrimaryAction({ runId: record.id, goalIndex: 0, payload: explanationPayload(after) }, h.deps);
  assert.ok(first !== null && second !== null);
  assert.match(first.sentences[0].text, /60,000/);
  assert.match(second.sentences[0].text, /80,000/);
  assert.equal(h.calls(), 2);
  assert.equal((await h.store.listForRun(record.id)).length, 2);
});

test("LLM hỏng kiểu nào cũng không đổi được kết quả: presentRun sau mọi lượt giải thích y hệt trước", async () => {
  for (const state of USER_FIXTURES) {
    const record = recordFor(state).record;
    const before = JSON.stringify(presentRun(record, DATA, offersFor(DATA)));
    const view = presentRun(record, DATA, offersFor(DATA))!;
    for (const model of [GOOD, LIAR, async () => served({ sentences: [], primary: "amex-cobalt" })]) {
      await explainPrimaryAction({ runId: view.runId, goalIndex: 0, payload: explanationPayload(view) }, harness(model).deps);
    }
    assert.equal(JSON.stringify(view), before);
    assert.equal(JSON.stringify(presentRun(record, DATA, offersFor(DATA))), before);
  }
});

/* ------------------------------------------------------------------ *
 * Kho — một bộ bài cho mọi backend
 * ------------------------------------------------------------------ */

const MYSQL_URL = process.env.RECO_TEST_MYSQL_URL;
if (process.env.CI && !MYSQL_URL) {
  throw new Error("CI mà thiếu RECO_TEST_MYSQL_URL — kho lời giải thích trên MySQL sẽ không được kiểm");
}

const cleanups: Array<() => Promise<void>> = [];
after(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

async function freshMysql(): Promise<RecoDatabase> {
  const name = `ghe1a_explain_test_${process.pid}_${(counter += 1)}`;
  const admin = await createConnection(MYSQL_URL!);
  await admin.query(`CREATE DATABASE \`${name}\``);
  const url = new URL(MYSQL_URL!);
  url.pathname = `/${name}`;
  const db = openRecoDatabase({ uri: url.toString() });
  cleanups.push(async () => {
    await db.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  });
  return db;
}

const BACKENDS: Array<{
  name: string;
  skip: string | false;
  /** Kho + một hàm bảo đảm lượt chạy tồn tại (MySQL có khoá ngoại tới `reco_runs`). */
  make(): Promise<{ store: ExplanationStore; ensureRun(state: UserState): Promise<ResultView> }>;
}> = [
  {
    name: "bộ nhớ",
    skip: false,
    async make() {
      return { store: inMemoryExplanationStore(), ensureRun: async (state) => viewFor(state) };
    },
  },
  {
    name: "MySQL",
    skip: MYSQL_URL ? false : "RECO_TEST_MYSQL_URL chưa đặt — bỏ qua backend MySQL",
    async make() {
      const db = await freshMysql();
      const runs = mysqlRunStore(db);
      return {
        store: mysqlExplanationStore(db),
        async ensureRun(state) {
          const executed = recordFor(state);
          await persistRun(runs, executed);
          return presentRun(executed.record, DATA, offersFor(DATA))!;
        },
      };
    },
  },
];

for (const backend of BACKENDS) {
  test(`kho lời giải thích (${backend.name}): chỉ thêm, trùng khoá trả bản cũ, liệt kê theo lượt chạy`, { skip: backend.skip }, async () => {
    const { store, ensureRun } = await backend.make();
    const view = await ensureRun(beginnerNoCards);
    const h = harness(GOOD, { store });
    const shown = await explainPrimaryAction({ runId: view.runId, goalIndex: 0, payload: explanationPayload(view) }, h.deps);
    assert.ok(shown !== null);

    const [row] = await store.listForRun(view.runId);
    assert.equal(row.status, "shown");
    assert.deepEqual(await store.get(row.runId, row.goalIndex, row.payloadFingerprint), row);

    // Trùng khoá: không ghi đè, trả bản đã có.
    const imposter: StoredExplanation = { ...row, status: "rejected", draft: null, problems: ["ghi đè"] };
    assert.deepEqual(await store.save(imposter), row);
    assert.deepEqual(await store.listForRun(view.runId), [row]);

    // "shown" mà không có câu → từ chối ở biên.
    await assert.rejects(store.save({ ...row, payloadFingerprint: "fp_other", draft: null }));
    // Khoá lạ.
    await assert.rejects(store.get("../etc", 0, row.payloadFingerprint));
    assert.equal(await store.get(row.runId, 1, row.payloadFingerprint), null);
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
