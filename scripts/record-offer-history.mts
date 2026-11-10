// Ghi lại mỗi lần welcome bonus hay rebate của một thẻ đổi.
//
//   npm run record:offer-history
//
// Chạy hằng ngày bởi .github/workflows/offer-history.yml, và CHỈ ghi thêm khi
// có số đổi — nên file lịch sử là nhật ký thay đổi, không phải bản chép mỗi
// ngày một dòng. Sau một mùa, nó trả lời được câu hỏi mà site chưa bao giờ trả
// lời được: "70,000 điểm là mức cao hay mức thường của thẻ này?"
//
// Đọc thẳng Contentful qua CDA — bản ĐÃ PUBLISH, tức thứ người đọc đã thấy,
// không phải bản nháp tác giả đang viết dở. Trước 09/11/2026 script gọi vòng
// qua `/api/offer-snapshot` trên ghe1a.com vì runner khi đó không có token
// Contentful; từ 09/09/2026 token CDA đã nằm trong environment
// `contentful-write` (cho `check-rebates`), nên đường vòng — và rủi ro edge
// Hostinger chặn IP runner đi kèm nó — không còn lý do tồn tại.

import fs from "node:fs";
import path from "node:path";
import { fetchContentfulCreditCardOffers } from "../src/lib/content/contentful.ts";
import type { OfferHistoryFile } from "../src/lib/offer-history.ts";

const FILE = path.join(process.cwd(), "data/offer-history.json");

// Thiếu biến thì đỏ NGAY với đúng tên biến — không thì lỗi hiện ra như một
// câu về Contentful, đọc giống hệt "Contentful đang hỏng".
const missing = ["CONTENTFUL_SPACE_ID", "CONTENTFUL_ACCESS_TOKEN"].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Thiếu biến môi trường: ${missing.join(", ")}`);
  process.exit(1);
}

// Lịch sử chỉ được ghi từ bản ĐÃ PUBLISH. `CONTENTFUL_HOST` là công tắc cho
// tác giả xem bản nháp ở máy (`preview.contentful.com`, xem
// `src/lib/content/contentful.ts`); lệnh này nạp `.env.local`, nên chạy tay
// trên một máy đang bật công tắc đó là ghi offer CHƯA TỪNG publish vào nhật ký
// mà engine gợi ý thẻ đọc lại. Đường cũ qua server production không có cửa
// này (Codex, 10/11/2026). Có biến đó thì từ chối, bất kể giá trị.
if (process.env.CONTENTFUL_HOST) {
  console.error(
    `CONTENTFUL_HOST đang đặt (${process.env.CONTENTFUL_HOST}) — lịch sử offer chỉ ghi từ CDA mặc định. Bỏ biến đó rồi chạy lại.`,
  );
  process.exit(1);
}

// Lỗi mạng thoáng qua do SDK Contentful tự thử lại. Còn hỏng thì ném và job
// đỏ, chứ không đọc thành "không có gì đổi": im lặng ở đây là mất hẳn một mốc
// lịch sử, mà mốc đã mất thì không dựng lại được.
const cards = (await fetchContentfulCreditCardOffers())
  .map((offer) => ({
    slug: offer.slug,
    welcomeBonus: offer.welcomeBonus,
    rebate: offer.rebate,
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

// Danh sách rỗng gần như chắc chắn là Contentful lỗi chứ không phải site thật
// sự hết thẻ. Ghi nó vào lịch sử là ghi đè một ngày trống lên dữ liệu thật.
if (cards.length === 0) {
  console.error("Contentful không trả thẻ nào — không ghi gì.");
  process.exit(1);
}

// Ngày theo giờ Toronto, cùng múi giờ mà mọi hạn offer trên site đang dùng.
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

const history: OfferHistoryFile = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : { since: day, cards: {} };

const added: string[] = [];

for (const card of cards) {
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
  console.log(`Không có số nào đổi (${cards.length} thẻ, ngày ${day}).`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(FILE), { recursive: true });
fs.writeFileSync(FILE, `${JSON.stringify(history, null, 2)}\n`);
console.log(`Ghi ${added.length} thay đổi (ngày ${day}):`);
for (const line of added) console.log(`  · ${line}`);
