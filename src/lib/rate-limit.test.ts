import assert from "node:assert/strict";
import test from "node:test";

import { rateLimit } from "./rate-limit.ts";

const HOUR = 60 * 60 * 1000;

function passed(key: string, limit: number, tries: number, siteWide = false): number {
  let ok = 0;
  for (let i = 0; i < tries; i += 1) {
    if (rateLimit(key, limit, HOUR, { siteWide }).ok) ok += 1;
  }
  return ok;
}

test("Map đầy: trần chung giữ đúng ngân sách của nó, không rơi vào xô chung", () => {
  // Bơm Map tới trần bằng khoá IP xoay, như kẻ đặt `X-Forwarded-For` tuỳ ý.
  for (let i = 0; i < 9_999; i += 1) rateLimit(`contact:ip:10.0.${i >> 8}.${i & 255}`, 5, HOUR);

  // Khoá người gọi tự sinh vẫn vào xô chung (trần 100), không mở ô mới.
  assert.equal(passed("contact:ip:attacker-new", 5, 200), 100);

  // Trần chung tạo SAU khi Map đầy vẫn là trần của chính nó: 30 chứ không phải
  // 100 (Codex 23/11/2026), và 500 chứ không bị ép xuống 100.
  assert.equal(passed("contact:all", 30, 200, true), 30);
  assert.equal(passed("reco:start:all", 500, 600, true), 500);
});
