import { test } from "node:test";
import assert from "node:assert/strict";
import { settleWithin } from "./deadline.ts";

const later = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const failLater = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("boom")), ms));

test("về kịp hạn thì trả giá trị", async () => {
  assert.deepEqual(await settleWithin(later(5, [1, 2]), 200), { ok: true, value: [1, 2] });
});

test("quá hạn thì trả timeout, không chờ promise", async () => {
  const started = Date.now();
  const result = await settleWithin(later(2_000, "trễ"), 50);
  assert.deepEqual(result, { ok: false, reason: "timeout" });
  assert.ok(Date.now() - started < 1_000, "phải trả về ngay khi hết hạn");
});

test("lỗi trước hạn thì trả error, không ném", async () => {
  const result = await settleWithin(failLater(5), 200);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "error");
});

// Ca nguy hiểm nhất: promise THUA cuộc đua rồi mới reject. Không có `catch` gắn
// sẵn thì đó là unhandled rejection — Node dừng cả tiến trình.
test("thua cuộc rồi mới reject: không có unhandled rejection", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    assert.deepEqual(await settleWithin(failLater(80), 10), { ok: false, reason: "timeout" });
    await later(150, null);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});
