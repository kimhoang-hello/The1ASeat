// Báo cho Bing — và mọi máy tìm kiếm dùng chung IndexNow (Yandex, Seznam,
// Naver…) — những URL vừa đổi trên ghe1a.com.
//
//   npm run indexnow                       # URL có lastmod trong 7 ngày qua
//   npm run indexnow -- --days 30
//   npm run indexnow -- --all              # cả sitemap, kể cả URL không có lastmod
//   npm run indexnow -- --dry-run          # chỉ in danh sách, không gửi
//   npm run indexnow -- --sitemap http://localhost:3100/sitemap.xml
//
// VÌ SAO: ngày 10/10/2026 Bing KHÔNG có trang nào của ghe1a.com —
// `site:ghe1a.com` trả về site khác. Bing là chỉ mục đứng sau ChatGPT search,
// Copilot và DuckDuckGo. Site không có backlink nào (Search Console → Links →
// External: 0) và chưa đăng ký Bing Webmaster Tools, nên Bing không có đường nào
// biết site tồn tại. Google KHÔNG đọc IndexNow; phía Google là sitemap đã nộp
// trong Search Console.
//
// Chạy từ máy này, không từ GitHub Actions: CDN Hostinger trả trang "Checking
// your browser" cho runner, nên runner không đọc được sitemap. Bị challenge cả
// ở máy này thì truyền `--sitemap` trỏ vào bản build cục bộ (`npx next start`):
// sitemap ở đó đã mang URL production vì `SITE_URL` là hằng số.
//
// Chỉ gửi URL ĐÃ ĐỔI. IndexNow chịu được gửi lại, nhưng gửi cả sitemap mỗi lần
// là nói với Bing rằng mọi trang đều vừa đổi — đúng loại lời khai vô nghĩa mà
// `sitemap.ts` đã bỏ cho `lastmod`.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = "https://ghe1a.com";
const HOST = "ghe1a.com";
/** Khoá công khai theo thiết kế: ai cũng đọc được ở `${SITE}/${KEY}.txt`. Nó chỉ
 *  chứng minh người gửi kiểm soát host, không phải một bí mật. */
const KEY = "a2bc2088b13027803bbd940eadd13312";
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
/** Trần mỗi lượt gửi theo đặc tả IndexNow. */
const MAX_URLS = 10_000;
const FETCH_TIMEOUT_MS = 20_000;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
function option(name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

const ALL = flag("--all");
const DRY_RUN = flag("--dry-run");
const DAYS = Number(option("--days") ?? 7);
const SITEMAP = option("--sitemap") ?? `${SITE}/sitemap.xml`;

if (!Number.isFinite(DAYS) || DAYS <= 0) {
  console.error(`--days phải là số dương, nhận "${option("--days")}".`);
  process.exit(1);
}

const keyFile = fileURLToPath(new URL(`../public/${KEY}.txt`, import.meta.url));
if (!existsSync(keyFile) || readFileSync(keyFile, "utf8").trim() !== KEY) {
  console.error(`Thiếu hoặc sai public/${KEY}.txt — file đó phải chứa đúng khoá.`);
  process.exit(1);
}

async function get(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

/** Trang challenge của hcdn trả 403 kèm HTML này cho MỌI user agent sau vài
 *  request liên tiếp — nó không nói gì về việc file có tồn tại hay không. */
const isChallenge = (body: string) => /Checking your browser/i.test(body);

// 1. File khoá phải đang được phục vụ, nếu không IndexNow trả 403 và mọi URL
//    trong lượt gửi bị bỏ. Lỗi hay gặp nhất: chạy trước khi deploy xong.
const live = await get(KEY_LOCATION).catch((err: unknown) => ({ status: 0, body: String(err) }));
if (live.status === 200 && live.body.trim() === KEY) {
  console.log(`✓ ${KEY_LOCATION} đang được phục vụ.`);
} else if (isChallenge(live.body)) {
  console.warn(`⚠︎ CDN trả trang challenge cho ${KEY_LOCATION} — không kiểm được, vẫn gửi.`);
} else {
  const problem = `${KEY_LOCATION} trả ${live.status}${live.status === 200 ? " nhưng nội dung khác khoá" : ""}.`;
  // `--dry-run` không gửi gì, nên cho nó chạy được cả trước khi deploy.
  if (!DRY_RUN) {
    console.error(`✗ ${problem} Deploy xong rồi chạy lại.`);
    process.exit(1);
  }
  console.warn(`⚠︎ ${problem}`);
}

// 2. Đọc sitemap.
const sitemap = await get(SITEMAP);
if (sitemap.status !== 200 || !sitemap.body.includes("<urlset")) {
  console.error(
    `✗ ${SITEMAP} trả ${sitemap.status}${isChallenge(sitemap.body) ? " (trang challenge của CDN)" : ""}. ` +
      `Thử --sitemap trỏ vào bản build cục bộ.`,
  );
  process.exit(1);
}

const entries = [...sitemap.body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  loc: (m[1].match(/<loc>([^<]+)<\/loc>/) ?? [])[1]?.trim() ?? "",
  lastmod: (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) ?? [])[1]?.trim(),
}));

// Chỉ URL của chính host. Sitemap cục bộ cũng mang URL production, nên lọc
// theo host chứ không theo `SITEMAP` — gửi URL host khác là IndexNow trả 422.
const ours = entries.filter((entry) => {
  try {
    return new URL(entry.loc).host === HOST;
  } catch {
    return false;
  }
});
if (ours.length === 0) {
  console.error(`✗ Sitemap không có URL nào của ${HOST}.`);
  process.exit(1);
}

const since = Date.now() - DAYS * 24 * 60 * 60 * 1000;
const urls = ALL
  ? ours.map((entry) => entry.loc)
  : ours
      .filter((entry) => {
        const at = entry.lastmod ? new Date(entry.lastmod).getTime() : Number.NaN;
        return Number.isFinite(at) && at >= since;
      })
      .map((entry) => entry.loc);

const withoutLastmod = ours.filter((entry) => !entry.lastmod).length;
console.log(
  ALL
    ? `${urls.length} URL (cả sitemap).`
    : `${urls.length}/${ours.length} URL có lastmod trong ${DAYS} ngày qua` +
        (withoutLastmod ? ` — ${withoutLastmod} URL không có lastmod chỉ đi theo --all.` : "."),
);

if (urls.length === 0) process.exit(0);
if (DRY_RUN) {
  for (const url of urls) console.log(`  ${url}`);
  process.exit(0);
}

// 3. Gửi. 200 và 202 đều là nhận; 202 nghĩa là khoá còn đang được xác minh.
const MEANING: Record<number, string> = {
  200: "đã nhận",
  202: "đã nhận, khoá đang được xác minh",
  400: "yêu cầu sai định dạng",
  403: "khoá không hợp lệ — file khoá không đọc được từ phía IndexNow",
  422: "có URL không thuộc host, hoặc khoá không khớp",
  429: "gửi quá dày, bị coi là spam",
};

let failed = false;
for (let start = 0; start < urls.length; start += MAX_URLS) {
  const batch = urls.slice(start, start + MAX_URLS);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: batch }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const ok = res.status === 200 || res.status === 202;
  failed ||= !ok;
  console.log(`${ok ? "✓" : "✗"} ${res.status} ${MEANING[res.status] ?? "không rõ"} — ${batch.length} URL.`);
  if (!ok) console.log(await res.text());
}

process.exit(failed ? 1 : 0);
