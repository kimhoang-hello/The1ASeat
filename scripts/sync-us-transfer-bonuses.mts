// Đồng bộ transfer bonus MỸ từ Daily Drop vào `data/us-transfer-bonuses.json`.
//
//   npm run sync:us-transfer-bonuses            # đọc Daily Drop, ghi file
//   npm run sync:us-transfer-bonuses -- --dry   # chỉ in, không ghi
//
// Chạy mỗi tuần bởi .github/workflows/sync-us-transfer-bonuses.yml, job commit
// file nếu nó đổi. Nguồn do tác giả chọn ngày 06/11/2026:
// dailydrop.com/transfer-partners-cheat-sheet#current-offers.
//
// Job SỬA THẲNG dữ liệu (khác `audit:us-offers` chỉ báo): mỗi dòng là bốn ô số
// liệu, không có câu chữ viết tay nào đi kèm phải sửa theo.
//
// Mã thoát:
//   0 — ghi xong (hoặc không có gì đổi).
//   1 — không đọc được Daily Drop / trang đổi cấu trúc. KHÔNG ghi gì: ghi một
//       nửa là xoá im lặng những bonus đang chạy khỏi site.
//   2 — ghi xong, NHƯNG có tên chương trình site chưa hiểu (`usBonusGaps` kiểu
//       `partner`). Bonus đó vẫn hiện bằng chữ thô; job đỏ để người thêm alias.
import fs from "node:fs";
import path from "node:path";
import { parseDailyDropBonuses, type DailyDropBonus } from "../src/lib/daily-drop-bonuses.ts";
import { usBonusGaps } from "../src/lib/us-transfer-bonuses.ts";

const SOURCE = "https://www.dailydrop.com/transfer-partners-cheat-sheet#current-offers";
const FILE = path.join(import.meta.dirname, "..", "data", "us-transfer-bonuses.json");
const DRY = process.argv.includes("--dry");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type UsBonusFile = { source: string; checkedOn: string; bonuses: DailyDropBonus[] };

function todayToronto(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

async function fetchPage(url: string): Promise<string> {
  let lastError: unknown;
  // Ba lượt, cách 20 giây: runner GitHub đôi khi nấc mạng, còn lỗi 4xx thì
  // chạy lại cũng y hệt nên dừng luôn.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw Object.assign(new Error(`${res.status} ${res.statusText}`), { permanent: true });
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if ((err as { permanent?: boolean }).permanent || attempt === 3) break;
      console.warn(`Lượt ${attempt} lỗi (${(err as Error).message}), thử lại sau 20 giây…`);
      await new Promise((resolve) => setTimeout(resolve, 20_000));
    }
  }
  throw lastError;
}

const key = (b: DailyDropBonus) => `${b.from} → ${b.to}`;
const describe = (b: DailyDropBonus) => `${key(b)} +${b.bonusPercent}% (hết ${b.expiresOn})`;

function diff(before: DailyDropBonus[], after: DailyDropBonus[]): string[] {
  const lines: string[] = [];
  const old = new Map(before.map((b) => [key(b), b]));
  const now = new Map(after.map((b) => [key(b), b]));
  for (const [k, b] of now) {
    const prev = old.get(k);
    if (!prev) lines.push(`+ ${describe(b)}`);
    else if (prev.bonusPercent !== b.bonusPercent || prev.expiresOn !== b.expiresOn) {
      lines.push(`~ ${describe(prev)}  →  +${b.bonusPercent}% (hết ${b.expiresOn})`);
    }
  }
  for (const [k, b] of old) if (!now.has(k)) lines.push(`- ${describe(b)}`);
  return lines;
}

function summary(markdown: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) fs.appendFileSync(file, `${markdown}\n`);
}

const html = await fetchPage(SOURCE.split("#")[0]);
const bonuses = parseDailyDropBonuses(html);

const previous: UsBonusFile | null = fs.existsSync(FILE)
  ? (JSON.parse(fs.readFileSync(FILE, "utf8")) as UsBonusFile)
  : null;
const changes = diff(previous?.bonuses ?? [], bonuses);

console.log(`Daily Drop: ${bonuses.length} bonus.`);
for (const b of bonuses) console.log(`  ${describe(b)}`);
console.log(changes.length ? `\nThay đổi so với lần trước:\n${changes.join("\n")}` : "\nKhông có bonus nào đổi.");

const gaps = usBonusGaps(bonuses);
const GAP_LABEL = {
  issuer: "hệ điểm ngoài sáu ngân hàng của bảng Mỹ — bỏ qua",
  partner: "chương trình nhận chưa khớp hàng nào — hiện bằng chữ thô, thêm vào PARTNER_ALIASES",
  leg: "bảng /transfer-partners#my chưa có ô này — nên đối chiếu lại bảng",
} as const;
for (const gap of gaps) {
  const message = `${describe(gap.item)}: ${GAP_LABEL[gap.kind]}`;
  // `::warning::` hiện thành chú thích vàng trên trang của lượt chạy GitHub.
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `⚠︎ ${message}`);
}

summary(
  [
    `### Transfer bonus Mỹ — ${bonuses.length} bonus từ Daily Drop`,
    "",
    changes.length ? ["Thay đổi:", "", ...changes.map((l) => `- \`${l}\``)].join("\n") : "Không có bonus nào đổi.",
    gaps.length ? ["", "Cần xem:", "", ...gaps.map((g) => `- ${describe(g.item)}: ${GAP_LABEL[g.kind]}`)].join("\n") : "",
  ].join("\n"),
);

if (!DRY) {
  const next: UsBonusFile = { source: SOURCE, checkedOn: todayToronto(), bonuses };
  fs.writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nĐã ghi ${path.relative(process.cwd(), FILE)}.`);
}

if (gaps.some((gap) => gap.kind === "partner")) process.exit(2);
