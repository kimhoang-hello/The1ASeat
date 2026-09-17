/**
 * Hợp đồng Phase 6 — LLM là lớp kể lại, không phải lớp quyết định.
 *
 * Bài nghiệm thu thật của Phase 6: gỡ LLM ra thì khuyến nghị vẫn ĐẦY ĐỦ, TẤT
 * ĐỊNH và GIẢI THÍCH ĐƯỢC từ dữ liệu có cấu trúc. Nên file này canh ba thứ:
 *
 *  1. Ranh giới — không file nào của engine hay lớp trình bày import Phase 6;
 *     payload là hàm thuần của `ResultView`, không mang hồ sơ, không mang
 *     affiliate, không mang lựa chọn khác.
 *  2. Cấu trúc — Claude không viết chữ. MỌI bản dựng qua được cửa kiểm, trên cả
 *     15 nhân vật mẫu, chỉ ghép ra chữ của câu dẫn + mệnh đề viết sẵn: không số
 *     lạ, không tên thẻ khác, ước lượng luôn mang nhãn và chữ "ước lượng". Mọi
 *     thứ mô hình tự viết thêm bị bỏ trước khi tới trang.
 *  3. Đường lui — mọi nhánh hỏng trả `null` (= bảng tra), câu hiện ra luôn là
 *     câu đã lưu, công tắc tắt cả bản đã lưu, và không có kho thì không hiện.
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
import {
  checkExplanation,
  LEAD_KEYS,
  LEADS,
  MAX_FACTS_PER_SENTENCE,
  renderExplanation,
  type ExplanationDraft,
  type LeadKey,
} from "./explain-check.ts";
import {
  EXPLANATION_PROMPT_VERSION,
  explainPrimaryAction,
  type ExplainDeps,
  type ExplanationModel,
} from "./explain-llm.ts";
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

/**
 * Mọi bản dựng "ngoan": mỗi câu dẫn hợp lệ với hành động, nhận mọi tổ hợp liên
 * tiếp tối đa 3 dữ kiện đúng vai. Không phải vét cạn tổ hợp, nhưng phủ mọi câu
 * dẫn × mọi dữ kiện × mọi độ dài câu.
 */
function validSentences(payload: ExplanationPayload): ExplanationDraft["sentences"] {
  const rows: ExplanationDraft["sentences"] = [];
  for (const lead of LEAD_KEYS) {
    const spec = LEADS[lead];
    if (spec.action !== null && spec.action !== payload.action.kind) continue;
    const facts = payload.facts.filter((fact) => (spec.roles as readonly string[]).includes(fact.role));
    for (let start = 0; start < facts.length; start += 1) {
      for (let size = 1; size <= MAX_FACTS_PER_SENTENCE && start + size <= facts.length; size += 1) {
        rows.push({ lead, facts: facts.slice(start, start + size).map((fact) => fact.id) });
      }
    }
  }
  return rows;
}

/** Bản dựng mô hình "ngoan nhất" sẽ trả: câu dẫn lý do + mọi lý do. */
function goodDraft(payload: ExplanationPayload): ExplanationDraft {
  const lead: LeadKey = payload.action.kind === "open_card" ? "why_card" : "why_wait";
  const reasons = payload.facts.filter((fact) => fact.role === "reason").slice(0, 3);
  const context = payload.facts.filter((fact) => fact.role === "context").slice(0, 1);
  return {
    sentences: [
      ...(reasons.length > 0 ? [{ lead, facts: reasons.map((fact) => fact.id) }] : []),
      { lead: "context" as const, facts: context.map((fact) => fact.id) },
    ],
  };
}

const numbersIn = (text: string) =>
  [...text.replace(/ghế 1a/giu, "").matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0].replace(/,/g, "")),
  );

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

test("payload là hàm thuần của ResultView, không đổi view, không mang hồ sơ, lựa chọn khác hay cảnh báo", () => {
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
    for (const warning of view.warnings) {
      assert.ok(!json.includes(warning), `cảnh báo lọt vào tay LLM: ${warning}`);
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

/* ------------------------------------------------------------------ *
 * 2. Cấu trúc
 * ------------------------------------------------------------------ */

test("mọi bản dựng hợp lệ trên 15 nhân vật mẫu chỉ ghép ra chữ viết sẵn — không số lạ, không thẻ khác, ước lượng luôn có nhãn", () => {
  const otherNames = (payload: ExplanationPayload) =>
    DATA.products.map((product) => product.name).filter((name) => name !== payload.action.name);
  let estimates = 0;
  let checked = 0;
  for (const state of USER_FIXTURES) {
    const payload = explanationPayload(viewFor(state));
    const factNumbers = new Set(payload.facts.flatMap((fact) => numbersIn(fact.text)));
    for (const fact of payload.facts) {
      assert.ok(!fact.text.endsWith("."), `${fact.id}: mệnh đề còn dấu chấm cuối`);
      if (fact.basis === "estimate") assert.match(fact.text, /ước lượng/, `${fact.id}: ước lượng không tự nói ra`);
    }
    for (const sentence of validSentences(payload)) {
      const draft = { sentences: [sentence] };
      const result = checkExplanation(payload, draft);
      assert.ok(result.ok, `${state.profile.id}: bản dựng hợp lệ bị từ chối — ${result.ok ? "" : result.problems.join("; ")}`);
      const [rendered] = renderExplanation(payload, result.draft);
      checked += 1;

      // Chữ = câu dẫn + đúng các mệnh đề, không hơn.
      const facts = sentence.facts.map((id) => payload.facts.find((fact) => fact.id === id)!);
      assert.ok(rendered.text.startsWith(`${LEADS[sentence.lead].text} `));
      for (const fact of facts) assert.ok(rendered.text.includes(fact.text));
      for (const value of numbersIn(rendered.text)) {
        assert.ok(factNumbers.has(value), `${state.profile.id}: số ${value} không có trong dữ kiện`);
      }
      for (const name of otherNames(payload)) {
        assert.ok(!rendered.text.includes(name), `${state.profile.id}: câu nhắc thẻ khác ${name}`);
      }
      if (facts.some((fact) => fact.basis === "estimate")) {
        estimates += 1;
        assert.equal(rendered.basis, "estimate");
        assert.match(rendered.text, /ước lượng/);
      } else if (facts.some((fact) => fact.basis === "editorial")) {
        assert.equal(rendered.basis, "editorial");
      } else {
        assert.equal(rendered.basis, "verified");
      }
    }
  }
  assert.ok(checked > 100, `chỉ kiểm ${checked} câu — bài không phủ`);
  assert.ok(estimates > 0, "không câu nào ghép dữ kiện ước lượng — bài nhãn không chạy");
});

test("cửa kiểm chặn bản dựng sai hình dạng; chữ mô hình tự viết không bao giờ tới trang", () => {
  const card = explanationPayload(viewFor(beginnerNoCards));
  assert.equal(card.action.kind, "open_card");
  const trip = explanationPayload(viewFor(japanTripShortfall));
  const view = viewFor(beginnerNoCards);
  const wait = explanationPayload({ ...view, primary: { ...view.primary, kind: "no_new_card", noCardReason: "offers_weak" } });
  const reason = card.facts.find((fact) => fact.role === "reason")!.id;

  const cases: Array<{ name: string; payload: ExplanationPayload; draft: unknown; expect: RegExp }> = [
    { name: "dữ kiện không có", payload: card, draft: { sentences: [{ lead: "why_card", facts: ["bonus_elevated"] }] }, expect: /không có: bonus_elevated/ },
    { name: "phí thường niên làm lý do", payload: card, draft: { sentences: [{ lead: "why_card", facts: ["fee"] }] }, expect: /fee \(offer\) không đi được/ },
    { name: "ước lượng dưới câu dẫn lý do", payload: trip, draft: { sentences: [{ lead: "also", facts: ["trip_need"] }] }, expect: /trip_need \(trip\)/ },
    { name: "'gợi ý thẻ' khi kết quả là chưa mở thẻ", payload: wait, draft: { sentences: [{ lead: "why_card", facts: ["no_card"] }] }, expect: /không dùng cho hành động no_new_card/ },
    { name: "'chưa cần mở thẻ' khi kết quả là mở thẻ", payload: card, draft: { sentences: [{ lead: "why_wait", facts: [reason] }] }, expect: /không dùng cho hành động open_card/ },
    { name: "một dữ kiện nói hai lần", payload: card, draft: { sentences: [{ lead: "why_card", facts: [reason] }, { lead: "also", facts: [reason] }] }, expect: /đã dùng ở câu trước/ },
    { name: "câu không dữ kiện", payload: card, draft: { sentences: [{ lead: "why_card", facts: [] }] }, expect: /có 0 dữ kiện/ },
    { name: "câu quá nhiều dữ kiện", payload: card, draft: { sentences: [{ lead: "context", facts: ["strategy", "strategy", "strategy", "strategy"] }] }, expect: /có 4 dữ kiện/ },
    { name: "quá nhiều câu", payload: card, draft: { sentences: Array.from({ length: 5 }, () => ({ lead: "context", facts: ["strategy"] })) }, expect: /có 5 câu/ },
    { name: "không câu nào", payload: card, draft: { sentences: [] }, expect: /có 0 câu/ },
    { name: "câu dẫn tự đặt", payload: card, draft: { sentences: [{ lead: "Chắc chắn bạn được duyệt, vì", facts: [reason] }] }, expect: /hình dạng/ },
    { name: "chữ tự do thay vì cấu trúc", payload: card, draft: { sentences: [{ text: "Bạn sẽ nhận được welcome bonus." }] }, expect: /hình dạng/ },
  ];
  for (const row of cases) {
    const result = checkExplanation(row.payload, row.draft);
    assert.equal(result.ok, false, `${row.name}: lọt qua cửa kiểm`);
    if (!result.ok) assert.match(result.problems.join("; "), row.expect, `${row.name}: chặn sai lý do — ${result.problems.join("; ")}`);
  }

  // Những câu Codex vòng 1–2 dùng để lách cửa kiểm chữ: đi kèm một bản dựng
  // HỢP LỆ, chúng bị bỏ ở `asDraft` và không bao giờ có mặt trong chữ ghép ra.
  const smuggled = [
    "Welcome bonus sẽ được cộng vào tài khoản của bạn.",
    "Phí thường niên: $3,000; mốc chi để nhận trọn welcome bonus: $120.",
    "Bạn sẽ nhận được welcome bonus của thẻ này; ngân hàng không từ chối.",
    "Chặng này có chỗ trống.",
  ];
  const result = checkExplanation(card, {
    sentences: [{ lead: "why_card", facts: [reason], text: smuggled[0] }],
    note: smuggled.slice(1).join(" "),
  });
  assert.ok(result.ok);
  const rendered = JSON.stringify(renderExplanation(card, result.draft));
  for (const text of smuggled) assert.ok(!rendered.includes(text), `chữ mô hình tự viết lọt ra trang: ${text}`);
});

test("bonus bị chặn: con số bonus không có trong payload, nên không bản dựng nào hứa được nó", () => {
  const view = viewFor(beginnerNoCards);
  const blocked = explanationPayload({ ...view, primary: { ...view.primary, welcomeBonusBlocked: true } });
  assert.ok(blocked.facts.some((fact) => fact.id === "bonus_blocked"));
  assert.ok(!blocked.facts.some((fact) => fact.id === "bonus" || fact.id === "min_spend"));
  assert.ok(!JSON.stringify(blocked).includes("60,000"));
  for (const sentence of validSentences(blocked)) {
    const [rendered] = renderExplanation(blocked, { sentences: [sentence] });
    assert.ok(!/nhận trọn|hiện hành là/.test(rendered.text), rendered.text);
  }
});

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
    allowCall: () => true,
    now: () => "2026-09-16T10:00:00.000Z",
    log: (message) => logs.push(message),
    ...overrides,
  };
  return { store, deps, logs, calls: () => calls };
}

/** Mô hình giả: trả `output` như Claude, dưới tên mô hình đã phục vụ. */
const served = (output: unknown, model = "claude-opus-5") => ({ output, model });
const GOOD: ExplanationModel = async (payload) => served(goodDraft(payload));
const BROKEN: ExplanationModel = async () => served({ sentences: [{ lead: "why_card", facts: ["bonus_elevated"] }] });

const inputFor = (view: ResultView) => ({ runId: view.runId, goalIndex: 0, payload: explanationPayload(view) });

test("bản qua cửa kiểm được LƯU cùng chữ đã ghép rồi mới hiện; lần sau đọc kho, không gọi lại mô hình", async () => {
  const view = viewFor(beginnerNoCards);
  const input = inputFor(view);
  const h = harness(async (payload) => served(goodDraft(payload), "claude-fallback-model"));
  const first = await explainPrimaryAction(input, h.deps);
  assert.ok(first !== null);
  const stored = await h.store.listForRun(view.runId);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "shown");
  assert.equal(stored[0].model, "claude-fallback-model", "bản ghi phải mang mô hình ĐÃ trả lời");
  assert.equal(stored[0].promptVersion, EXPLANATION_PROMPT_VERSION);
  assert.deepEqual(stored[0].rendered, first.sentences, "chữ hiện ra khác chữ đã lưu");
  assert.deepEqual(await explainPrimaryAction(input, h.deps), first);
  assert.equal(h.calls(), 1);
});

test("bản dựng hỏng bị từ chối: trang dùng bảng tra, bản từ chối được lưu kèm lý do, không sinh lại", async () => {
  const view = viewFor(beginnerNoCards);
  const input = inputFor(view);
  const h = harness(BROKEN);
  assert.equal(await explainPrimaryAction(input, h.deps), null);
  const [row] = await h.store.listForRun(view.runId);
  assert.equal(row.status, "rejected");
  assert.equal(row.draft, null);
  assert.equal(row.rendered, null);
  assert.ok(row.problems.length > 0);
  assert.deepEqual(row.raw, { sentences: [{ lead: "why_card", facts: ["bonus_elevated"] }] });
  assert.equal(await explainPrimaryAction(input, h.deps), null);
  assert.equal(h.calls(), 1);
});

test("mọi nhánh hỏng đều rơi về bảng tra", async () => {
  const input = inputFor(viewFor(japanTripShortfall));

  // Mô hình ném (timeout, quota, từ chối) → không lưu, lần sau thử lại.
  let fail = true;
  const flaky = harness(async (payload) => {
    if (fail) throw new Error("timeout");
    return GOOD(payload);
  });
  assert.equal(await explainPrimaryAction(input, flaky.deps), null);
  assert.equal((await flaky.store.listForRun(input.runId)).length, 0);
  fail = false;
  assert.ok((await explainPrimaryAction(input, flaky.deps)) !== null);

  // JSON sai hình dạng.
  assert.equal(await explainPrimaryAction(input, harness(async () => served("not json")).deps), null);

  // Quá trần chi phí → không gọi.
  const capped = harness(GOOD, { allowCall: () => false });
  assert.equal(await explainPrimaryAction(input, capped.deps), null);
  assert.equal(capped.calls(), 0);

  // Không có kho → không gọi mô hình, không hiện bản nào của Claude.
  const noStore = harness(GOOD, { store: null });
  assert.equal(await explainPrimaryAction(input, noStore.deps), null);
  assert.equal(noStore.calls(), 0);

  // Kho ghi hỏng → không hiện bản chưa lưu.
  const cannotWrite: ExplanationStore = {
    ...inMemoryExplanationStore(),
    save: async () => {
      throw new Error("database xuống");
    },
  };
  assert.equal(await explainPrimaryAction(input, harness(GOOD, { store: cannotWrite }).deps), null);

  // Kho đọc hỏng.
  const cannotRead: ExplanationStore = {
    ...inMemoryExplanationStore(),
    get: async () => {
      throw new Error("database xuống");
    },
  };
  assert.equal(await explainPrimaryAction(input, harness(GOOD, { store: cannotRead }).deps), null);
});

test("công tắc tắt (không key / RECO_LLM_EXPLAIN=0) tắt cả bản ĐÃ LƯU, không chỉ lượt gọi mới", async () => {
  const input = inputFor(viewFor(beginnerNoCards));
  const on = harness(GOOD);
  assert.ok((await explainPrimaryAction(input, on.deps)) !== null);
  const off = { ...on.deps, model: null };
  assert.equal(await explainPrimaryAction(input, off), null);
});

test("bản đã lưu đi lại qua cửa kiểm hiện hành; bản của version prompt khác không được đọc", async () => {
  const input = inputFor(viewFor(beginnerNoCards));
  const h = harness(GOOD);
  assert.ok((await explainPrimaryAction(input, h.deps)) !== null);
  const [row] = await h.store.listForRun(input.runId);

  // Bản "shown" GHÉP ĐƯỢC chữ nhưng sai luật hiện hành ("chưa cần mở thẻ" cho
  // kết quả mở thẻ) — chỉ lần kiểm lại lúc đọc mới chặn được nó.
  const stale = harness(GOOD);
  const reason = input.payload.facts.find((fact) => fact.role === "reason")!.id;
  await stale.store.save({ ...row, draft: { sentences: [{ lead: "why_wait", facts: [reason] }] } });
  assert.equal(await explainPrimaryAction(input, stale.deps), null);
  assert.equal(stale.calls(), 0, "bản lưu hỏng không được đổi thành một lượt gọi mới cùng khoá");

  // Bản của version cũ: khoá khác → dựng lại theo luật hiện hành.
  const old = harness(GOOD);
  await old.store.save({ ...row, promptVersion: "6.0.0" });
  assert.ok((await explainPrimaryAction(input, old.deps)) !== null);
  assert.equal(old.calls(), 1);
});

test("hai lần mở trang cùng lúc: cả hai hiện ĐÚNG bản được lưu trước", async () => {
  const input = inputFor(viewFor(beginnerNoCards));
  let turn = 0;
  const h = harness(async (payload) => {
    turn += 1;
    const draft = goodDraft(payload);
    return served(turn === 1 ? draft : { sentences: draft.sentences.slice(0, 1) });
  });
  const [a, b] = await Promise.all([explainPrimaryAction(input, h.deps), explainPrimaryAction(input, h.deps)]);
  assert.ok(a !== null && b !== null);
  assert.deepEqual(a, b);
  assert.equal((await h.store.listForRun(input.runId)).length, 1);
});

test("offer đổi trong ngày → payload mới, bản dựng mới; chữ cũ nhắc số cũ không hiện nữa", async () => {
  const record = recordFor(beginnerNoCards).record;
  const before = presentRun(record, DATA, offersFor(DATA))!;
  const after = presentRun(record, DATA, offersFor(DATA).map((offer) => ({ ...offer, welcomeBonus: "80,000 điểm" })))!;
  const h = harness(async () => served({ sentences: [{ lead: "cost", facts: ["bonus"] }] }));
  const first = await explainPrimaryAction(inputFor(before), h.deps);
  const second = await explainPrimaryAction(inputFor(after), h.deps);
  assert.ok(first !== null && second !== null);
  assert.match(first.sentences[0].text, /60,000/);
  assert.match(second.sentences[0].text, /80,000/);
  assert.equal(h.calls(), 2);
  assert.equal((await h.store.listForRun(record.id)).length, 2);
});

test("mô hình trả gì cũng không đổi được kết quả: presentRun sau mọi lượt giải thích y hệt trước", async () => {
  for (const state of USER_FIXTURES) {
    const record = recordFor(state).record;
    const before = JSON.stringify(presentRun(record, DATA, offersFor(DATA)));
    const view = presentRun(record, DATA, offersFor(DATA))!;
    for (const model of [GOOD, BROKEN, async () => served({ sentences: [], primary: "amex-cobalt", ranking: [] })]) {
      await explainPrimaryAction(inputFor(view), harness(model).deps);
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
    const shown = await explainPrimaryAction(inputFor(view), harness(GOOD, { store }).deps);
    assert.ok(shown !== null);

    const [row] = await store.listForRun(view.runId);
    assert.equal(row.status, "shown");
    assert.deepEqual(await store.get(row), row);

    // Trùng khoá: không ghi đè, trả bản đã có.
    const imposter: StoredExplanation = { ...row, status: "rejected", draft: null, rendered: null, problems: ["ghi đè"] };
    assert.deepEqual(await store.save(imposter), row);
    assert.deepEqual(await store.listForRun(view.runId), [row]);

    // Version khác là khoá khác.
    const next = await store.save({ ...row, promptVersion: "9.9.9" });
    assert.equal(next.promptVersion, "9.9.9");
    assert.equal((await store.listForRun(view.runId)).length, 2);

    // "shown" mà không có bản dựng hay chữ đã ghép → từ chối ở biên.
    await assert.rejects(store.save({ ...row, payloadFingerprint: "fp_other", draft: null }));
    await assert.rejects(store.save({ ...row, payloadFingerprint: "fp_other", rendered: null }));
    // Khoá lạ.
    await assert.rejects(store.get({ ...row, runId: "../etc" }));
    assert.equal(await store.get({ ...row, goalIndex: 1 }), null);
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
