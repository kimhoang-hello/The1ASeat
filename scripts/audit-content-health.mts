// Rà sức khoẻ NỘI DUNG ĐANG PHỤC VỤ.
//
//   npm run audit:health
//
// VÌ SAO CẦN, KHI ĐÃ CÓ 4 AUDIT KIA: bốn cái đó mỗi cái soi một trục hẹp
// (ký hiệu ®/™, bảng award, số rebate). Không cái nào trả lời được câu
// "hôm nay người đọc đang thấy gì" — offer nào đã chết mà còn treo, thẻ nào
// vừa thêm mà rơi khỏi mọi filter, bonus nào sắp hết hạn tới nơi. Đó là những
// thứ `lint`/`tsc`/`build` không bao giờ thấy, vì chúng nằm trong Contentful.
//
// ĐỌC QUA CDA, không phải CMA. CMA trả bản DRAFT, mà câu hỏi ở đây là về bản
// người đọc đang nhận — một tác giả đang viết dở không được làm job này đỏ.
// Ngoại lệ duy nhất là mục "draft lệch": muốn biết chuyện đó thì buộc phải hỏi
// CMA, và nó chỉ báo chứ không tính là lỗi.
//
// Exit 1 cho những thứ CẦN NGƯỜI NHÌN. Sắp hết hạn, thiếu mô tả SEO và draft
// lệch chỉ in ra: chúng là việc biên tập, không phải hỏng hóc, và một job đỏ
// dai vì lý do đó thì chẳng mấy chốc không ai đọc nữa.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { programIdFor } from "../src/lib/card-points-programs.ts";
import type { CreditCardOffer } from "../src/lib/content/types.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));

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

const FETCH_TIMEOUT_MS = 20_000;

interface Entry {
  sys: { id: string; version?: number; publishedVersion?: number };
  fields: Record<string, unknown>;
}

/** Một trường dạng chuỗi, bỏ qua mọi thứ không phải chuỗi. */
function str(entry: Entry, name: string): string | undefined {
  const v = entry.fields[name];
  return typeof v === "string" ? v : undefined;
}

/** Cùng trường đó trên bản CMA, nơi mỗi field còn bọc thêm một lớp locale. */
function cmaStr(entry: Entry, name: string): string | undefined {
  const v = entry.fields[name];
  if (v && typeof v === "object") {
    const inner = (v as Record<string, unknown>)["en-US"];
    if (typeof inner === "string") return inner;
  }
  return undefined;
}

function list(entry: Entry, name: string): string[] {
  const v = entry.fields[name];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Con trỏ mờ, cùng lý do `lib/content` và `lib/contentful-cma` đã bỏ `skip`:
 * một entry rơi khỏi tập kết quả giữa hai lượt lấy làm những entry sau dồn lên
 * và vài cái bị nhảy qua trong im lặng. Một audit bỏ sót entry còn tệ hơn
 * không có audit, vì nó in ra "sạch".
 */
async function readAll(type: string, api: "cda" | "cma"): Promise<Entry[]> {
  const host = api === "cda" ? "https://cdn.contentful.com" : "https://api.contentful.com";
  const token = api === "cda" ? CDA : CMA;
  const out: Entry[] = [];
  let url = `${host}/spaces/${SPACE}/environments/master/entries?content_type=${type}&limit=100&cursor=true`;

  for (;;) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    // Một lượt liệt kê hỏng mà đọc thành trang rỗng thì audit in ra "không có
    // vấn đề gì" đúng vào lúc nó không biết gì cả.
    if (!res.ok) throw new Error(`Đọc ${type} (${api}) hỏng: ${res.status} ${await res.text()}`);

    const data = await res.json();
    out.push(...((data.items ?? []) as Entry[]));
    const next = data.pages?.next;
    if (typeof next !== "string" || !next) return out;
    url = new URL(next, host).toString();
  }
}

/** Ngày hôm nay ở Toronto, cùng múi giờ `hasExpired` trong `lib/format-date`. */
function todayInSiteZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const TODAY = todayInSiteZone();

/**
 * Cộng ngày TRÊN NGÀY TORONTO, không phải trên `new Date()`.
 *
 * Bản đầu cộng vào mốc UTC hiện tại, mà sau 20:00 giờ Toronto thì UTC đã sang
 * hôm sau — nên `plusDays(7)` ra ngày cách TODAY tận 8 hôm và cửa sổ "sắp hết
 * hạn trong 7 ngày" âm thầm rộng thêm một ngày. Đo được: chạy lúc 20:30 EDT
 * ngày 02/09 cho ra 10/09 thay vì 09/09. Audit chạy 9 giờ sáng nên chưa bao
 * giờ dính, nhưng một cái audit nói sai về ngày thì hỏng đúng thứ nó đo.
 *
 * Neo vào giữa trưa UTC để phép cộng không bao giờ rơi trúng mốc đổi giờ.
 */
function plusDays(days: number): string {
  const [year, month, day] = TODAY.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day, 12));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * So THEO NGÀY, không so mốc thời gian — `expiresAt` được đọc là ngày cuối
 * cùng còn hiệu lực và dữ liệu đang lẫn hai kiểu lưu (`00:00` đầu ngày ở hầu
 * hết entry, `23:59` cuối ngày ở một cái). Xem `hasExpired` trong
 * `lib/format-date.ts`; lệch cách so ở đây là audit báo sai so với thứ người
 * đọc nhìn thấy trên trang.
 */
const expired = (d?: string) => typeof d === "string" && d.slice(0, 10) < TODAY;
const soon = (d?: string) =>
  typeof d === "string" && d.slice(0, 10) >= TODAY && d.slice(0, 10) <= plusDays(7);

const problems: string[] = [];
const notes: string[] = [];

const [cards, bonuses, posts] = await Promise.all([
  readAll("creditCardOffer", "cda"),
  readAll("transferBonus", "cda"),
  readAll("blogPost", "cda"),
]);

console.log(`Đang phục vụ: ${cards.length} thẻ, ${bonuses.length} transfer bonus, ${posts.length} bài\n`);

// ---- 1. Đã hết hạn mà còn trên site ------------------------------------
// Job `expire-offers` chạy ngày một lượt và có thể đỏ im lặng (xem AGENTS.md).
// Đây là lưới thứ hai, nhìn từ phía người đọc.
for (const c of cards) {
  if (expired(str(c, "expiresAt"))) {
    problems.push(
      `thẻ "${str(c, "slug")}" hết hạn ${str(c, "expiresAt")?.slice(0, 10)} mà vẫn đang phục vụ` +
        (c.fields.elevatedBonus === true ? " (cờ elevated còn bật)" : ""),
    );
  }
}
for (const b of bonuses) {
  if (expired(str(b, "expiresAt"))) {
    problems.push(
      `transfer bonus "${str(b, "slug") ?? b.sys.id}" hết hạn ${str(b, "expiresAt")?.slice(0, 10)} mà vẫn đang phục vụ`,
    );
  }
}

// ---- 2. Sắp hết hạn ----------------------------------------------------
// Không phải lỗi. Nhưng cả hai bonus cùng hết hạn một ngày là trang
// `/transfer-bonuses` rỗng vào sáng hôm sau, và biết trước một tuần thì còn
// kịp tìm cái thay thế.
for (const c of cards) {
  if (soon(str(c, "expiresAt"))) notes.push(`thẻ "${str(c, "slug")}" hết hạn ${str(c, "expiresAt")?.slice(0, 10)}`);
}
for (const b of bonuses) {
  if (soon(str(b, "expiresAt")))
    notes.push(`transfer bonus "${str(b, "slug") ?? b.sys.id}" hết hạn ${str(b, "expiresAt")?.slice(0, 10)}`);
}
const liveBonuses = bonuses.filter((b) => !expired(str(b, "expiresAt")));
const bonusesLeftAfterWeek = liveBonuses.filter((b) => !soon(str(b, "expiresAt"))).length;
if (liveBonuses.length > 0 && bonusesLeftAfterWeek === 0) {
  notes.push(
    `CẢ ${liveBonuses.length} transfer bonus đều hết hạn trong 7 ngày — trang /transfer-bonuses và khối trang chủ sẽ rỗng`,
  );
}

// ---- 3. Thẻ rơi khỏi filter chip --------------------------------------
// `lib/card-points-programs.ts` suy chương trình điểm từ chính nội dung thẻ,
// nên một thẻ mang chương trình mới mà chưa có rule thì mất chip TRONG IM
// LẶNG. Đánh đổi có chủ ý (Contentful không có trường này) — nhưng im lặng
// thì phải có chỗ nào đó lên tiếng, và đây là chỗ đó.
for (const c of cards) {
  // `programIdFor` chỉ đọc ba trường này; dựng đúng ba cái thay vì ép cả entry.
  const offer = {
    name: str(c, "name") ?? "",
    welcomeBonus: str(c, "welcomeBonusVi") ?? "",
    keyBenefits: list(c, "keyBenefitsVi"),
  } as unknown as CreditCardOffer;
  if (!programIdFor(offer)) {
    problems.push(
      `thẻ "${str(c, "slug")}" không khớp rule nào trong lib/card-points-programs.ts — mất filter chip`,
    );
  }
}

// ---- 4. Thẻ thiếu nội dung bắt buộc -----------------------------------
// `welcomeBonusVi` KHÔNG nằm trong danh sách: nó là field tuỳ chọn và có thẻ
// thật sự không có welcome bonus (Wealthsimple, National Bank). Đòi nó là
// audit kêu mỗi ngày về một chuyện đúng.
for (const c of cards) {
  const missing = (
    [
      ["cardImage", Boolean(c.fields.cardImage)],
      ["keyBenefitsVi", list(c, "keyBenefitsVi").length > 0],
      ["editorsTakeVi", Boolean(str(c, "editorsTakeVi"))],
      ["headlineVi", Boolean(str(c, "headlineVi"))],
      ["applyUrl", Boolean(str(c, "applyUrl"))],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) problems.push(`thẻ "${str(c, "slug")}" thiếu ${missing.join(", ")}`);
}

// ---- 5. Link apply hỏng dạng ------------------------------------------
// Chỉ kiểm DẠNG, KHÔNG gọi ra ngoài: link affiliate là link có đếm click, gọi
// thử mỗi lượt audit là tự bơm số cho chính mình.
//
// ĐÒI ĐÚNG `http(s)`, không chỉ đòi `new URL()` chạy được. `new URL()` nhận cả
// `javascript:alert(1)` — mà khác với link trong thân bài (đã có `isSafeHref`
// gác), `applyUrl` đi thẳng vào `href` của nút Apply và vào JSON-LD, không qua
// cửa nào. Ô nhập trong Contentful là chuỗi tự do nên đây là chỗ duy nhất nói
// được câu đó.
for (const c of cards) {
  const raw = str(c, "applyUrl") ?? "";
  let scheme = "";
  try {
    scheme = new URL(raw).protocol;
  } catch {
    problems.push(`thẻ "${str(c, "slug")}" có applyUrl không phải URL hợp lệ: ${raw}`);
    continue;
  }
  if (scheme !== "https:" && scheme !== "http:") {
    problems.push(`thẻ "${str(c, "slug")}" có applyUrl dùng scheme "${scheme}" thay vì http(s): ${raw}`);
  }
}

// ---- 6. Trùng slug -----------------------------------------------------
// Hai entry cùng slug thì một cái không bao giờ hiện ra, và không có gì đỏ.
for (const [label, list] of [
  ["thẻ", cards],
  ["bài", posts],
  ["transfer bonus", bonuses],
] as const) {
  const seen = new Map<string, number>();
  for (const e of list) {
    const key = str(e, "slug") ?? e.sys.id;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [s, n] of seen) if (n > 1) problems.push(`${label} trùng slug "${s}" (${n} entry)`);
}

// ---- 7. Bài thiếu mô tả SEO -------------------------------------------
// Việc biên tập, không phải hỏng hóc — chỉ đếm. Bài video mang tiêu đề tiếng
// Anh nên `seoTitleVi`/`seoDescriptionVi` là chỗ duy nhất nói tiếng Việt với
// Google; thiếu thì Google tự bịa snippet từ `excerptVi` chung chung mà job
// sync sinh ra.
const noSeoDesc = posts.filter((p) => !str(p, "seoDescriptionVi"));
const noSeoTitle = posts.filter((p) => !str(p, "seoTitleVi"));
if (noSeoDesc.length || noSeoTitle.length) {
  notes.push(
    `SEO: ${noSeoDesc.length}/${posts.length} bài thiếu seoDescriptionVi, ${noSeoTitle.length} thiếu seoTitleVi`,
  );
}

// ---- 8. Draft lệch bản published --------------------------------------
// Chỉ báo. `updateEntry` publish CẢ ENTRY, nên `expire-offers` và
// `check-rebates` cố tình BỎ QUA entry đang có thay đổi chưa publish thay vì
// đẩy bản nháp của tác giả lên site — nghĩa là một entry để lâu ở trạng thái
// đó sẽ lặng lẽ rơi khỏi mọi job. Cần token CMA; không có thì bỏ qua mục này.
if (CMA) {
  for (const type of ["creditCardOffer", "transferBonus", "blogPost"]) {
    for (const e of await readAll(type, "cma")) {
      const pub = e.sys.publishedVersion;
      const slug = cmaStr(e, "slug") ?? e.sys.id;
      if (pub == null) continue; // Chưa publish bao giờ — có thể là bản nháp thật.
      if ((e.sys.version ?? 0) > pub + 1) {
        notes.push(`${type} "${slug}" có thay đổi chưa publish — job sẽ bỏ qua entry này`);
      }
    }
  }
} else {
  notes.push("(bỏ qua kiểm draft lệch: không có CONTENTFUL_MANAGEMENT_TOKEN)");
}

// ---- Kết quả -----------------------------------------------------------
if (notes.length) {
  console.log("Nhắc (không phải lỗi):");
  for (const n of notes) console.log(`  ·  ${n}`);
  console.log();
}

if (problems.length) {
  console.log(`===== CẦN NGƯỜI NHÌN: ${problems.length} chỗ =====`);
  for (const p of problems) console.log(`  ✗  ${p}`);
  process.exit(1);
}

console.log("Nội dung đang phục vụ: không có vấn đề nào cần người nhìn.");
