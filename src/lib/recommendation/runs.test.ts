/**
 * Phase 4 — `recommendation_runs` (§20) và debugger (§22).
 *
 * Mỗi bài dưới đây phải GỌI thứ nó kiểm và phải ĐỎ được — phép thử của bàn
 * giao Phase 3, sau ba bài test xanh mà không bảo vệ gì.
 *
 * KHÔNG import `./index.ts` — xem đầu `engine.test.ts`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { offlineDataset } from "./data/index.ts";
import { datasetAt } from "./temporal.ts";
import { indexDataset } from "./indexes.ts";
import { ENGINE_VERSION, recommend } from "./engine.ts";
import { canonicalJson, fingerprint } from "./fingerprint.ts";
import { executeRun, inputOf, replayRun, type RecommendationRunRecord } from "./runs.ts";
import { inMemoryRunStore } from "./run-store.ts";
import { fileRunStore } from "./run-store-fs.ts";
import {
  candidateKey,
  deepDiff,
  diffDatasets,
  diffRecords,
  explainChange,
  firstComputedDivergence,
  PIPELINE_STAGES,
} from "./run-diff.ts";
import { compareCandidates, eligibilityUnknownCauses, explainProduct, provenanceFor, scoreBreakdown } from "./debug.ts";
import {
  renderChangeExplanation,
  renderProductExplanation,
  renderRunReport,
  renderScoreTable,
} from "./debug-render.ts";
import { productIdFor } from "./data/products.ts";
import {
  USER_FIXTURES,
  aeroplanHeavy,
  beginnerNoCards,
  flexiblePointsSufficient,
  japanTripFunded,
  vietnamTripFunded,
  vietnamTripShortfall,
} from "./data/user-fixtures.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { RecommendationDataset } from "./types.ts";
import { amountRange, type UserState } from "./user-types.ts";
import { validateDataset } from "./validate.ts";

const ASOF = "2026-09-08";
const DATA = datasetAt(offlineDataset(), ASOF);
const IX = indexDataset(DATA);

let counter = 0;
function execute(state: UserState, extra: Partial<Parameters<typeof executeRun>[0]> = {}) {
  counter += 1;
  return executeRun(
    { state, data: DATA, asOf: ASOF, ...extra },
    { id: `run_test_${counter}`, createdAt: "2026-09-12T00:00:00.000Z" },
  );
}

/** Hồ sơ HỎNG mà engine vẫn phải chịu — cùng bộ với `engine.test.ts`. */
const BROKEN: UserState[] = [
  { ...vietnamTripFunded, profile: undefined },
  { ...vietnamTripFunded, profile: { ...vietnamTripFunded.profile, country: undefined } },
] as never as UserState[];

const ALL_STATES = [...USER_FIXTURES, ...BROKEN];

/* ================================================================== *
 * §20 — lưu, chạy lại, tái lập
 * ================================================================== */

test("§20 — engine chạy trên bản ĐÃ QUA JSON cho ra ĐÚNG đầu ra như trên object gốc", () => {
  // `executeRun` cho engine ăn đúng bản sẽ nằm trong kho. Nếu hai lượt khác
  // nhau thì engine đang đọc một khác biệt mà JSON xoá mất (`undefined`,
  // thứ tự khoá), và mọi lượt chạy lưu lại sẽ không tái lập được.
  for (const state of ALL_STATES) {
    const direct = recommend({ state, data: DATA, ix: IX, asOf: ASOF });
    const { run } = execute(state);
    assert.equal(canonicalJson(run), canonicalJson(direct), `lệch ở ${state.profile?.id ?? "hồ sơ vắng"}`);
  }
});

test("§20 — derived state đi qua JSON NGUYÊN VẸN: không Map, không Set, không số vô hạn", () => {
  const walk = (value: unknown, at: string) => {
    if (value instanceof Map || value instanceof Set) assert.fail(`${at} là Map/Set — thành {} khi lưu`);
    if (typeof value === "number") assert.ok(Number.isFinite(value), `${at} = ${value} — JSON ghi thành null`);
    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) walk(child, `${at}.${key}`);
    }
    if (value === undefined) assert.fail(`${at} là undefined — biến mất khi lưu`);
  };
  for (const state of ALL_STATES) {
    const { run } = execute(state);
    walk(run, state.profile?.id ?? "vắng");
    const back = JSON.parse(JSON.stringify(run));
    assert.deepEqual(back, JSON.parse(canonicalJson(run)));
  }
});

test("§20 — mọi nhân vật chạy lại từ KHO FILE ra đúng từng chữ số", async () => {
  // Kho file đi qua JSON THẬT trên đĩa — đúng chỗ Map, undefined, -0 biến
  // dạng. Kho bộ nhớ không bắt được những thứ đó.
  const dir = await mkdtemp(path.join(tmpdir(), "reco-runs-"));
  try {
    const store = fileRunStore(dir);
    for (const state of ALL_STATES) {
      const { record, dataset } = execute(state, {
        offerHistory: new Map([[productIdFor("amex-cobalt") as string, SAMPLE_HISTORY]]),
      });
      await store.saveDataset(record.inputSnapshot.datasetFingerprint, dataset);
      await store.saveRun(record);
      const loaded = await store.getRun(record.id);
      const snapshot = await store.getDataset(record.inputSnapshot.datasetFingerprint);
      assert.ok(loaded !== null && snapshot !== null);
      const replay = replayRun(loaded, snapshot);
      assert.ok(replay.identical, `chạy lại ${record.id} không khớp`);
      assert.equal(replay.regression, false);
    }
    // Bộ dữ liệu lưu MỘT lần dù mười bảy lượt chạy cùng đọc nó.
    const { readdir } = await import("node:fs/promises");
    assert.equal((await readdir(path.join(dir, "datasets"))).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const SAMPLE_HISTORY: OfferHistoryPoint[] = [
  { at: "2026-01-01", until: "2026-03-01", startCensored: true, endCensored: false, label: "10,000 điểm", amount: 10_000, unit: "points" },
  { at: "2026-03-01", until: "2026-06-01", startCensored: false, endCensored: false, label: "12,000 điểm", amount: 12_000, unit: "points" },
  { at: "2026-06-01", until: null, startCensored: false, endCensored: true, label: "15,000 điểm", amount: 15_000, unit: "points" },
];

test("§20 — lịch sử offer là ĐẦU VÀO: thiếu nó thì chạy lại ra khác", () => {
  // Thứ dễ quên nhất khi dựng `input_snapshot`: nó là tham số của
  // `recommend()`, không nằm trong bộ dữ liệu. Bài này chứng minh nó thật sự
  // đổi kết quả — nếu không, việc lưu nó là trang trí.
  const cobalt = productIdFor("amex-cobalt") as string;
  const withHistory = execute(aeroplanHeavy, { offerHistory: new Map([[cobalt, SAMPLE_HISTORY]]) });
  const without = execute(aeroplanHeavy);
  const facts = (r: RecommendationRunRecord) =>
    r.derivedState.candidates.find((row) => row.productId === cobalt)?.offer.historyPoints;
  assert.notEqual(facts(withHistory.record), facts(without.record));
  assert.notEqual(
    withHistory.record.inputSnapshot.offerHistoryFingerprint,
    without.record.inputSnapshot.offerHistoryFingerprint,
  );
  // Và bản ghi mang nó theo: chạy lại KHÔNG cần ai đưa lịch sử vào lần nữa.
  assert.ok(replayRun(withHistory.record, withHistory.dataset).identical);
});

test("§20 — chạy lại với NHẦM bộ dữ liệu là LỖI, không phải một kết quả khác", () => {
  const { record } = execute(vietnamTripFunded);
  const other: RecommendationDataset = { ...DATA, offers: DATA.offers.slice(1) };
  assert.throws(() => replayRun(record, other), /không phải bộ/);
});

test("§20 — bộ dữ liệu / lịch sử offer CHƯA cắt theo asOf/knownAt bản ghi khai là lỗi, không phải một lượt chạy", () => {
  // Không kiểm thì bản ghi nói "biết tới ngày X" trong khi engine đã đọc cả
  // dòng nhập sau X — và dấu vân tay khớp chính cái bộ sai đó.
  // Một phí mới hiệu lực SAU ngày chạy, và một đính chính nhập SAU knownAt.
  const fee = DATA.productFees[0];
  const future = { ...fee, id: `${fee.id}_future` as never, effectiveFrom: "2027-01-01" };
  const late = { ...fee, id: `${fee.id}_late` as never, recordedAt: "2026-09-08" };
  const uncut: RecommendationDataset = { ...DATA, productFees: [...DATA.productFees, future] };
  assert.notEqual(fingerprint(datasetAt(uncut, ASOF)), fingerprint(uncut), "tiền đề: cắt theo asOf bỏ dòng tương lai");
  assert.throws(() => executeRun({ state: beginnerNoCards, data: uncut, asOf: ASOF }, { id: "x", createdAt: ASOF }), /chưa được cắt/);

  const corrected: RecommendationDataset = { ...DATA, productFees: [...DATA.productFees.filter((row) => row.id !== fee.id), late] };
  const knownAt = "2026-09-07";
  assert.notEqual(fingerprint(datasetAt(corrected, ASOF, { knownAt })), fingerprint(corrected), "tiền đề: knownAt bỏ đính chính nhập sau");
  assert.throws(
    () => executeRun({ state: beginnerNoCards, data: corrected, asOf: ASOF, knownAt }, { id: "x", createdAt: ASOF }),
    /chưa được cắt/,
  );
  // Bộ đã cắt đúng thì chạy bình thường.
  assert.doesNotThrow(() => executeRun({ state: beginnerNoCards, data: DATA, asOf: ASOF }, { id: "x", createdAt: ASOF }));

  // Lịch sử offer cũng vậy: một mức ghi sau ngày chạy, hay một `until` mà
  // lượt chạy lúc ấy chưa thể biết, là tương lai lọt vào §12.
  const cobalt = productIdFor("amex-cobalt") as string;
  const withFuture = [...SAMPLE_HISTORY.slice(0, 2), { ...SAMPLE_HISTORY[2], until: "2026-10-01", endCensored: false }];
  assert.throws(
    () => execute(aeroplanHeavy, { offerHistory: new Map([[cobalt, withFuture]]) }),
    /lịch sử offer .* sau ngày cắt/,
  );
  // knownAt sớm hơn một mức đã ghi thì mức đó cũng là "chưa biết".
  assert.throws(
    () => execute(aeroplanHeavy, { knownAt: "2026-05-01", data: datasetAt(offlineDataset(), ASOF, { knownAt: "2026-05-01" }), offerHistory: new Map([[cobalt, SAMPLE_HISTORY]]) }),
    /lịch sử offer .* sau ngày cắt/,
  );
});

test("§20 — hồ sơ hay lịch sử offer trong bản ghi bị sửa là LỖI KHO, không phải hồi quy", () => {
  // Hai thứ này nằm ngay trong bản ghi nên hỏng cùng nó — một migration đổi
  // kiểu một trường, một người sửa tay. Chạy lại trên đầu vào đã đổi thì kết
  // quả khác, và không kiểm thì nó bị gọi là hồi quy của engine.
  const cobalt = productIdFor("amex-cobalt") as string;
  const { record, dataset } = execute(aeroplanHeavy, { offerHistory: new Map([[cobalt, SAMPLE_HISTORY]]) });
  assert.ok(replayRun(record, dataset).identical, "tiền đề: bản ghi nguyên vẹn chạy lại khớp");

  const state = structuredClone(record);
  state.inputSnapshot.state.balances[0].balance = 1;
  assert.throws(() => replayRun(state, dataset), /hồ sơ người dùng.*không còn khớp/);

  const history = structuredClone(record);
  history.inputSnapshot.offerHistory[0].points.pop();
  assert.throws(() => replayRun(history, dataset), /lịch sử offer.*không còn khớp/);

  // Kết quả đã lưu bị sửa: cùng version, cùng đầu vào — trước đây replay gọi
  // đó là HỒI QUY và dẫn admin vào engine (vòng Codex 17).
  const output = structuredClone(record);
  output.outputSnapshot.results[0].primaryAction.score += 0.001;
  assert.throws(() => replayRun(output, dataset), /kết quả đã lưu.*không còn khớp/);
});

test("§20 — bản ghi CŨ (trước khi có dấu vân tay kết quả) vẫn chạy lại được, và nói ra là chưa kiểm", () => {
  // Vòng Codex 18: trường mới bắt buộc làm mọi bản ghi cũ bị gọi là hỏng kho.
  const { record, dataset } = execute(vietnamTripShortfall);
  const old = { ...structuredClone(record), engineVersion: "4.18.0" };
  delete old.resultFingerprint;
  const replay = replayRun(old, dataset);
  assert.equal(replay.identical, true);
  assert.equal(replay.resultVerified, false);
  assert.equal(replayRun(record, dataset).resultVerified, true);
  // Bản ghi TỪ 4.19.0 mà thiếu nó thì đã bị cắt bớt trong kho (vòng Codex 19).
  const truncated = structuredClone(record);
  delete truncated.resultFingerprint;
  assert.throws(() => replayRun(truncated, dataset), /thiếu dấu vân tay kết quả/);
});

test("debugger đọc được bản ghi CŨ — thiếu các trường thêm sau — không nổ, không in 'undefined'", () => {
  // §20 hứa đọc được mọi lượt chạy đã lưu. Bản ghi trước 4.16–4.20 thiếu
  // `basis`, `flipShare`, `unknownCause`, `welcomeOfferUncertain` và hai danh
  // sách luật của cửa bonus; `why` từng nổ TypeError trên chúng (vòng Codex 19).
  const state = structuredClone(beginnerNoCards);
  state.declared = { ...state.declared, cards: false };
  const { record, dataset } = execute(state);
  // Hai đời bản ghi thật: 4.16–4.19 (có `unknownCause`, `basis`; chưa có hai
  // danh sách của cửa bonus — cặp cũ trộn hai cửa) và trước 4.16 (thiếu cả).
  const strip = (fields: string[]) => {
    const legacy = JSON.parse(JSON.stringify(record), (key, value) => (fields.includes(key) ? undefined : value)) as RecommendationRunRecord;
    for (const row of legacy.derivedState.candidates) {
      const fresh = record.derivedState.candidates.find((f) => f.productId === row.productId)!.eligibility;
      row.eligibility.unknownRuleIds = [...fresh.unknownRuleIds, ...fresh.welcomeUnknownRuleIds];
      row.eligibility.failedRuleIds = [...fresh.failedRuleIds, ...fresh.welcomeFailedRuleIds];
    }
    return legacy;
  };
  const before420 = { ...strip(["welcomeOfferUncertain", "welcomeFailedRuleIds", "welcomeUnknownRuleIds"]), engineVersion: "4.19.0" };
  const before416 = strip(["welcomeOfferUncertain", "welcomeFailedRuleIds", "welcomeUnknownRuleIds", "basis", "flipShare", "unknownCause", "resultFingerprint"]);
  for (const legacy of [before420, before416]) {
    const report = renderRunReport(legacy);
    assert.ok(!report.includes("undefined"), "báo cáo in 'undefined'");
    for (const row of legacy.derivedState.candidates) {
      const why = renderProductExplanation(explainProduct(legacy, row.productSlug, { dataset }));
      assert.ok(!why.includes("undefined"), `${row.productSlug}: 'vì sao' in 'undefined'`);
    }
  }
  // Phép so giữa bản CŨ và bản mới của CÙNG một kết quả không được báo tầng
  // nào "khác" chỉ vì lược đồ đổi (vòng Codex 20, 21) — ở ba đời bản ghi.
  // Người ĐÃ khai thẻ, từng giữ một thẻ Amex® và không có doanh nghiệp: bản
  // cũ trộn luật bonus vào `excluded[].failedRuleIds` của thẻ doanh nghiệp.
  const collector = structuredClone(beginnerNoCards);
  const bizGold = productIdFor("amex-business-gold");
  collector.profile.hasBusiness = false;
  collector.profile.businessCardsAllowed = null;
  collector.cards = [{ ...vietnamTripFunded.cards[0], userId: collector.profile.id, productId: bizGold, status: "closed" as never }];
  collector.declared = { ...collector.declared, cards: true };
  const same = execute(collector).record;
  const asLegacy = (version: string, fields: string[], goalFields: string[] = []) => {
    const legacy = JSON.parse(JSON.stringify(same), (key, value) => (fields.includes(key) ? undefined : value)) as RecommendationRunRecord;
    legacy.engineVersion = version;
    for (const row of legacy.derivedState.candidates) {
      const fresh = same.derivedState.candidates.find((f) => f.productId === row.productId)!.eligibility;
      row.eligibility.unknownRuleIds = [...fresh.unknownRuleIds, ...fresh.welcomeUnknownRuleIds];
      row.eligibility.failedRuleIds = [...fresh.failedRuleIds, ...fresh.welcomeFailedRuleIds];
    }
    for (const row of legacy.derivedState.excluded) {
      const fresh = same.derivedState.candidates.find((f) => f.productId === row.productId)?.eligibility;
      if (fresh !== undefined) row.failedRuleIds = [...fresh.failedRuleIds, ...fresh.welcomeFailedRuleIds];
    }
    for (const goal of legacy.derivedState.goals as unknown as Record<string, unknown>[]) {
      for (const key of goalFields) delete goal[key];
    }
    return legacy;
  };
  const excludedMixed = asLegacy("4.19.0", []).derivedState.excluded.find((row) => row.productId === bizGold)!;
  assert.equal(excludedMixed.failedRuleIds.length, 2, "tiền đề: bản cũ trộn luật mở thẻ và luật bonus");
  const newer = ["welcomeOfferUncertain", "welcomeFailedRuleIds", "welcomeUnknownRuleIds"];
  for (const legacy of [
    asLegacy("4.19.0", newer),
    asLegacy("4.15.0", [...newer, "basis", "flipShare", "unknownCause", "resultFingerprint"]),
    asLegacy(
      "4.1.0",
      [...newer, "basis", "flipShare", "unknownCause", "resultFingerprint", "followUpProbes", "oldestVerifiedRow", "floor", "perPassengerOneWayFloor"],
      ["userGaps", "dataGaps"],
    ),
  ]) {
    const changed = diffRecords(legacy, same).filter(
      (row) => row.changed && row.stage !== "source_data" && row.stage !== "user_input",
    );
    assert.deepEqual(changed.map((row) => `${legacy.engineVersion} ${row.stage}: ${row.entries[0]?.path}`), []);
  }
  // Và một khác biệt THẬT vẫn hiện ra qua phép căn hình dạng.
  const real = asLegacy("4.15.0", newer);
  real.outputSnapshot.results[0].primaryAction.score += 0.01;
  assert.ok(diffRecords(real, same).some((row) => row.changed && row.stage === "final_recommendation"));
  // Bản 4.16–4.19: cặp danh sách cũ chia lại theo `scope` — nguyên nhân của
  // cửa bonus không mất, và không lọt sang cửa mở thẻ.
  const amex = before420.derivedState.candidates.find((row) =>
    row.eligibility.rules.some((rule) => rule.scope === "welcome_offer" && rule.outcome === "unknown"),
  )!;
  assert.ok(amex !== undefined, "tiền đề: có thẻ mà cửa bonus chưa biết");
  assert.ok(eligibilityUnknownCauses(amex.eligibility, "welcome_offer").length > 0);
  assert.equal(eligibilityUnknownCauses(amex.eligibility, "application").some((c) => c.detail.startsWith("previous_cardholder")), false);
});

test("explainChange ghép lịch sử offer của ngày này vào ngày kia thì cắt theo ngày đó, không nổ", () => {
  // Hai lượt hợp lệ ngày 07/09 và 08/09; lịch sử có thêm một mốc ghi ngày
  // 08/09. Đổi riêng lịch sử (ngày 07/09) mà không cắt là cho lượt 07/09 thấy
  // tương lai — `executeRun` từ chối, và `explainChange` từng nổ (vòng Codex 18).
  const cobalt = productIdFor("amex-cobalt") as string;
  const early = [SAMPLE_HISTORY[0], SAMPLE_HISTORY[1], { ...SAMPLE_HISTORY[2], until: null, endCensored: true }];
  const later = [SAMPLE_HISTORY[0], SAMPLE_HISTORY[1], { ...SAMPLE_HISTORY[2], until: "2026-09-08", endCensored: false }, { ...SAMPLE_HISTORY[2], at: "2026-09-08", until: null, amount: 20_000, label: "20,000 điểm" }];
  const d7 = datasetAt(offlineDataset(), "2026-09-07");
  const a = executeRun({ state: aeroplanHeavy, data: d7, asOf: "2026-09-07", offerHistory: new Map([[cobalt, early]]) }, { id: "a", createdAt: "2026-09-07" });
  const b = executeRun({ state: aeroplanHeavy, data: DATA, asOf: ASOF, offerHistory: new Map([[cobalt, later]]) }, { id: "b", createdAt: ASOF });
  const change = explainChange(a.record, b.record, { before: a.dataset, after: b.dataset });
  const history = change.swaps!.find((row) => row.factor === "offer_history")!;
  assert.equal(history.differs, true);
});

test("§20 — khác mà version KHÔNG đổi là HỒI QUY; khác vì version đổi thì không", () => {
  const { record, dataset } = execute(vietnamTripShortfall);
  // Giả lập "engine LÚC ẤY ra kết quả khác": đổi kết quả VÀ dấu vân tay đi
  // kèm — một bản ghi nhất quán với chính nó. Chỉ đổi kết quả mà không đổi dấu
  // vân tay là bản ghi HỎNG, xem bài ngay dưới.
  const tampered = structuredClone(record);
  tampered.outputSnapshot.results[0].primaryAction.score += 0.01;
  tampered.resultFingerprint = fingerprint({ d: tampered.derivedState, o: tampered.outputSnapshot });
  const same = replayRun(tampered, dataset);
  assert.equal(same.identical, false);
  assert.equal(same.regression, true, "cùng version mà kết quả khác phải là hồi quy");

  const older = { ...structuredClone(tampered), engineVersion: "3.9.0" };
  const moved = replayRun(older, dataset);
  assert.equal(moved.identical, false);
  assert.equal(moved.regression, false, "version đổi thì khác biệt là CÓ CHỦ Ý");
  assert.equal(moved.engineVersion.current, ENGINE_VERSION);
});

test("§20 — bản ghi mang ĐỦ các cột của spec", () => {
  const { record } = execute(japanTripFunded);
  for (const key of [
    "id", "userId", "engineVersion", "ruleVersion", "dataSnapshotAt",
    "inputSnapshot", "derivedState", "outputSnapshot", "createdAt",
  ]) {
    assert.ok(key in record, `thiếu cột ${key}`);
  }
  assert.equal(record.engineVersion, ENGINE_VERSION);
  assert.equal(typeof record.ruleVersion, "string");
  assert.equal(record.dataSnapshotAt, ASOF);
  assert.equal(record.inputSnapshot.datasetFingerprint, fingerprint(DATA));
  assert.ok(!("derived" in record.outputSnapshot), "derived phải ở cột riêng");
});

/* ================================================================== *
 * Kho: chỉ thêm
 * ================================================================== */

test("kho — lượt chạy KHÔNG bị ghi đè, ở cả hai backend", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "reco-runs-"));
  try {
    for (const store of [inMemoryRunStore(), fileRunStore(dir)]) {
      const { record } = execute(vietnamTripFunded);
      await store.saveRun(record);
      await assert.rejects(store.saveRun({ ...record, createdAt: "khác" }), /không ghi đè/);
      const back = await store.getRun(record.id);
      assert.equal(back?.createdAt, record.createdAt, "bản đã lưu phải còn nguyên");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("kho — bộ dữ liệu khoá theo NỘI DUNG: khoá sai là lỗi", async () => {
  for (const store of [inMemoryRunStore()]) {
    const other = { ...DATA, offers: DATA.offers.slice(1) };
    await assert.rejects(store.saveDataset(fingerprint(DATA), other), /không phải dấu vân tay/);
  }
});

test("kho — bản trong bộ nhớ trả về BẢN SAO", async () => {
  const store = inMemoryRunStore();
  const { record } = execute(vietnamTripFunded);
  await store.saveRun(record);
  const first = await store.getRun(record.id);
  first!.outputSnapshot.results[0].primaryAction.score = -1;
  const second = await store.getRun(record.id);
  assert.notEqual(second!.outputSnapshot.results[0].primaryAction.score, -1);
});

test("kho file — id lạ không trèo ra ngoài thư mục, và không bị đổi tên", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "reco-runs-"));
  try {
    const store = fileRunStore(dir);
    for (const bad of ["../x", "a/b", "a:b", ""]) {
      await assert.rejects(store.getRun(bad), /không hợp lệ/, JSON.stringify(bad));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/* ================================================================== *
 * derived_state — đủ, và khớp với chính quyết định của engine
 * ================================================================== */

test("§22 — MỌI sản phẩm có đúng một số phận: vào bảng, hoặc bị loại kèm lý do", () => {
  for (const state of ALL_STATES) {
    const { record } = execute(state);
    const d = record.derivedState;
    const seen = new Map<string, string>();
    for (const id of d.universe) seen.set(id, "universe");
    for (const row of d.excluded.filter((x) => x.stage === "universe")) {
      assert.ok(!seen.has(row.productId), `${row.productId} vừa trong vừa ngoài tập ứng viên`);
      seen.set(row.productId, row.reason);
    }
    assert.equal(seen.size, DATA.products.length, "có sản phẩm biến mất không lời giải thích");

    // Mỗi sản phẩm trong tập ứng viên có đúng một dòng dữ kiện.
    assert.deepEqual(
      d.candidates.map((row) => row.productId),
      d.universe,
    );
    // Chọn được ⇔ không bị loại ở suitability/eligibility — CÙNG phán quyết
    // engine dùng để lọc.
    const blocked = new Set(d.excluded.filter((x) => x.stage !== "universe").map((x) => x.productId));
    for (const row of d.candidates) {
      assert.equal(row.selectable, !blocked.has(row.productId), row.productSlug);
      const engineBlocks = row.suitability.excluded || row.eligibility.status === "ineligible";
      assert.equal(!row.selectable, engineBlocks, row.productSlug);
    }
  }
});

test("§22 — bảng xếp hạng ĐẦY ĐỦ khớp đầu ra, và mỗi thẻ ẩn có lý do", () => {
  let hiddenByFamily = 0;
  for (const state of ALL_STATES) {
    const { record } = execute(state);
    const selectable = record.derivedState.candidates.filter((row) => row.selectable);
    record.derivedState.goals.forEach((goal, index) => {
      const result = record.outputSnapshot.results[index];
      const cards = goal.ranking.filter((row) => row.candidate.kind === "open_card");
      assert.equal(cards.length, selectable.length, "mọi ứng viên chọn được phải có một hạng");
      assert.equal(goal.ranking.filter((row) => row.candidate.kind === "no_new_card").length, 1);
      assert.deepEqual(goal.ranking.map((row) => row.rank), goal.ranking.map((_r, i) => i + 1));
      // Sắp giảm dần theo điểm — chính thứ tự `rankCandidates` trả.
      for (let i = 1; i < goal.ranking.length; i += 1) {
        assert.ok(goal.ranking[i - 1].candidate.score >= goal.ranking[i].candidate.score);
      }
      assert.equal(canonicalJson(goal.ranking[0].candidate), canonicalJson(result.primaryAction));
      assert.deepEqual(
        goal.ranking.filter((row) => row.visibility === "alternative").map((row) => candidateKey(row.candidate)),
        result.alternatives.map(candidateKey),
      );
      for (const row of goal.ranking.filter((r) => r.visibility === "hidden_same_family")) {
        hiddenByFamily += 1;
        const holder = goal.ranking.find((r) => r.candidate.productId === row.hiddenBy);
        assert.ok(holder !== undefined && holder.rank < row.rank, "thẻ giữ chỗ phải đứng trên");
        // Thẻ giữ chỗ là thẻ phép gom GIỮ LẠI — nó có thể vẫn nằm dưới vạch cắt
        // (khi đó cả hai cùng không hiện, và thẻ bị gom thì đằng nào cũng dưới
        // vạch). Thứ nó KHÔNG được là: chính nó cũng bị gom bởi một thẻ khác.
        assert.notEqual(holder.visibility, "hidden_same_family");
        assert.notEqual(holder.visibility, "no_action");
        const family = (id: string | null) => IX.productById.get(id as never)?.familyId ?? null;
        assert.equal(family(row.candidate.productId), family(holder.candidate.productId));
      }
    });
  }
  // Không có ca nào thì vòng lặp trên không kiểm gì — và nó sẽ xanh cả khi
  // phép gom họ thẻ bị gỡ khỏi trace.
  assert.ok(hiddenByFamily > 0, "cần ít nhất một thẻ bị gom theo họ để bài này có nghĩa");
});

test("§22 — `excluded` mang luật đã chặn, và luật đó thật sự TRƯỢT trong bảng luật", () => {
  let checked = 0;
  for (const state of ALL_STATES) {
    const { record } = execute(state);
    for (const row of record.derivedState.excluded.filter((x) => x.stage === "eligibility")) {
      assert.ok(row.failedRuleIds.length > 0, `${row.productSlug} bị loại mà không kể luật nào`);
      const facts = record.derivedState.candidates.find((c) => c.productId === row.productId)!;
      for (const id of row.failedRuleIds) {
        assert.equal(facts.eligibility.rules.find((rule) => rule.ruleId === id)?.outcome, "fail", id);
      }
      checked += 1;
    }
  }
  assert.ok(checked > 0, "bài này phải có ít nhất một thẻ bị loại vì điều kiện để kiểm");
});

/* ================================================================== *
 * §19 — bảng điểm cộng lại đúng
 * ================================================================== */

test("§19 — mọi bảng điểm, MỌI ứng viên (không chỉ người thắng), cộng lại ĐÚNG bằng điểm cuối", () => {
  for (const state of ALL_STATES) {
    const { record } = execute(state);
    for (const goal of record.derivedState.goals) {
      for (const row of goal.ranking) {
        const table = scoreBreakdown(row.candidate);
        const sum = table.lines.reduce((acc, line) => acc + line.effect, 0);
        assert.ok(Math.abs(sum - row.candidate.score) < 1e-9, `${candidateKey(row.candidate)}: ${sum} ≠ ${row.candidate.score}`);
      }
    }
  }
});

test("§19 — điểm bị KẸP thì bảng hiện dòng kẹp, không lặng lẽ lệch", () => {
  const { record } = execute(vietnamTripFunded);
  const candidate = structuredClone(record.derivedState.goals[0].ranking[1].candidate);
  candidate.adjustments.push({ rule: "test_huge_bonus", layer: "rules", delta: 5, reasonCode: null });
  candidate.score = 1;
  const table = scoreBreakdown(candidate);
  assert.ok(table.lines.some((line) => line.key === "final_clamp"));
  const sum = table.lines.reduce((acc, line) => acc + line.effect, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("§22 — so hai ứng viên: tổng từng dòng BẰNG khoảng cách, và dòng 'quyết định' đảo được thứ tự", () => {
  for (const state of USER_FIXTURES) {
    const { record } = execute(state);
    const ranking = record.derivedState.goals[0]?.ranking ?? [];
    for (let i = 1; i < Math.min(6, ranking.length); i += 1) {
      const cmp = compareCandidates(ranking[0].candidate, ranking[i].candidate);
      const sum = cmp.lines.reduce((acc, line) => acc + line.delta, 0);
      assert.ok(Math.abs(sum - cmp.gap) < 1e-9, `${cmp.a} vs ${cmp.b}`);
      const layers = cmp.byLayer.reduce((acc, row) => acc + row.delta, 0);
      assert.ok(Math.abs(layers - cmp.gap) < 1e-9);
      for (const line of cmp.decisive) {
        // Gỡ đúng dòng đó ra thì khoảng cách đổi dấu — định nghĩa của "quyết định".
        assert.ok(Math.sign(cmp.gap - line.delta) !== Math.sign(cmp.gap), `${line.key} không đảo được thứ tự`);
      }
    }
  }
});

/* ================================================================== *
 * §22 — thẻ X đi tới đâu
 * ================================================================== */

test("§22 — 'vì sao thẻ X không hiện ra' trả lời được ở MỌI cửa chặn", () => {
  const { record, dataset } = execute(aeroplanHeavy);
  // Đang giữ → loại ở tập ứng viên, do ĐẦU VÀO người dùng (§16 Rule 5).
  const held = explainProduct(record, "td-aeroplan-visa-infinite", { dataset });
  assert.equal(held.outcome, "excluded_universe");
  assert.equal(held.excluded?.reason, "already_held");
  assert.deepEqual(held.drivenBy, ["user_input"]);
  assert.equal(held.decidedAt, "normalization");

  // Không tồn tại → dữ liệu nguồn.
  const ghost = explainProduct(record, "the-khong-ton-tai", { dataset });
  assert.equal(ghost.outcome, "not_in_dataset");
  assert.equal(ghost.decidedAt, "source_data");

  // Thẻ sinh viên với người không phải sinh viên → điều kiện, cả luật lẫn câu trả lời.
  const student = explainProduct(record, "scotiabank-scene-plus-visa-students", { dataset });
  if (student.outcome === "excluded_eligibility") {
    assert.deepEqual(student.drivenBy, ["source_data", "user_input"]);
    assert.ok(student.facts!.eligibility.rules.some((rule) => rule.outcome === "fail"));
  } else {
    // Hồ sơ này chưa khai là sinh viên hay không ⇒ `unknown`, vẫn trong bảng.
    assert.ok(student.ranked !== null);
  }

  // Người thắng → so với hạng nhì, và với NO_NEW_CARD.
  const winnerKey = candidateKey(record.outputSnapshot.results[0].primaryAction);
  const winner = explainProduct(record, winnerKey, { dataset });
  assert.equal(winner.outcome, "primary");
  assert.ok(winner.versus !== null && winner.versus.gap >= 0);
  assert.ok(winner.versusNoAction !== null && winner.versusNoAction.gap >= 0);
});

test("§22 — mọi thẻ bị loại khỏi MỌI nhân vật đều giải thích được, đúng tầng", () => {
  for (const state of USER_FIXTURES) {
    const { record, dataset } = execute(state);
    for (const row of record.derivedState.excluded) {
      const e = explainProduct(record, row.productSlug, { dataset });
      assert.equal(
        e.outcome,
        row.stage === "universe" ? "excluded_universe" : row.stage === "suitability" ? "excluded_suitability" : "excluded_eligibility",
      );
    }
    for (const row of record.derivedState.goals[0]?.ranking ?? []) {
      const e = explainProduct(record, candidateKey(row.candidate), { dataset });
      assert.equal(e.ranked?.rank, row.rank);
    }
  }
});

test("§22 — bản ghi nguồn chỉ đúng những dòng engine đã đọc", () => {
  const { record, dataset } = execute(vietnamTripShortfall);
  const ids = new Set(
    [
      ...dataset.offers, ...dataset.offerComponents, ...dataset.productFees,
      ...dataset.earningRates, ...dataset.productBenefits, ...dataset.eligibilityRules,
      ...dataset.earningCaps, ...dataset.programValuations,
      ...dataset.transferPaths, ...dataset.awardStrategies,
    ].map((row) => row.id as string),
  );
  for (const facts of record.derivedState.candidates) {
    const rows = provenanceFor(facts, dataset, ASOF);
    for (const row of rows) assert.ok(ids.has(row.id), `${row.table} ${row.id} không có trong bộ dữ liệu`);
    const offer = rows.filter((row) => row.table === "offers").map((row) => row.id);
    assert.deepEqual(offer, facts.offer.activeOfferId === null ? [] : [facts.offer.activeOfferId]);
    // Định giá của chính các chương trình thẻ này kiếm — thứ nhân vào mọi
    // con số tiền của nó.
    for (const program of facts.earn.programs) {
      assert.ok(
        rows.some((row) => row.table === "program_valuations" && dataset.programValuations.find((v) => v.id === row.id)?.programId === program),
        `${facts.productSlug}: thiếu định giá ${program}`,
      );
    }
    // Luật điều kiện trong bảng nguồn = luật engine đã đánh giá.
    assert.deepEqual(
      rows.filter((row) => row.table === "eligibility_rules").map((row) => row.id),
      facts.eligibility.rules.map((rule) => rule.ruleId),
    );
  }
});

/* ================================================================== *
 * Hai lượt chạy khác nhau ở đâu
 * ================================================================== */

test("so lượt chạy — hai lượt giống hệt nhau thì KHÔNG tầng nào khác", () => {
  const a = execute(vietnamTripShortfall).record;
  const b = execute(vietnamTripShortfall).record;
  assert.ok(diffRecords(a, b).every((row) => !row.changed));
  assert.equal(firstComputedDivergence(diffRecords(a, b)), null);
});

test("so lượt chạy — đổi SỐ DƯ thì tầng tính khác đầu tiên là DANH MỤC", () => {
  const a = execute(vietnamTripShortfall).record;
  const richer = structuredClone(vietnamTripShortfall);
  richer.balances = richer.balances.map((row) => ({ ...row, balance: (row.balance ?? 0) + 50_000 }));
  const b = execute(richer).record;
  const diffs = diffRecords(a, b);
  assert.equal(diffs.find((row) => row.stage === "user_input")?.changed, true);
  assert.equal(diffs.find((row) => row.stage === "source_data")?.changed, false);
  assert.equal(firstComputedDivergence(diffs)?.stage, "portfolio_analysis");
});

test("so lượt chạy — đổi NGƯỠNG PHÍ thì tầng tính khác đầu tiên là PHÙ HỢP, không phải chấm điểm", () => {
  const a = execute(aeroplanHeavy).record;
  const strict = structuredClone(aeroplanHeavy);
  strict.profile.annualFeeTolerancePerCard = 0;
  const b = execute(strict).record;
  assert.equal(firstComputedDivergence(diffRecords(a, b))?.stage, "suitability");
});

test("§20 — 'vì sao đổi': đổi TỪNG yếu tố một chỉ ra đúng yếu tố đã đổi kết quả", () => {
  // Lượt cũ và lượt mới khác nhau ở ĐÚNG MỘT chỗ — dữ liệu offer. Phép đổi
  // từng yếu tố phải quy kết quả mới về dữ liệu, không về người dùng.
  const before = execute(vietnamTripShortfall);
  const winner = before.record.outputSnapshot.results[0].primaryAction.productId!;
  const offerId = before.record.derivedState.candidates.find((row) => row.productId === winner)!.offer.activeOfferId!;
  const weaker: RecommendationDataset = {
    ...before.dataset,
    offerComponents: before.dataset.offerComponents.map((row) =>
      row.offerId === offerId ? { ...row, pointsAmount: row.pointsAmount === null ? null : 1 } : row,
    ),
  };
  const after = execute(vietnamTripShortfall, { data: weaker });
  const change = explainChange(before.record, after.record, { before: before.dataset, after: after.dataset });

  assert.equal(change.userInput.length, 0, "người dùng không đổi gì");
  assert.ok(change.datasetChanges !== null);
  assert.deepEqual(change.datasetChanges.map((row) => row.table), ["offerComponents"]);
  const swaps = new Map(change.swaps!.map((row) => [row.factor, row]));
  assert.equal(swaps.get("user_input")?.differs, false);
  assert.equal(swaps.get("offer_history")?.differs, false);
  assert.equal(swaps.get("source_data")?.differs, true);
  assert.equal(swaps.get("source_data")?.firstDivergence, "candidate_facts");
  assert.equal(swaps.get("source_data")?.winnerAlone, change.winner.after);
  assert.equal(change.engineEffect, null, "cùng engine ⇒ không có phần 'engine đổi'");
});

test("so bộ dữ liệu — nói đúng DÒNG nào, TRƯỜNG nào đổi", () => {
  const target = DATA.offers[0];
  const edited = { ...DATA, offers: DATA.offers.map((row) => (row.id === target.id ? { ...row, headlineBonus: 1 } : row)) };
  const changes = diffDatasets(DATA, edited);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].table, "offers");
  assert.deepEqual(changes[0].changed, [{ id: target.id, fields: ["headlineBonus"] }]);
});

test("deepDiff — so CHÍNH XÁC, không dung sai", () => {
  assert.equal(deepDiff({ a: 0.1 + 0.2 }, { a: 0.3 }).length, 1);
  assert.equal(deepDiff({ a: [1, 2] }, { a: [1, 2] }).length, 0);
  assert.deepEqual(deepDiff({ a: 1 }, { b: 1 }).map((row) => row.path), ["a", "b"]);
});

test("mọi tầng của dây chuyền đều có trong phép so", () => {
  // Thêm một tầng mà quên phép so là để thay đổi ở tầng đó đi qua `diffRecords`
  // mà không ai thấy. Danh sách phải đúng thứ tự nhân quả của `engine.ts`.
  assert.deepEqual([...PIPELINE_STAGES], [
    "source_data", "user_input", "normalization", "portfolio_analysis",
    "candidate_facts", "eligibility", "suitability", "offer_climate",
    "strategy_generation", "needs_calculation", "scoring", "rules", "editorial", "ranking",
    "final_recommendation", "confidence",
  ]);
});

/* ================================================================== *
 * Trình bày không bao giờ ném
 * ================================================================== */

test("debugger in được MỌI nhân vật và mọi hồ sơ hỏng, đủ 11 mục của §22", () => {
  for (const state of ALL_STATES) {
    const { record, dataset } = execute(state);
    const text = renderRunReport(record);
    for (let i = 1; i <= 11; i += 1) assert.ok(text.includes(`\n${i}. `), `thiếu mục ${i}`);
    for (const row of record.derivedState.candidates.slice(0, 3)) {
      renderProductExplanation(explainProduct(record, row.productSlug, { dataset }));
    }
  }
  const a = execute(vietnamTripFunded);
  const b = execute(vietnamTripShortfall);
  assert.ok(renderChangeExplanation(explainChange(a.record, b.record, { before: a.dataset, after: b.dataset })).length > 0);
});

test("`inputOf` dựng lại đúng đầu vào của một bản ghi", () => {
  const { record, dataset } = execute(japanTripFunded, {
    offerHistory: new Map([[productIdFor("amex-cobalt") as string, SAMPLE_HISTORY]]),
  });
  const again = executeRun(inputOf(record, dataset), { id: record.id, createdAt: record.createdAt });
  assert.equal(canonicalJson(again.record), canonicalJson(record));
});

/* ================================================================== *
 * Vòng Codex 1
 * ================================================================== */

test("lịch sử offer CẮT ở ngày chạy: lượt chạy quá khứ không đọc được tương lai", async () => {
  const { dedupeHistory } = await import("./offer-history.ts");
  const timeline = [
    { at: "2026-01-01", bonus: { label: "10,000", amount: 10_000, unit: "points" as const } },
    { at: "2026-03-01", bonus: { label: "12,000", amount: 12_000, unit: "points" as const } },
    { at: "2026-06-01", bonus: { label: "15,000", amount: 15_000, unit: "points" as const } },
  ];
  const full = dedupeHistory(timeline);
  const cut = dedupeHistory(timeline, "2026-04-15");
  assert.equal(full.length, 3);
  assert.deepEqual(cut.map((p) => p.amount), [10_000, 12_000]);
  // Mức cuối trước ngày cắt CHƯA thấy kết thúc — không mang `until` của lần
  // ghi 01/06 chưa xảy ra vào ngày đó.
  assert.equal(cut[1].until, null);
  assert.equal(cut[1].endCensored, true);
  const { historyCutoff } = await import("./offer-history.ts");
  assert.equal(historyCutoff("2026-09-08", "2026-08-01"), "2026-08-01");
  assert.equal(historyCutoff("2026-09-08", null), "2026-09-08");
  assert.equal(historyCutoff("2026-08-01", "2026-09-08"), "2026-08-01");
});

test("vì sao thẻ X — lượt chạy KHÔNG có mục tiêu thì thẻ chọn được là 'chưa xếp hạng', không phải 'không tồn tại'", () => {
  const noGoal = { ...vietnamTripShortfall, goals: [] };
  const { record, dataset } = execute(noGoal);
  assert.equal(record.derivedState.goals.length, 0);
  const pick = record.derivedState.candidates.find((row) => row.selectable)!;
  const e = explainProduct(record, pick.productSlug, { dataset });
  assert.equal(e.outcome, "not_ranked_no_goal");
  assert.deepEqual(e.drivenBy, ["user_input"]);
  assert.equal(explainProduct(record, "the-khong-ton-tai", { dataset }).outcome, "not_in_dataset");
});

test("vì sao thẻ X — NO_NEW_CARD không thắng thì ở chỗ RIÊNG, không phải gợi ý thay thế", () => {
  const { record, dataset } = execute(vietnamTripShortfall);
  assert.notEqual(record.outputSnapshot.results[0].primaryAction.kind, "no_new_card");
  const e = explainProduct(record, "NO_NEW_CARD", { dataset });
  assert.equal(e.outcome, "no_action_slot");
  const funded = execute(vietnamTripFunded);
  assert.equal(explainProduct(funded.record, "NO_NEW_CARD", { dataset: funded.dataset }).outcome, "primary");
});

test("so lượt chạy — thẻ vẫn bị loại nhưng đổi LÝ DO thì tầng khác đầu tiên là CHUẨN HOÁ", () => {
  const a = execute(aeroplanHeavy).record;
  const b = structuredClone(a);
  const row = b.derivedState.excluded.find((x) => x.stage === "universe")!;
  row.reason = row.reason === "already_held" ? "not_available" : "already_held";
  assert.equal(firstComputedDivergence(diffRecords(a, b))?.stage, "normalization");
});

test("so lượt chạy — đổi LỜI GIẢI THÍCH mà không đổi con số vẫn là khác", () => {
  const a = execute(aeroplanHeavy).record;
  const b = structuredClone(a);
  const loser = b.derivedState.goals[0].ranking.at(-2)!.candidate;
  loser.components[0].note = "lời giải thích đã sửa";
  assert.equal(diffRecords(a, b).find((row) => row.stage === "scoring")?.changed, true);
  const c = structuredClone(a);
  const adjusted = c.derivedState.goals[0].ranking.find((row) => row.candidate.adjustments.length > 0)!.candidate;
  adjusted.adjustments[0].reasonCode = null;
  assert.equal(diffRecords(a, c).find((row) => row.stage === "rules")?.changed, true);
});

test("so lượt chạy — phép đo §30 đổi mà câu hỏi đứng yên vẫn là khác", () => {
  const a = execute(beginnerNoCards).record;
  assert.ok(a.derivedState.followUpProbes.length > 0);
  const b = structuredClone(a);
  const outcome = b.derivedState.followUpProbes[0].outcomes.find((o) => !o.invalid)!;
  outcome.flipsWinner = !outcome.flipsWinner;
  assert.equal(diffRecords(a, b).find((row) => row.stage === "confidence")?.changed, true);
});

test("vòng Codex 3 — bản ghi nguồn có cả chặng chuyển điểm và bảng giá chặng đang hỏi", () => {
  const { record, dataset } = execute(japanTripFunded);
  // Thẻ KHÔNG kiếm MR — chặng MR → Aeroplan® vẫn phải hiện, vì nó đến từ VÍ
  // người dùng và quyết định khoảng cách mà thẻ này được chấm là "lấp".
  const e = explainProduct(record, "amex-aeroplan", { dataset });
  const tables = new Set(e.provenance!.map((row) => row.table));
  const mrToAeroplan = dataset.transferPaths.find(
    (path) => path.sourceProgramId === ("amex-mr" as never) && path.destinationProgramId === ("aeroplan" as never),
  )!;
  assert.ok(e.provenance!.some((row) => row.id === mrToAeroplan.id), "thiếu chặng MR → Aeroplan® của ví");
  assert.ok(tables.has("transfer_paths"));
  assert.ok(tables.has("award_strategies"), "thiếu bảng giá chặng Nhật");
  const strategies = record.derivedState.goals[0].goal.tripNeed!.strategies.map((row) => row.id as string);
  assert.deepEqual(
    e.provenance!.filter((row) => row.table === "award_strategies").map((row) => row.id),
    strategies,
  );
});

test("vòng Codex 3 — phép gán 'nếu như' có setter ném thì TRẢ lỗi, không ném", async () => {
  const { applyAssignment } = await import("./debug-input.ts");
  const state = structuredClone(japanTripFunded);
  assert.match(applyAssignment(state, "goals.length=-1") ?? "", /không gán được/);
  assert.match(applyAssignment(state, "__proto__.x=1") ?? "", /không hợp lệ/);
  assert.equal(applyAssignment(state, "profile.annualFeeTolerancePerCard=0"), null);
  assert.equal(state.profile.annualFeeTolerancePerCard, 0);
});

test("vòng Codex 5 — bản ghi nguồn KHÔNG có chặng đòi hạng thành viên (engine không đọc chúng)", () => {
  for (const state of USER_FIXTURES) {
    const { record, dataset } = execute(state);
    for (const facts of record.derivedState.candidates.slice(0, 8)) {
      const e = explainProduct(record, facts.productSlug, { dataset });
      for (const row of e.provenance!.filter((r) => r.table === "transfer_paths")) {
        const path = dataset.transferPaths.find((p) => p.id === row.id)!;
        assert.equal(path.requiresTier, null, `${facts.productSlug}: ${row.id}`);
      }
    }
  }
});

test("so lượt chạy — đổi BẤT KỲ lá nào của bản ghi thì một tầng tính phải báo (vét cạn)", () => {
  // Mỗi tầng là một phép chiếu viết tay của bản ghi, và vòng Codex 16 bắt
  // được một trường không tầng nào chiếu (mã của gợi ý thay thế). Vét cạn
  // tìm thêm năm chỗ nữa: cả `tripCoverage`, đầu vào độ tin cậy, mã của mọi
  // ứng viên trong bảng, `rank`/`hiddenBy`, `selectable`. Bài này đổi từng
  // LOẠI lá (một lần mỗi đường dẫn đã gộp chỉ số mảng) và đòi một tầng TÍNH
  // báo — lưới an toàn `unmapped` không được tính là đã ánh xạ.
  //
  // Miễn trừ, và lý do:
  //   productId/productName/kind/goalId — bản sao DANH TÍNH; phép so khoá theo
  //     slug, và đổi tên một thẻ là đổi dữ liệu nguồn;
  //   asOf/engineVersion/ruleVersion ở đầu ra — siêu dữ liệu, phần đầu báo
  //     cáo và `explainChange` nói về chúng;
  //   trường null của NO_NEW_CARD (eligibility, suitability, productSlug) —
  //     nó không có những thứ đó; đổi null thành chuỗi không phải một ca có thật;
  //   `eligibility`/`suitability` của ứng viên trong bảng xếp hạng và
  //     `results[].strategy` — BẢN SAO của dữ kiện ứng viên và của
  //     `strategies[0]`, đã chiếu ở tầng của bản gốc; bài ngay dưới đòi bản sao
  //     luôn bằng bản gốc.
  // ĐƯỜNG DẪN CHÍNH XÁC, không phải tên trường trần: vòng Codex 17 bắt bản
  // trước miễn trừ mọi `.kind`/`.goalId` — tức cả `userGaps[].kind`,
  // `dataGaps[].kind`, `results[].goalId`, những trường thật.
  const EXEMPT = new RegExp(
    [
      String.raw`^derivedState\.goals\.#\.ranking\.#\.candidate\.(productId|productName|kind)$`,
      String.raw`^derivedState\.(candidates|excluded)\.#\.(productId|productName)$`,
      String.raw`^derivedState\.goals\.#\.goalId$`,
      String.raw`^outputSnapshot\.(asOf|engineVersion|ruleVersion)$`,
      String.raw`^derivedState\.goals\.#\.ranking\.#\.candidate\.(eligibility|suitability)\.`,
      String.raw`^outputSnapshot\.results\.#\.strategy\.`,
    ].join("|"),
  );
  const state: UserState = {
    ...vietnamTripShortfall,
    goals: [
      ...vietnamTripShortfall.goals.map((goal) => ({ ...goal, priority: null })),
      { type: "next_card", id: "goal_sweep_next" as never, userId: vietnamTripShortfall.profile.id, priority: null, createdAt: ASOF },
    ],
  };
  // Qua JSON trước: trong bộ nhớ, gợi ý thay thế ở đầu ra và dòng của nó trong
  // bảng xếp hạng là CÙNG một object, nên đổi một chỗ là đổi cả hai và phép vét
  // bị lừa. Bản lưu trong kho thì không chung gì — vét đúng trên dạng đó.
  const record = JSON.parse(JSON.stringify(execute(state).record)) as RecommendationRunRecord;
  const seen = new Set<string>();
  const missed: string[] = [];
  const walk = (value: unknown, path: (string | number)[], parent: Record<string, unknown> | null) => {
    if (value !== null && typeof value === "object") {
      if (Array.isArray(value)) value.forEach((item, i) => walk(item, [...path, i], null));
      else for (const [key, item] of Object.entries(value)) walk(item, [...path, key], value as Record<string, unknown>);
      return;
    }
    const shape = path.map((part) => (typeof part === "number" ? "#" : part)).join(".");
    if (seen.has(shape) || EXEMPT.test(shape)) return;
    if (value === null && parent?.kind === "no_new_card") return;
    seen.add(shape);
    const clone = structuredClone({ derivedState: record.derivedState, outputSnapshot: record.outputSnapshot }) as Record<string, unknown>;
    let at: Record<string | number, unknown> = clone;
    for (const part of path.slice(0, -1)) at = at[part] as Record<string | number, unknown>;
    const last = path[path.length - 1];
    at[last] = value === null ? "X" : typeof value === "number" ? value + 1 : typeof value === "boolean" ? !value : `${String(value)}X`;
    const changed = { ...record, ...(clone as Pick<RecommendationRunRecord, "derivedState" | "outputSnapshot">) };
    const hit = diffRecords(record, changed).some(
      (row) => row.changed && row.stage !== "unmapped" && row.stage !== "source_data" && row.stage !== "user_input",
    );
    if (!hit) missed.push(shape);
  };
  walk({ derivedState: record.derivedState, outputSnapshot: record.outputSnapshot }, [], null);
  assert.ok(seen.size > 200, `tiền đề: vét được ${seen.size} loại lá`);
  assert.deepEqual(missed, [], "các trường này đổi mà không tầng nào báo — thêm chúng vào `stageValue`");
});

test("bản sao trong bản ghi luôn bằng bản gốc (điều kiện miễn trừ của phép vét)", () => {
  for (const state of [vietnamTripShortfall, aeroplanHeavy, flexiblePointsSufficient]) {
    const { record } = execute(state);
    const facts = new Map(record.derivedState.candidates.map((row) => [row.productId as string, row]));
    for (const goal of record.derivedState.goals) {
      for (const row of goal.ranking) {
        if (row.candidate.kind !== "open_card") continue;
        const source = facts.get(row.candidate.productId as string)!;
        assert.deepEqual(row.candidate.eligibility, source.eligibility);
        assert.deepEqual(row.candidate.suitability, source.suitability);
      }
    }
    for (const result of record.outputSnapshot.results) assert.deepEqual(result.strategy, result.strategies[0]);
    for (const goal of record.derivedState.goals) assert.equal(goal.goalId, goal.goal.goal.id);
  }
});

test("so lượt chạy — lưới an toàn: bản ghi khác ở chỗ chưa ánh xạ thì báo `unmapped`, không im lặng", () => {
  const { record } = execute(aeroplanHeavy);
  const changed = structuredClone(record);
  // Một bản sao danh tính (miễn trừ trong bài vét) — không tầng nào chiếu nó.
  changed.derivedState.goals[0].goalId = "goal_khac" as never;
  const diffs = diffRecords(record, changed);
  assert.equal(firstComputedDivergence(diffs)?.stage, "unmapped");
});

/* ================================================================== *
 * Diễn tập "khuyến nghị này sai" — chẩn đoán từ MỘT lượt chạy
 * ================================================================== */

test("thẻ đã xếp hạng: 'do' nói NGUỒN của khoảng cách, không mặc định là engine", () => {
  // Người mới gõ thu nhập $6,000 thay vì $60,000: TD® Aeroplan® VI thua vì
  // cửa điều kiện chưa chắc — một vế chưa khai, vế kia trượt với con số đã gõ.
  const state = structuredClone(beginnerNoCards);
  state.profile.annualPersonalIncome = amountRange(6_000, 8_000);
  const { record } = execute(state);
  const e = explainProduct(record, "td-aeroplan-visa-infinite");
  assert.notEqual(e.outcome, "primary", "tiền đề: TD® không thắng");
  assert.deepEqual(e.drivenBy, ["user_input"]);
  const line = e.explainingLines.find((row) => row.layer === "eligibility")!;
  assert.ok(line.sources.some((row) => row.detail.includes("minimum_personal_income") && row.detail.includes("TRƯỢT")));
  assert.ok(line.sources.some((row) => row.detail.includes("minimum_household_income")));
  // Và thẻ bị ẩn nói bị ẩn bởi ai.
  if (e.ranked?.hiddenBy != null) assert.match(renderProductExplanation(e), /bị ẩn bởi:/);
});

test("lỗi dữ liệu nguồn hiện ngay trên lượt chạy bị khiếu nại (validator trên bộ dữ liệu của nó)", () => {
  // Bonus Amex® Green gõ thừa một số 0 ở thành phần offer.
  const green = productIdFor("amex-green") as string;
  const data = {
    ...DATA,
    offerComponents: DATA.offerComponents.map((c) => (c.offerId.startsWith(`offer_${green}`) ? { ...c, pointsAmount: (c.pointsAmount ?? 0) * 10 } : c)),
  };
  const { record, dataset } = execute(beginnerNoCards, { data });
  const report = renderRunReport(record, { dataset });
  assert.match(report, /kiểm dữ liệu: ✗ 1 LỖI/);
  const e = explainProduct(record, "amex-green", { dataset });
  assert.ok(e.dataIssues!.some((issue) => issue.level === "error" && issue.message.includes("vượt headlineBonus")));
  assert.equal(e.drivenBy.includes("source_data"), true);
  // Bộ dữ liệu sạch thì báo cáo nói sạch.
  assert.match(renderRunReport(execute(beginnerNoCards).record, { dataset: DATA }), /kiểm dữ liệu: ✓ không lỗi/);
});

test("validator cảnh báo ngưỡng thu nhập bất thường (gõ thừa số 0), không cảnh báo dữ liệu thật", () => {
  const rule = DATA.eligibilityRules.find((r) => r.ruleType === "minimum_personal_income" && Number(r.value) === 60_000)!;
  const typo = { ...DATA, eligibilityRules: DATA.eligibilityRules.map((r) => (r.id === rule.id ? { ...r, value: 600_000 } : r)) };
  assert.ok(validateDataset(typo, ASOF).some((issue) => issue.message.includes(rule.id as string) && issue.message.includes("vượt mốc hợp lý")));
  assert.ok(!validateDataset(DATA, ASOF).some((issue) => issue.message.includes("vượt mốc hợp lý")));
});

test("phân tích danh mục in các dòng cấu thành, và tự cộng lại — engine cộng sai thì báo cáo nói ra", () => {
  const { record } = execute(aeroplanHeavy);
  const valued = record.derivedState.portfolio.valued;
  assert.ok(valued.some((row) => row.programId === "amex-mr" && row.reach > 0), "tiền đề: MR chuyển được");
  assert.ok(!renderRunReport(record).includes("KHÁC con số engine"));
  // Giả lập engine cộng sai: độ linh hoạt ghi 0 trong khi các dòng nói khác.
  const broken = structuredClone(record);
  broken.derivedState.portfolio.flexibilityScore = 0;
  assert.match(renderRunReport(broken), /KHÁC con số engine in ở trên ⇒ lỗi ở PHÂN TÍCH DANH MỤC/);
});

test("bảng điểm đánh dấu trọng số lệch bảng §10 của spec", () => {
  const { record } = execute(beginnerNoCards);
  const top = record.derivedState.goals[0].ranking.find((row) => row.candidate.kind === "open_card")!.candidate;
  assert.ok(!renderScoreTable(top, "next_card").includes("TRỌNG SỐ LỆCH"));
  const skewed = structuredClone(top);
  skewed.components.find((c) => c.key === "offer_quality")!.weight = 0.45;
  assert.match(renderScoreTable(skewed, "next_card"), /offer_quality.*TRỌNG SỐ LỆCH §10\.1 \(0\.25\)/);
});

test("so lượt chạy: điều kiện và phù hợp là HAI tầng; luật §16 và biên tập §17 là HAI tầng", () => {
  const { record } = execute(aeroplanHeavy);
  const editorial = structuredClone(record);
  editorial.derivedState.goals[0].ranking[0].candidate.adjustments.push({ rule: "ED_test", layer: "editorial", delta: 0.08, reasonCode: null });
  assert.equal(firstComputedDivergence(diffRecords(record, editorial))?.stage, "editorial");
  const rule = structuredClone(record);
  const adjusted = rule.derivedState.goals[0].ranking.find((row) => row.candidate.adjustments.some((a) => a.layer === "rules"))!;
  adjusted.candidate.adjustments.find((a) => a.layer === "rules")!.delta -= 0.01;
  assert.equal(firstComputedDivergence(diffRecords(record, rule))?.stage, "rules");
  const eligibility = structuredClone(record);
  eligibility.derivedState.candidates[0].eligibility.status = "ineligible";
  assert.equal(firstComputedDivergence(diffRecords(record, eligibility))?.stage, "eligibility");
  const suitability = structuredClone(record);
  suitability.derivedState.candidates[0].suitability.penalty = 0.5;
  assert.equal(firstComputedDivergence(diffRecords(record, suitability))?.stage, "suitability");
});

test("so lượt chạy — CHỈ version khác thì lưới an toàn không báo động giả", () => {
  // Chạy lại một lượt cũ dưới version mới mà không tầng tính nào khác: phép so
  // từng báo "khác ở trường chưa ánh xạ: output.engineVersion".
  const { record } = execute(aeroplanHeavy);
  const newer = structuredClone(record);
  newer.engineVersion = "9.9.9";
  newer.outputSnapshot.engineVersion = "9.9.9";
  assert.equal(firstComputedDivergence(diffRecords(record, newer)), null);
});
