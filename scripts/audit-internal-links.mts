// Rà MẠNG LINK NỘI BỘ của site đang chạy.
//
//   npm run audit:links                      # crawl ghe1a.com
//   npm run audit:links -- http://localhost:3000
//
// VÌ SAO CẦN, KHI ĐÃ CÓ BÁO CÁO SEO HẰNG TUẦN: báo cáo đó soi từng trang một
// — mã trạng thái, canonical, tiêu đề, dữ liệu có cấu trúc. Không mục nào của
// nó nhìn được thứ chỉ hiện ra khi đặt 113 trang cạnh nhau: trang nào chỉ có
// đúng một đường dẫn vào.
//
// Đo ngày 03/09/2026, trước khi các trang bắt đầu trỏ sang anh em của mình:
// 8 trong 26 trang thẻ (gồm CẢ BỐN thẻ Aeroplan®) và cả 29 trang tài khoản
// ngân hàng chỉ có duy nhất trang danh sách trỏ vào. Với crawler, một trang ở
// cuối một cửa duy nhất là một trang ít quan trọng — dù nó là trang ra tiền.
//
// Loại lỗi này KHÔNG có gì báo: `lint`, `tsc`, `build` đều xanh, mỗi trang mở
// ra đều đẹp, và nó chỉ sinh ra từ những thay đổi trông vô hại (thêm tài khoản
// thứ tư cho một ngân hàng, thêm một hệ điểm chỉ có một thẻ).
//
// Nó cũng bắt chiều ngược lại: link nội bộ trỏ tới trang KHÔNG CÒN. Trang thẻ
// bị unpublish tay trong Contentful biến mất khỏi sitemap ngay, nhưng những
// trang đang trỏ tới nó thì chỉ đổi khi tới lượt render lại — nên trong cửa sổ
// đó site tự trỏ vào 404 của chính mình. Chỉ đối chiếu link với sitemap là
// không đủ: link nằm ngoài sitemap sẽ bị bỏ qua trong im lặng, đúng chỗ đáng
// lo nhất. Nên mọi đích nội bộ không có trong sitemap đều được TẢI THỬ.
//
// Exit 1 khi có trang KHÔNG trang nào trỏ vào, hoặc có link nội bộ trỏ tới
// trang không tải được. Trang chỉ có một đường vào thì in ra nhưng không làm
// đỏ: đôi khi đó là sự thật của nội dung, và một job đỏ dai thì chẳng mấy chốc
// không ai đọc nữa — cùng luật với `audit:health`.

const BASE = (process.argv[2] ?? "https://ghe1a.com").replace(/\/$/, "");
const CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 20_000;

/** Ngưỡng cắt mô tả của Google. Xem `META_DESCRIPTION_MAX` trong
 *  `src/lib/bank-account-schema.ts` — cùng con số, cùng lý do. */
const DESC_MAX = 160;
/** Dưới mức này là bỏ phí chỗ hiển thị, không phải lỗi. */
const DESC_MIN = 70;

/** Đuôi file tĩnh mà site này thật sự phát ra trong `href`. */
const STATIC_FILE_EXTENSIONS = [
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".xml",
  ".txt",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".mp4",
  ".webm",
];

async function get(url: string): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    return { status: res.status, html: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'");
}

function meta(html: string, re: RegExp): string | undefined {
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : undefined;
}

/** Đường dẫn nội bộ trong một trang, đã bỏ tham số và neo.
 *
 *  Bỏ `?` và `#` chứ không giữ: `/credit-cards?points=aeroplan` và
 *  `/credit-cards` là CÙNG một trang với crawler (trang lọc canonical về trang
 *  trần), nên đếm riêng là tự nói dối rằng có thêm một đường. Đúng cái bẫy làm
 *  cho mạng link trông dày hơn thực tế. */
function internalPaths(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const raw = m[1].split("#")[0].split("?")[0];
    if (!raw || raw.startsWith("/_next/") || raw.startsWith("/api/")) continue;
    // Bỏ file tĩnh (favicon, logo, ảnh): chúng không phải trang, không vào
    // sitemap, và tính chúng là "đích nội bộ" thì mọi trang đều báo thiếu.
    //
    // Danh sách đuôi CỤ THỂ, không phải "mọi thứ sau dấu chấm cuối": slug bài
    // viết là chữ tự do trong Contentful, không có gì cấm một slug kiểu
    // `.../deal-v1.2`, và một luật đuôi mở sẽ nuốt đúng trang thật trong im
    // lặng — kiểu bỏ sót tệ nhất với một script tồn tại để bắt chỗ bỏ sót.
    if (STATIC_FILE_EXTENSIONS.some((ext) => raw.toLowerCase().endsWith(ext)))
      continue;
    out.add(raw.replace(/\/$/, "") || "/");
  }
  return out;
}

const sitemap = await get(`${BASE}/sitemap.xml`);
if (sitemap.status !== 200) {
  console.error(`Không đọc được ${BASE}/sitemap.xml (HTTP ${sitemap.status}).`);
  process.exit(1);
}
const urls = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  decodeEntities(m[1]),
);
if (!urls.length) {
  console.error("Sitemap không có URL nào — sai địa chỉ, hay site đang hỏng?");
  process.exit(1);
}

interface Page {
  path: string;
  status: number;
  title?: string;
  description?: string;
  links: Set<string>;
}

const pages: Page[] = [];
const queue = [...urls];

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const url = queue.shift()!;
      // Đường dẫn lấy từ chính URL trong sitemap, KHÔNG từ `BASE`: chạy với
      // localhost thì sitemap vẫn khai ghe1a.com, nên phải ghép lại.
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      try {
        const { status, html } = await get(`${BASE}${path}`);
        pages.push({
          path,
          status,
          title: meta(html, /<title>([\s\S]*?)<\/title>/i),
          description: meta(
            html,
            /<meta name="description" content="([^"]*)"/i,
          ),
          links: internalPaths(html),
        });
      } catch (error) {
        pages.push({ path, status: 0, links: new Set(), title: String(error) });
      }
    }
  }),
);

pages.sort((a, b) => a.path.localeCompare(b.path));

const known = new Set(pages.map((p) => p.path));
const inbound = new Map<string, Set<string>>(
  pages.map((p) => [p.path, new Set<string>()]),
);
for (const page of pages) {
  for (const target of page.links) {
    // Trang tự trỏ về mình không phải một đường dẫn vào.
    if (target !== page.path && known.has(target))
      inbound.get(target)!.add(page.path);
  }
}

const problems: string[] = [];
const notes: string[] = [];

for (const page of pages) {
  if (page.status !== 200)
    problems.push(`${page.path} trả HTTP ${page.status || "lỗi mạng"}`);
}

const orphans = pages.filter(
  (p) => p.status === 200 && inbound.get(p.path)!.size === 0,
);
// Trang chủ được trỏ tới bằng `href="/"` từ logo, nhưng nó cũng là trang duy
// nhất mà không ai cần link nội bộ mới tới được — bỏ ra khỏi phép đếm.
for (const page of orphans.filter((p) => p.path !== "/")) {
  problems.push(`${page.path} — KHÔNG trang nào trên site trỏ vào`);
}

const lonely = pages.filter(
  (p) => p.status === 200 && p.path !== "/" && inbound.get(p.path)!.size === 1,
);
if (lonely.length) {
  notes.push(`${lonely.length} trang chỉ có đúng một đường dẫn vào:`);
  for (const page of lonely) {
    notes.push(`    ${page.path}  ←  ${[...inbound.get(page.path)!][0]}`);
  }
}

// Đích nội bộ nằm NGOÀI sitemap. Tải thử từng cái: 404 là link chết (lỗi
// thật, kèm tên trang đang trỏ), còn 200 nghĩa là có một trang sống mà sitemap
// không khai — cũng đáng nói, nhưng chỉ là nhắc.
const offSitemap = new Map<string, Set<string>>();
for (const page of pages) {
  for (const target of page.links) {
    if (known.has(target)) continue;
    if (!offSitemap.has(target)) offSitemap.set(target, new Set());
    offSitemap.get(target)!.add(page.path);
  }
}

// Tải song song đúng như vòng crawl. Tuần tự thì một sự cố mạng nhân với
// timeout 20 giây biến audit thành hàng chục phút, và một script chạy lâu như
// vậy thì không ai chạy nữa.
const targets = [...offSitemap.keys()].sort();
const probes = new Map<string, number>();
const probeQueue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (probeQueue.length) {
      const target = probeQueue.shift()!;
      try {
        probes.set(target, (await get(`${BASE}${target}`)).status);
      } catch {
        probes.set(target, 0);
      }
    }
  }),
);

for (const target of targets) {
  const status = probes.get(target) ?? 0;
  const from = [...offSitemap.get(target)!].sort();
  const shown =
    from.slice(0, 3).join(", ") +
    (from.length > 3 ? ` +${from.length - 3} trang nữa` : "");

  if (status === 200) {
    notes.push(
      `${target} — sống nhưng KHÔNG có trong sitemap (được trỏ từ: ${shown})`,
    );
  } else if (status >= 300 && status < 400) {
    // `get` dùng `redirect: "manual"`, nên redirect hiện ra nguyên hình thay vì
    // bị nuốt. Không phải link chết — người đọc vẫn tới nơi — nhưng là một
    // chặng thừa mà link nội bộ không nên có, nên chỉ nhắc chứ không làm đỏ.
    notes.push(
      `${target} — link nội bộ đi qua redirect ${status}, nên trỏ thẳng (từ: ${shown})`,
    );
  } else {
    problems.push(
      `${target} — link chết, HTTP ${status || "lỗi mạng"} (trỏ từ: ${shown})`,
    );
  }
}

const longDesc = pages.filter((p) => (p.description?.length ?? 0) > DESC_MAX);
const shortDesc = pages.filter(
  (p) => p.description && p.description.length < DESC_MIN,
);
const noDesc = pages.filter((p) => p.status === 200 && !p.description);

for (const page of noDesc)
  problems.push(`${page.path} — thiếu <meta name="description">`);
if (longDesc.length) {
  notes.push(
    `${longDesc.length} mô tả dài quá ${DESC_MAX} ký tự (Google sẽ cắt):`,
  );
  for (const p of longDesc)
    notes.push(`    ${p.description!.length} — ${p.path}`);
}
if (shortDesc.length) {
  notes.push(
    `${shortDesc.length} mô tả ngắn dưới ${DESC_MIN} ký tự (bỏ phí chỗ hiển thị)`,
  );
}

console.log(`Đã crawl ${pages.length} trang từ ${BASE}/sitemap.xml.`);
console.log();

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

console.log("Mạng link nội bộ: mọi trang đều có ít nhất một đường dẫn vào.");
