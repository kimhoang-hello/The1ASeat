// Ghi lại mỗi lần welcome bonus hay rebate của một thẻ đổi.
//
//   npm run record:offer-history
//
// Chạy hằng ngày bởi .github/workflows/offer-history.yml, và CHỈ ghi thêm khi
// có số đổi — nên file lịch sử là nhật ký thay đổi, không phải bản chép mỗi
// ngày một dòng. Sau một mùa, nó trả lời được câu hỏi mà site chưa bao giờ trả
// lời được: "70,000 điểm là mức cao hay mức thường của thẻ này?"
//
// Dữ liệu lấy qua `/api/offer-snapshot` chứ không đọc thẳng Contentful: runner
// của GitHub Actions không có token Contentful, chỉ có `EXPIRE_OFFERS_SECRET`.
// Server thì có, nên nó đọc hộ.

import fs from "node:fs";
import path from "node:path";
import type { OfferHistoryFile, OfferSnapshot } from "../src/lib/offer-history.ts";

const FILE = path.join(process.cwd(), "data/offer-history.json");
const SITE = process.env.SITE_URL ?? "https://ghe1a.com";
const SECRET = process.env.EXPIRE_OFFERS_SECRET;

if (!SECRET) {
  console.error("Thiếu EXPIRE_OFFERS_SECRET.");
  process.exit(1);
}

/**
 * Ba lượt, giãn dần — cùng lý do ba workflow kia gọi bằng `curl --retry 3
 * --retry-all-errors`. Job này chạy MỖI NGÀY MỘT LẦN và là chỗ duy nhất ghi
 * lịch sử, nên một lượt hỏng thoáng qua không chỉ là một lượt trượt: nếu con
 * số kịp đổi lần nữa trước lượt chạy sau, cái mức ở giữa mất vĩnh viễn, không
 * dựng lại được từ đâu cả.
 *
 * KHÔNG thử lại với 401: secret sai thì gọi thêm mười lượt cũng vậy, và đỏ
 * ngay là tín hiệu đúng.
 */
async function fetchSnapshot(): Promise<OfferSnapshot> {
  let last = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 30_000 * (attempt - 1)));

    try {
      const res = await fetch(`${SITE}/api/offer-snapshot`, {
        headers: {
          Authorization: `Bearer ${SECRET}`,
          // Cùng lý do với `.github/actions/call-site-endpoint`: mặc định của
          // runtime là thứ WAF của Hostinger chặn trước nhất, và một cú 403 từ
          // edge đọc giống hệt lỗi token nếu không ai nói ra. UA này nói thật
          // mình là ai thay vì giả làm trình duyệt.
          "User-Agent": "Ghe1A-Job/1.0 (+https://ghe1a.com; GitHub Actions)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(60_000),
      });

      if (res.ok) return (await res.json()) as OfferSnapshot;

      last = `${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (res.status === 401) break;
      console.error(`Lượt ${attempt} hỏng — ${last}`);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      console.error(`Lượt ${attempt} hỏng — ${last}`);
    }
  }

  // Thoát đỏ chứ không đọc thành "không có gì đổi": im lặng ở đây là mất hẳn
  // một mốc lịch sử, mà mốc đã mất thì không dựng lại được.
  console.error(`/api/offer-snapshot không gọi được sau 3 lượt — ${last}`);
  process.exit(1);
}

const snapshot = await fetchSnapshot();
if (!Array.isArray(snapshot.cards) || snapshot.cards.length === 0) {
  console.error("Snapshot không có thẻ nào — không ghi gì.");
  process.exit(1);
}

// Ngày theo giờ Toronto, cùng múi giờ mà mọi hạn offer trên site đang dùng.
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(
  new Date(snapshot.takenAt),
);

const history: OfferHistoryFile = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : { since: day, cards: {} };

const added: string[] = [];

for (const card of snapshot.cards) {
  const entries = history.cards[card.slug] ?? [];
  const last = entries[entries.length - 1];

  const changed =
    !last || last.welcomeBonus !== card.welcomeBonus || last.rebate !== card.rebate;
  if (!changed) continue;

  // Hai lần đổi trong cùng một ngày thì ghi đè dòng của ngày đó thay vì thêm
  // dòng thứ hai cùng ngày: mốc thời gian của lịch sử này là NGÀY, và hai dòng
  // trùng ngày làm mọi phép "đổi lần gần nhất" đọc ra hai kết quả khác nhau.
  const entry = { at: day, welcomeBonus: card.welcomeBonus, rebate: card.rebate };
  if (last?.at === day) entries[entries.length - 1] = entry;
  else entries.push(entry);

  history.cards[card.slug] = entries;
  added.push(
    `${card.slug}: ${last ? `${last.welcomeBonus ?? "—"} / ${last.rebate ?? "—"} → ` : "lần đầu ghi nhận "}` +
      `${card.welcomeBonus ?? "—"} / ${card.rebate ?? "—"}`,
  );
}

// Thẻ biến mất khỏi site KHÔNG bị xoá khỏi lịch sử. Nó có thể chỉ đang được
// unpublish tạm, và lịch sử đã xoá thì không dựng lại được.

if (added.length === 0) {
  console.log(`Không có số nào đổi (${snapshot.cards.length} thẻ, ngày ${day}).`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(FILE), { recursive: true });
fs.writeFileSync(FILE, `${JSON.stringify(history, null, 2)}\n`);
console.log(`Ghi ${added.length} thay đổi (ngày ${day}):`);
for (const line of added) console.log(`  · ${line}`);
