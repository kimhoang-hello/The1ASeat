/**
 * Hợp đồng của các KHO — một bộ bài, chạy trên MỌI backend.
 *
 * Bài học Phase 1–4: một interface chưa từng chạy với backend thứ hai là rủi
 * ro lớn nhất còn lại. Nên bản MySQL không có bộ test riêng: nó phải qua ĐÚNG
 * những bài bản bộ nhớ và bản file qua. Một bài chỉ đúng với một backend là
 * một hợp đồng chưa viết ra.
 *
 * MySQL cần server thật (không có MariaDB chạy trong tiến trình): đặt
 * `RECO_TEST_MYSQL_URL` tới một server mà user được phép TẠO database — mỗi
 * kho trong bài được một database riêng, xoá khi xong. Không đặt thì các bài
 * MySQL bị bỏ qua và nói ra; trong CI (`CI` có mặt) thiếu biến là LỖI, để
 * backend production không bao giờ lặng lẽ không được kiểm.
 *
 * KHÔNG import `./index.ts` — xem đầu `engine.test.ts`.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createConnection } from "mysql2/promise";

import { offlineDataset } from "./data/index.ts";
import { productIdFor } from "./data/products.ts";
import { USER_FIXTURES, aeroplanHeavy, vietnamTripFunded } from "./data/user-fixtures.ts";
import { canonicalJson, fingerprint } from "./fingerprint.ts";
import type { PoolOptions } from "mysql2/promise";
import { mysqlConfigFromEnv, openRecoDatabase, type RecoDatabase } from "./mysql.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import { inMemoryRunStore, persistRun, summarize, type RunStore } from "./run-store.ts";
import { fileRunStore } from "./run-store-fs.ts";
import { mysqlRunStore } from "./run-store-mysql.ts";
import { executeRun, replayRun } from "./runs.ts";
import { datasetAt } from "./temporal.ts";
import { inMemoryUserStore, UserStateConflictError, type UserStateStore } from "./user-source.ts";
import { mysqlUserStore } from "./user-store-mysql.ts";
import type { UserState } from "./user-types.ts";

const ASOF = "2026-09-08";
const DATA = datasetAt(offlineDataset(), ASOF);

let counter = 0;
function execute(state: UserState, meta: { id?: string; createdAt?: string; userId?: string | null } = {}) {
  counter += 1;
  return executeRun(
    { state, data: DATA, asOf: ASOF, offerHistory: new Map([[productIdFor("amex-cobalt") as string, SAMPLE_HISTORY]]) },
    { id: meta.id ?? `run_store_${counter}`, createdAt: meta.createdAt ?? "2026-09-12T00:00:00.000Z", userId: meta.userId },
  );
}

const SAMPLE_HISTORY: OfferHistoryPoint[] = [
  { at: "2026-01-01", until: "2026-06-01", startCensored: true, endCensored: false, label: "12,000 điểm", amount: 12_000, unit: "points" },
  { at: "2026-06-01", until: null, startCensored: false, endCensored: true, label: "15,000 điểm", amount: 15_000, unit: "points" },
];

/** Hồ sơ HỎNG mà engine vẫn phải chịu — lượt chạy của chúng cũng phải lưu được. */
const BROKEN: UserState[] = [
  { ...vietnamTripFunded, profile: undefined },
  { ...vietnamTripFunded, profile: { ...vietnamTripFunded.profile, country: undefined } },
] as never as UserState[];

/* ------------------------------------------------------------------ *
 * Backend
 * ------------------------------------------------------------------ */

const MYSQL_URL = process.env.RECO_TEST_MYSQL_URL;
if (process.env.CI && !MYSQL_URL) {
  throw new Error("CI mà thiếu RECO_TEST_MYSQL_URL — backend production sẽ không được kiểm");
}
const SKIP_MYSQL = MYSQL_URL ? false : "RECO_TEST_MYSQL_URL chưa đặt — bỏ qua backend MySQL";

const cleanups: Array<() => Promise<void>> = [];
after(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

/** Một database MỚI cho mỗi kho: `listRuns` của bài này không được thấy lượt chạy của bài kia. */
async function freshMysql(options: PoolOptions = {}): Promise<RecoDatabase> {
  const name = `ghe1a_reco_test_${process.pid}_${(counter += 1)}`;
  const admin = await createConnection(MYSQL_URL!);
  await admin.query(`CREATE DATABASE \`${name}\``);
  const url = new URL(MYSQL_URL!);
  url.pathname = `/${name}`;
  const db = openRecoDatabase({ ...options, uri: url.toString() });
  cleanups.push(async () => {
    await db.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  });
  return db;
}

interface RunBackend {
  name: string;
  skip: string | false;
  make(): Promise<{
    store: RunStore;
    /** Số bộ dữ liệu đang lưu — `null` khi backend không cho đếm. */
    datasetCount(): Promise<number | null>;
    /** Ghi NỘI DUNG KHÁC dưới một khoá có sẵn — giả một va chạm băm. */
    tamperDataset: ((fingerprint: string) => Promise<void>) | null;
  }>;
}

const RUN_BACKENDS: RunBackend[] = [
  {
    name: "bộ nhớ",
    skip: false,
    async make() {
      return { store: inMemoryRunStore(), datasetCount: async () => null, tamperDataset: null };
    },
  },
  {
    name: "file",
    skip: false,
    async make() {
      const dir = await mkdtemp(path.join(tmpdir(), "reco-stores-"));
      cleanups.push(() => rm(dir, { recursive: true, force: true }));
      return {
        store: fileRunStore(dir),
        datasetCount: async () => (await readdir(path.join(dir, "datasets"))).length,
        tamperDataset: (fp) => writeFile(path.join(dir, "datasets", `${fp}.json`), '{"khác":true}', "utf8"),
      };
    },
  },
  {
    name: "MySQL",
    skip: SKIP_MYSQL,
    async make() {
      const db = await freshMysql();
      return {
        store: mysqlRunStore(db),
        datasetCount: async () => {
          await db.ready();
          const [rows] = await db.pool.query("SELECT COUNT(*) AS n FROM reco_datasets");
          return Number((rows as Array<{ n: number }>)[0].n);
        },
        tamperDataset: async (fp) => {
          await db.pool.query("UPDATE reco_datasets SET body = ? WHERE fingerprint = ?", [
            gzipSync('{"khác":true}'),
            fp,
          ]);
        },
      };
    },
  },
];

interface UserBackend {
  name: string;
  skip: string | false;
  make(): Promise<UserStateStore>;
}

const USER_BACKENDS: UserBackend[] = [
  { name: "bộ nhớ", skip: false, make: async () => inMemoryUserStore() },
  { name: "MySQL", skip: SKIP_MYSQL, make: async () => mysqlUserStore(await freshMysql()) },
];

/* ------------------------------------------------------------------ *
 * RunStore
 * ------------------------------------------------------------------ */

for (const backend of RUN_BACKENDS) {
  const t = (name: string, fn: () => Promise<void>) => test(`kho lượt chạy [${backend.name}] — ${name}`, { skip: backend.skip }, fn);
  /** Kho đã có bộ dữ liệu mà mọi `execute()` đọc — luật 3: bộ dữ liệu trước. */
  const seeded = async () => {
    const made = await backend.make();
    await made.store.saveDataset(fingerprint(DATA), DATA);
    return made;
  };

  t("mọi nhân vật (cả hồ sơ hỏng) lưu rồi chạy lại ra ĐÚNG từng chữ số", async () => {
    // Đi qua kho THẬT — đúng chỗ Map, undefined, -0 và nén/giải nén biến dạng.
    const { store, datasetCount } = await backend.make();
    for (const state of [...USER_FIXTURES, ...BROKEN]) {
      const executed = execute(state);
      const { record } = executed;
      await persistRun(store, executed);
      const loaded = await store.getRun(record.id);
      const snapshot = await store.getDataset(record.inputSnapshot.datasetFingerprint);
      assert.ok(loaded !== null && snapshot !== null);
      assert.deepEqual(loaded, JSON.parse(JSON.stringify(record)), `${record.id}: bản ghi không về nguyên vẹn`);
      const replay = replayRun(loaded, snapshot);
      assert.ok(replay.identical, `chạy lại ${record.id} không khớp`);
      assert.equal(replay.regression, false);
    }
    // Bộ dữ liệu lưu MỘT lần dù mười bảy lượt chạy cùng đọc nó.
    const count = await datasetCount();
    if (count !== null) assert.equal(count, 1);
  });

  t("lượt chạy KHÔNG bị ghi đè, và bản đã lưu còn nguyên", async () => {
    const { store } = await seeded();
    const { record } = execute(vietnamTripFunded);
    await store.saveRun(record);
    await assert.rejects(store.saveRun({ ...record, createdAt: "khác" }), /không ghi đè/);
    assert.equal((await store.getRun(record.id))?.createdAt, record.createdAt);
  });

  t("hai lần lưu CÙNG LÚC một id: đúng một lần qua", async () => {
    const { store } = await seeded();
    const { record } = execute(vietnamTripFunded);
    const results = await Promise.allSettled([store.saveRun(record), store.saveRun({ ...record, createdAt: "2027-01-01T00:00:00.000Z" })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.match(String(rejected.reason), /không ghi đè/);
  });

  t("id khác nhau CHỈ ở hoa thường KHÔNG BAO GIỜ trả về lượt chạy của nhau", async () => {
    // Collation mặc định của MariaDB 11 không phân biệt hoa thường, APFS của
    // macOS cũng vậy: không khai `_bin` / không đối chiếu id thì hai id này là
    // một khoá, và `getRun` đưa bản ghi của người này cho người kia. Kho được
    // phép lưu cả hai, hoặc từ chối id thứ hai — nói ra — nhưng không được lẫn.
    const { store } = await seeded();
    const a = execute(vietnamTripFunded, { id: "Run_Case" }).record;
    const b = execute(aeroplanHeavy, { id: "run_case" }).record;
    await store.saveRun(a);
    const second = await store.saveRun(b).then(
      () => null,
      (error: unknown) => error,
    );
    assert.equal((await store.getRun("Run_Case"))?.inputSnapshot.stateFingerprint, a.inputSnapshot.stateFingerprint);
    if (second === null) {
      assert.equal((await store.getRun("run_case"))?.inputSnapshot.stateFingerprint, b.inputSnapshot.stateFingerprint);
    } else {
      assert.match(String(second), /không phân biệt hoa thường/);
      assert.equal(await store.getRun("run_case"), null);
    }
  });

  t("id lạ bị từ chối — không trèo thư mục, không bị cắt, không bị đệm", async () => {
    const { store } = await seeded();
    for (const bad of ["../x", "a/b", "a:b", "", "a ", " a", "a..b", "x".repeat(129)]) {
      await assert.rejects(store.getRun(bad), /không hợp lệ/, JSON.stringify(bad));
      await assert.rejects(store.saveRun(execute(vietnamTripFunded, { id: bad }).record), /không hợp lệ/, JSON.stringify(bad));
    }
    await assert.rejects(store.saveRun(execute(vietnamTripFunded, { userId: "u 1" }).record), /không hợp lệ/);
  });

  t("lượt chạy mà bộ dữ liệu CHƯA có trong kho bị từ chối — nó sẽ không bao giờ chạy lại được", async () => {
    const { store } = await backend.make();
    const { record } = execute(vietnamTripFunded);
    await assert.rejects(store.saveRun(record), /chưa có trong kho/);
    assert.equal(await store.getRun(record.id), null, "không được để lại bản ghi mồ côi");
    assert.deepEqual(await store.listRuns(), []);
  });

  t("không có thì trả null", async () => {
    const { store } = await backend.make();
    assert.equal(await store.getRun("run_khong_co"), null);
    assert.equal(await store.getDataset(fingerprint({ khong: "co" })), null);
  });

  t("trả về BẢN SAO", async () => {
    const { store } = await seeded();
    const { record } = execute(vietnamTripFunded);
    await store.saveRun(record);
    const first = await store.getRun(record.id);
    first!.outputSnapshot.results[0].primaryAction.score = -1;
    assert.notEqual((await store.getRun(record.id))!.outputSnapshot.results[0].primaryAction.score, -1);
  });

  t("bộ dữ liệu khoá theo NỘI DUNG: khoá sai là lỗi, lưu lại cùng nội dung thì được", async () => {
    const { store } = await backend.make();
    const other = { ...DATA, offers: DATA.offers.slice(1) };
    await assert.rejects(store.saveDataset(fingerprint(DATA), other), /không phải dấu vân tay/);
    await store.saveDataset(fingerprint(DATA), DATA);
    await store.saveDataset(fingerprint(DATA), DATA);
    assert.equal(canonicalJson(await store.getDataset(fingerprint(DATA))), canonicalJson(DATA));
  });

  test(`kho lượt chạy [${backend.name}] — trùng khoá mà KHÁC nội dung là va chạm, nổ chứ không đè`, {
    skip: backend.skip,
  }, async (ctx) => {
    const { store, tamperDataset } = await backend.make();
    if (tamperDataset === null) return ctx.skip("backend không cho ghi lén dưới một khoá");
    await store.saveDataset(fingerprint(DATA), DATA);
    await tamperDataset(fingerprint(DATA));
    await assert.rejects(store.saveDataset(fingerprint(DATA), DATA), /va chạm/);
  });

  t("listRuns: mới nhất trước, hoà thì theo id, lọc theo người, cắt theo limit, tóm tắt đúng", async () => {
    const { store } = await seeded();
    const records = [
      execute(vietnamTripFunded, { id: "r_a", createdAt: "2026-09-12T10:00:00.000Z", userId: "u_1" }).record,
      execute(aeroplanHeavy, { id: "r_b", createdAt: "2026-09-12T11:00:00.000Z", userId: "u_2" }).record,
      execute(vietnamTripFunded, { id: "r_c", createdAt: "2026-09-12T11:00:00.000Z", userId: "u_1" }).record,
      execute(aeroplanHeavy, { id: "r_d", createdAt: "2026-09-12T09:00:00.000Z", userId: null }).record,
    ];
    for (const record of records) await store.saveRun(record);
    const all = await store.listRuns();
    assert.deepEqual(all.map((row) => row.id), ["r_c", "r_b", "r_a", "r_d"]);
    const byId = new Map(records.map((record) => [record.id, record]));
    for (const row of all) assert.deepEqual(row, summarize(byId.get(row.id)!));
    assert.deepEqual((await store.listRuns({ userId: "u_1" })).map((row) => row.id), ["r_c", "r_a"]);
    assert.deepEqual((await store.listRuns({ limit: 2 })).map((row) => row.id), ["r_c", "r_b"]);
    assert.deepEqual(await store.listRuns({ limit: 0 }), []);
    assert.deepEqual(await store.listRuns({ userId: "u_khong_co" }), []);
    // PAD SPACE: không kiểm thì "u_1 " lọc ra lượt chạy của "u_1" trên MySQL.
    await assert.rejects(store.listRuns({ userId: "u_1 " }), /không hợp lệ/);
    for (const limit of [-1, 1.5, Number.NaN]) {
      await assert.rejects(store.listRuns({ limit }), /limit/, String(limit));
    }
  });
}

/* ------------------------------------------------------------------ *
 * UserStateStore
 * ------------------------------------------------------------------ */

/** Thứ kho phải trả về: trạng thái SAU khi đi qua JSON chuẩn hoá — đúng thứ lượt chạy đọc. */
const normalized = (state: UserState) => JSON.parse(canonicalJson(state)) as UserState;

const withId = (state: UserState, id: string): UserState =>
  ({ ...state, profile: { ...state.profile, id } }) as UserState;

for (const backend of USER_BACKENDS) {
  const t = (name: string, fn: () => Promise<void>) => test(`kho người dùng [${backend.name}] — ${name}`, { skip: backend.skip }, fn);

  t("mọi nhân vật tạo rồi đọc lại ra đúng trạng thái đã chuẩn hoá, version 1", async () => {
    const store = await backend.make();
    for (const state of USER_FIXTURES) {
      const created = await store.createUserState(state);
      assert.equal(created.version, 1);
      const back = await store.getStoredUserState(state.profile.id);
      assert.deepEqual(back, { state: normalized(state), version: 1 });
      assert.deepEqual(await store.getUserState(state.profile.id), normalized(state));
    }
  });

  t("tạo trùng id là lỗi, bản cũ còn nguyên", async () => {
    const store = await backend.make();
    await store.createUserState(vietnamTripFunded);
    await assert.rejects(store.createUserState(withId(aeroplanHeavy, vietnamTripFunded.profile.id)), /không ghi đè/);
    assert.deepEqual(await store.getUserState(vietnamTripFunded.profile.id), normalized(vietnamTripFunded));
  });

  t("ghi có điều kiện: đúng version thì qua và tăng, version cũ thì xung đột", async () => {
    const store = await backend.make();
    const id = vietnamTripFunded.profile.id;
    await store.createUserState(vietnamTripFunded);
    const next = { ...vietnamTripFunded, cards: [] as UserState["cards"] };
    const saved = await store.replaceUserState(next, 1);
    assert.deepEqual(saved, { state: normalized(next), version: 2 });
    assert.deepEqual(await store.getStoredUserState(id), { state: normalized(next), version: 2 });
    await assert.rejects(store.replaceUserState(vietnamTripFunded, 1), (error: unknown) => {
      assert.ok(error instanceof UserStateConflictError);
      assert.equal(error.actualVersion, 2);
      return true;
    });
    assert.deepEqual(await store.getUserState(id), normalized(next), "bản ghi thua không được đè");
  });

  t("hai lần ghi CÙNG LÚC trên cùng một version: đúng một lần qua", async () => {
    const store = await backend.make();
    await store.createUserState(vietnamTripFunded);
    const results = await Promise.allSettled([
      store.replaceUserState({ ...vietnamTripFunded, cards: [] as UserState["cards"] }, 1),
      store.replaceUserState({ ...vietnamTripFunded, goals: [] as UserState["goals"] }, 1),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await store.getStoredUserState(vietnamTripFunded.profile.id))?.version, 2);
  });

  t("ghi cho người KHÔNG có là lỗi, không phải tạo mới", async () => {
    const store = await backend.make();
    await assert.rejects(store.replaceUserState(vietnamTripFunded, 1), (error: unknown) => {
      assert.ok(error instanceof UserStateConflictError);
      assert.equal(error.actualVersion, null);
      return true;
    });
    assert.equal(await store.getUserState(vietnamTripFunded.profile.id), null);
  });

  t("không có người dùng này thì trả null; id lạ thì NỔ, không phải null", async () => {
    const store = await backend.make();
    assert.equal(await store.getUserState("u_khong_co"), null);
    assert.equal(await store.getStoredUserState("u_khong_co"), null);
    for (const bad of ["a b", "u_1 ", "x".repeat(129)]) {
      await assert.rejects(store.getUserState(bad), /không hợp lệ/, JSON.stringify(bad));
    }
  });

  t("trả về BẢN SAO", async () => {
    const store = await backend.make();
    await store.createUserState(aeroplanHeavy);
    const first = await store.getUserState(aeroplanHeavy.profile.id);
    first!.cards.pop();
    assert.equal((await store.getUserState(aeroplanHeavy.profile.id))!.cards.length, aeroplanHeavy.cards.length);
  });

  t("id hồ sơ lạ và Map trong trạng thái bị từ chối TRƯỚC khi ghi", async () => {
    const store = await backend.make();
    for (const bad of ["", "a b", "Ü", "a/b", "x".repeat(129)]) {
      await assert.rejects(store.createUserState(withId(vietnamTripFunded, bad)), /không hợp lệ/, JSON.stringify(bad));
    }
    const withMap = { ...vietnamTripFunded, goals: new Map() } as never as UserState;
    await assert.rejects(store.createUserState(withMap), /Map\/Set/);
    await assert.rejects(store.replaceUserState(vietnamTripFunded, 0), /expectedVersion/);
    assert.equal(await store.getUserState(vietnamTripFunded.profile.id), null);
  });
}

/* ------------------------------------------------------------------ *
 * Riêng MySQL — thứ chỉ backend này có: phiên, schema, migration
 * ------------------------------------------------------------------ */

test("MySQL — mọi kết nối của pool chạy STRICT và UTC, bất kể mặc định của server", { skip: SKIP_MYSQL }, async () => {
  // Server test mặc định là STRICT_TRANS_TABLES; thấy STRICT_ALL_TABLES nghĩa
  // là lệnh đầu phiên đã chạy — trên production không kiểm được mặc định.
  const db = await freshMysql();
  const connections = await Promise.all([db.pool.getConnection(), db.pool.getConnection()]);
  for (const connection of connections) {
    const [rows] = await connection.query("SELECT @@SESSION.sql_mode AS mode, @@SESSION.time_zone AS tz");
    const row = (rows as Array<{ mode: string; tz: string }>)[0];
    assert.match(row.mode, /STRICT_ALL_TABLES/);
    assert.equal(row.tz, "+00:00");
    connection.release();
  }
});

test("MySQL — kết nối MƯỢN LẠI vẫn STRICT, kể cả khi cấu hình bật reset lúc trả về pool", { skip: SKIP_MYSQL }, async () => {
  // Reset đưa biến phiên về mặc định server, mà lệnh đầu phiên chỉ chạy cho
  // kết nối MỚI. Một kết nối duy nhất: lần mượn thứ hai chắc chắn là nó.
  const db = await freshMysql({ resetOnRelease: true, connectionLimit: 1 });
  for (let round = 0; round < 2; round += 1) {
    const connection = await db.pool.getConnection();
    const [rows] = await connection.query("SELECT @@SESSION.sql_mode AS mode");
    assert.match((rows as Array<{ mode: string }>)[0].mode, /STRICT_ALL_TABLES/, `lần mượn ${round + 1}`);
    connection.release();
  }
});

test("MySQL — migration chạy lại được: lần hai không đổi gì, lần gãy giữa chừng thì đi tiếp", { skip: SKIP_MYSQL }, async () => {
  const db = await freshMysql();
  const store = mysqlUserStore(db);
  await store.createUserState(vietnamTripFunded);
  await db.ready();
  await db.ready();
  // Giả một lần gãy sau khi tạo bảng mà chưa kịp ghi sổ migration.
  await db.pool.query("DELETE FROM reco_schema_migrations");
  const url = new URL(MYSQL_URL!);
  const [[{ name }]] = (await db.pool.query("SELECT DATABASE() AS name")) as unknown as [[{ name: string }]];
  url.pathname = `/${name}`;
  const again = openRecoDatabase(url.toString());
  try {
    await again.ready();
    const [rows] = await again.pool.query("SELECT id FROM reco_schema_migrations ORDER BY id");
    assert.deepEqual((rows as Array<{ id: number }>).map((row) => Number(row.id)), [1]);
    assert.deepEqual(await mysqlUserStore(again).getUserState(vietnamTripFunded.profile.id), normalized(vietnamTripFunded));
  } finally {
    await again.close();
  }
});

test("cấu hình database: không biến nào thì null, khai MỘT PHẦN thì nổ — không lặng lẽ tắt việc lưu", () => {
  assert.equal(mysqlConfigFromEnv({}), null);
  assert.equal(mysqlConfigFromEnv({ DB_HOST: "", DB_NAME: "" }), null);
  assert.equal(mysqlConfigFromEnv({ DATABASE_URL: "mysql://u:p@localhost/db" }), "mysql://u:p@localhost/db");
  assert.deepEqual(mysqlConfigFromEnv({ DB_HOST: "localhost", DB_USER: "u", DB_PASSWORD: "p", DB_NAME: "db" }), {
    host: "localhost",
    port: 3306,
    user: "u",
    password: "p",
    database: "db",
  });
  assert.throws(() => mysqlConfigFromEnv({ DB_HOST: "localhost", DB_USER: "u", DB_PASSWORD: "p" }), /thiếu DB_NAME/);
  assert.throws(() => mysqlConfigFromEnv({ DB_PASSWORD: "p" }), /thiếu DB_HOST, DB_USER, DB_NAME/);
  assert.throws(
    () => mysqlConfigFromEnv({ DB_HOST: "localhost", DB_USER: "u", DB_NAME: "db", DB_PORT: "33o6" }),
    /DB_PORT/,
  );
});
