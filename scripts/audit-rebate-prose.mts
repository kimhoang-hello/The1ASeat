// Đối chiếu con số rebate viết tay trong phần chữ với field `rebateVi`.
//
//   npm run audit:rebate-prose          chỉ báo (exit 1 nếu có lệch)
//   npm run audit:rebate-prose -- --fix sửa thẳng vào Contentful rồi publish
//
// VÌ SAO CẦN, KHI ĐÃ CÓ `/api/check-rebates`: route đó nay tự sửa phần chữ,
// nhưng CHỈ vào lúc FinlyWealth đổi số. Một thẻ giữ nguyên $50 suốt nửa năm mà
// có người gõ "$125 rebate" vào editor's take trong giao diện Contentful thì
// route không có việc gì để làm — nó thấy số cũ bằng số mới rồi đi tiếp. Route
// nay có thêm một lượt canh báo trạng thái đó ra `errors`, nhưng báo thì phải
// đợi tới lượt kế (8:30 hoặc 20:30 UTC) và phải mở log GitHub Actions ra đọc.
//
// Script này là bản chạy tay của cùng phép so, cho lúc đang ngồi sửa nội dung:
// biết ngay, và sửa được ngay bằng `--fix`.
//
// Đo ngày 01/09/2026, trước khi có bất kỳ lượt canh nào: 3 trong 10 thẻ có
// rebate đang lệch giữa badge và phần chữ, cái tệ nhất hứa dư $75.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROSE_FIELDS, rebateFiguresIn, withRebateFigure } from "../src/lib/rebate-prose.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const LOCALE = "en-US";
/** Hạn giờ cho mỗi lượt gọi Contentful. Xem `cmaInit` trong lib/contentful-cma.ts. */
const REQUEST_TIMEOUT_MS = 20_000;
const fix = process.argv.includes("--fix");

const env = Object.fromEntries(
  readFileSync(join(REPO, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const SPACE = env.CONTENTFUL_SPACE_ID;
const CDA = env.CONTENTFUL_ACCESS_TOKEN;
const CMA = env.CONTENTFUL_MANAGEMENT_TOKEN;

if (!SPACE || !CDA) {
  console.error("Thiếu CONTENTFUL_SPACE_ID hoặc CONTENTFUL_ACCESS_TOKEN trong .env.local.");
  process.exit(1);
}
if (fix && !CMA) {
  console.error("--fix cần CONTENTFUL_MANAGEMENT_TOKEN trong .env.local.");
  process.exit(1);
}

interface CmaEntry {
  sys: { id: string; version: number; publishedVersion?: number };
  fields: Record<string, Record<string, unknown>>;
}

/**
 * Đọc qua CMA chứ không qua CDA, dù chỉ để so.
 *
 * CDA trả bản đã publish nhưng đã lọc bỏ mọi field `omitted` — mà
 * `keyBenefitsEn` chính là một trong số đó (xem CONTENTFUL.md). Đọc CDA thì
 * một con số lệch nằm trong đó sẽ không bao giờ được nhìn thấy, và `--fix`
 * cũng cần `sys.version` mà chỉ CMA mới có.
 */
async function listEntries(): Promise<CmaEntry[]> {
  const token = CMA ?? CDA;
  const base = CMA
    ? `https://api.contentful.com/spaces/${SPACE}/environments/master`
    : `https://cdn.contentful.com/spaces/${SPACE}/environments/master`;

  const out: CmaEntry[] = [];
  const host = CMA ? "https://api.contentful.com" : "https://cdn.contentful.com";
  // CON TRỎ MỜ, không phải `skip` — cùng lý do `lib/content` và
  // `lib/contentful-cma` đã bỏ `skip`: một entry rơi khỏi tập kết quả giữa hai
  // lượt lấy làm những entry sau dồn lên và vài cái bị nhảy qua trong im lặng.
  // Script này có `--fix` ghi thẳng vào Contentful, nên một thẻ bị nhảy qua là
  // một con số rebate sai nằm lại trên site mà lượt chạy nào cũng báo sạch.
  let url = `${base}/entries?content_type=creditCardOffer&limit=100&cursor=true`;

  for (;;) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // Hạn giờ, cùng lý do `cmaInit` trong `lib/contentful-cma.ts`: không có
      // nó thì một kết nối mở rồi im giữ script lại vô hạn.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // Ném chứ không coi là danh sách rỗng: một lượt đọc hỏng mà im lặng sẽ in
    // ra "không có chỗ nào lệch" và người đọc tin là sạch.
    if (!res.ok) throw new Error(`Đọc entries hỏng: ${res.status} ${await res.text()}`);

    const data = await res.json();
    out.push(...((data.items ?? []) as CmaEntry[]));
    const next = data.pages?.next;
    if (typeof next !== "string" || !next) return out;
    url = new URL(next, host).toString();
  }
}

function valueOf(entry: CmaEntry, name: string): unknown {
  const raw = entry.fields[name];
  // CMA lồng theo locale, CDA thì không — script chạy được với cả hai nguồn.
  if (raw && typeof raw === "object" && !Array.isArray(raw) && LOCALE in raw) return raw[LOCALE];
  return raw;
}

const entries = await listEntries();
let mismatches = 0;
let fixed = 0;
/** Chỗ lệch còn nguyên sau khi chạy xong — cái quyết định exit code. */
let unresolved = 0;

for (const entry of entries) {
  const slug = (valueOf(entry, "slug") as string) ?? entry.sys.id;
  const amount = valueOf(entry, "rebateVi") as string | undefined;

  const patch: Record<string, unknown> = {};
  const found: { field: string; figure: string }[] = [];

  for (const name of PROSE_FIELDS) {
    const value = valueOf(entry, name);
    const texts = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
    const figures = texts.flatMap((t) => (typeof t === "string" ? rebateFiguresIn(t) : []));
    if (figures.length === 0) continue;

    // Thẻ KHÔNG có `rebateVi` nhưng phần chữ vẫn hứa một khoản rebate. Không
    // phải ca lý thuyết: đổi link apply sang thẳng ngân hàng thì `rebateVi`
    // được gỡ, còn câu HOT TIP thì nằm lại — hứa tiền cho một con đường không
    // còn trả đồng nào. `--fix` KHÔNG tự sửa: xoá câu chữ của tác giả là việc
    // của người, không phải của script.
    if (!amount) {
      for (const figure of figures) found.push({ field: name, figure });
      continue;
    }

    for (const figure of figures) if (figure !== amount) found.push({ field: name, figure });

    if (typeof value === "string") {
      const next = withRebateFigure(value, amount);
      if (next !== value) patch[name] = next;
    } else if (Array.isArray(value)) {
      const next = value.map((t) => (typeof t === "string" ? withRebateFigure(t, amount) : t));
      if (next.some((t, i) => t !== value[i])) patch[name] = next;
    }
  }

  if (found.length === 0) continue;
  mismatches += found.length;

  console.log(`\n${slug}  —  badge: ${amount ?? "(không có rebateVi)"}`);
  for (const { field, figure } of found) console.log(`   ${field}: "${figure} rebate"`);

  // Không sửa được (đang ở chế độ chỉ báo, hoặc thẻ không có `rebateVi` nên
  // không biết sửa thành số nào) — những chỗ này còn nguyên sau khi chạy xong.
  if (!fix || !amount) {
    unresolved += found.length;
    continue;
  }

  if (entry.sys.publishedVersion && entry.sys.version > entry.sys.publishedVersion + 1) {
    console.log("   → BỎ QUA: entry có thay đổi chưa publish, sửa tay trong Contentful");
    unresolved += found.length;
    continue;
  }

  const base = `https://api.contentful.com/spaces/${SPACE}/environments/master`;
  const fields = { ...entry.fields };
  for (const [name, value] of Object.entries(patch)) fields[name] = { [LOCALE]: value };

  const put = await fetch(`${base}/entries/${entry.sys.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CMA}`,
      "X-Contentful-Version": String(entry.sys.version),
      "Content-Type": "application/vnd.contentful.management.v1+json",
    },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!put.ok) throw new Error(`Ghi ${slug} hỏng: ${put.status} ${await put.text()}`);

  // Entry đang là draft thì để nguyên draft — cùng luật với `updateEntry`.
  if (entry.sys.publishedVersion) {
    const updated = (await put.json()) as CmaEntry;
    const pub = await fetch(`${base}/entries/${entry.sys.id}/published`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CMA}`,
        "X-Contentful-Version": String(updated.sys.version),
        "X-Contentful-Content-Type": "creditCardOffer",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!pub.ok) throw new Error(`Publish ${slug} hỏng: ${pub.status} ${await pub.text()}`);
  }

  console.log(`   → đã sửa thành ${amount} (${Object.keys(patch).join(", ")})`);
  fixed += Object.keys(patch).length;
}

console.log(
  `\nĐã rà ${entries.length} thẻ — ${mismatches} chỗ lệch` +
    (fix ? `, sửa ${fixed} trường, còn ${unresolved} chỗ cần người xử lý.` : mismatches ? ". Chạy lại với --fix để sửa." : "."),
);

// Đỏ khi CÒN chỗ lệch, không phải khi "có chỗ lệch mà chẳng sửa được gì".
//
// Bản đầu viết `mismatches > 0 && (!fix || fixed === 0)`: một lượt `--fix` sửa
// được thẻ A nhưng bỏ qua thẻ B (B không có `rebateVi`, hoặc đang có bản nháp)
// sẽ có `fixed > 0` và thoát 0 — xanh giả, đúng thứ mà chính comment này cấm.
// Đếm cái CÒN LẠI thì không có đường nào xanh giả được.
if (unresolved > 0) process.exit(1);
