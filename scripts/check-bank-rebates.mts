// Giữ cho số rebate của tài khoản ngân hàng khớp với FinlyWealth.
//
//   npm run audit:rebates        chỉ báo, không sửa (exit 1 nếu có sai lệch)
//   npm run audit:rebates -- --fix   sửa thẳng vào src/lib/bank-accounts.ts
//
// VÌ SAO CẦN RIÊNG MỘT SCRIPT: thẻ tín dụng đã có job `check-rebates` chạy
// hai lượt mỗi ngày, nhưng job đó chỉ đi qua `creditCardOffer` trong
// Contentful. Rebate tài khoản ngân hàng nằm trong một file TypeScript trong
// repo, mà một route đang chạy thì không sửa được file nguồn — nên suốt thời
// gian qua chưa có gì canh chừng chúng cả. Ngày 19/08/2026 phát hiện
// Scotiabank® Preferred Package vẫn ghi $100 trong khi FinlyWealth đã hạ xuống
// $75 từ lúc nào không biết; hứa dư $25 với người đọc còn tệ hơn là không ghi
// số nào.
//
// Script cũng kiểm luôn chuyện thứ hai, chuyện đã làm mất tiền thật: một tài
// khoản trỏ vào trang `/banking/...` trong khi bản `/rebates/bank-accounts/`
// cùng slug vẫn tồn tại và vẫn trả tiền. Nhìn vào file thì không thấy được —
// thiếu `rebate` trông y hệt "sản phẩm này không có rebate".

import fs from "node:fs";
import path from "node:path";
import { BANK_ACCOUNTS } from "../src/lib/bank-accounts.ts";
import {
  FinlyOfferIndex,
  affiliateDestinationPath,
  fetchFinlyOffers,
  type PageLookup,
} from "../src/lib/finly-api.ts";

const FILE = path.join(process.cwd(), "src/lib/bank-accounts.ts");
const fix = process.argv.includes("--fix");

const apiKey = process.env.FINLY_API_KEY;
if (!apiKey) {
  console.error(
    "Thiếu biến môi trường FINLY_API_KEY (key FinlyWealth Affiliate API, scope `offers`)." +
      " Chạy trên máy thì thêm vào .env.local rồi `node --env-file=.env.local …`," +
      " hoặc export trước khi chạy.",
  );
  process.exit(1);
}

type Finding =
  | { kind: "stale"; slug: string; stored: string; live: string }
  | { kind: "missing-link"; slug: string; live: string; rebateSlug: string }
  /** Offer còn trong chương trình nhưng Finly đã tắt hoặc pause rebate. */
  | { kind: "gone"; slug: string; stored: string };

const findings: Finding[] = [];
const errors: string[] = [];
/**
 * Tài khoản mà link apply trỏ vào một trang Finly API không liệt kê.
 *
 * Thay cho danh sách "link chết (404)" trước 29/10/2026. Theo tài liệu của
 * Finly, offer vắng khỏi lượt sync là offer không còn promote được: click qua
 * link đó có thể không được ghi công, và trang đích có thể đã bị gỡ. Không
 * script nào biết nên đổi link sang đâu, nên nó đỏ ở MỌI lượt cho tới khi có
 * người sửa `affiliateUrl` — cùng lý do nhánh link chết cũ không tự rửa mình
 * thành xanh (KOHO Essential Plan, 25/09/2026).
 */
const unlisted: string[] = [];
let checked = 0;

let finly: FinlyOfferIndex;
try {
  finly = new FinlyOfferIndex(await fetchFinlyOffers(apiKey));
} catch (err) {
  // Không đọc được API thì không so được tài khoản nào. Đỏ ngay, và tuyệt đối
  // không đi tiếp tới `--fix`: một lượt đọc hỏng không được thành lệnh xoá số.
  console.error(`không đọc được FinlyWealth API: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

for (const account of BANK_ACCOUNTS) {
  const dest = affiliateDestinationPath(account.affiliateUrl);
  if (!dest) continue;
  checked += 1;

  let found: PageLookup;
  try {
    found = finly.lookup(dest);
  } catch (err) {
    errors.push(`${account.slug}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }

  if (found.kind === "amount") {
    if (account.rebate !== found.rebate) {
      findings.push({ kind: "stale", slug: account.slug, stored: account.rebate ?? "(chưa có)", live: found.rebate });
    }
  } else if (found.kind === "paused") {
    // `--fix` xoá dòng `rebate:` theo tín hiệu này. Đúng ở đây, khác bên thẻ:
    // câu HOT TIP của tài khoản ngân hàng SINH RA từ chính trường `rebate`,
    // nên xoá số là câu hứa tiền cũng biến theo.
    if (account.rebate) findings.push({ kind: "gone", slug: account.slug, stored: account.rebate });
  } else if (found.kind === "product") {
    // Đang dùng link trang sản phẩm (`/banking/…`) — nếu offer có rebate thì
    // đây là tiền đang bỏ lại trên bàn. Chỉ nhắc, xem ghi chú ở dưới.
    if (found.twinRebate) {
      findings.push({ kind: "missing-link", slug: account.slug, live: found.twinRebate, rebateSlug: found.offer.slug });
    }
    // Ngược lại thì là lỗi thật: site hứa một con số mà người bấm link này
    // không nhận được, vì link không dẫn qua trang rebate.
    if (account.rebate) {
      errors.push(
        `${account.slug}: site đang ghi ${account.rebate} nhưng link apply trỏ trang sản phẩm ${dest},` +
          " không phải trang rebate — gỡ `rebate:` hoặc sửa link",
      );
    }
  } else {
    unlisted.push(account.slug);
  }
}

console.log(`đã kiểm ${checked} tài khoản có link FinlyWealth\n`);

if (errors.length) {
  console.log(`${errors.length} chuyện cần người nhìn vào:`);
  for (const e of errors) console.log("  ·", e);
  console.log();
}

if (unlisted.length) {
  console.log(`${unlisted.length} tài khoản có link apply trỏ vào trang mà FinlyWealth API không liệt kê:`);
  for (const slug of unlisted) console.log("  ·", slug);
  console.log(
    "  Offer đã ngừng, đang pause, hoặc rời chương trình affiliate: click có thể không được" +
      " ghi công và trang có thể đã bị gỡ. Mở trang kiểm tay rồi đổi `affiliateUrl` trong" +
      " src/lib/bank-accounts.ts, kèm gỡ `rebate:` và câu nhắc rebate FinlyWealth trong" +
      " `bonusConditionsVi` nếu có.\n",
  );
}

// Chỉ con số lệch mới là lỗi. Chuyện một tài khoản dùng link `/banking/`
// trong khi bản `/rebates/` có tiền là lựa chọn của tác giả — đã cân nhắc và
// giữ nguyên ngày 19/08/2026 — nên nó in ra để nhắc chứ không làm job đỏ. Nếu
// nó tính là lỗi thì job đỏ mãi mãi, và một con số lệch thật sẽ chìm nghỉm
// giữa mười dòng nhắc mà không ai còn đọc nữa.
const drift = findings.filter((f) => f.kind === "stale" || f.kind === "gone");
const linkNotes = findings.filter((f) => f.kind === "missing-link");

for (const f of drift) {
  if (f.kind === "stale") console.log(`  LỆCH  ${f.slug}: ${f.stored} -> ${f.live}`);
  if (f.kind === "gone") {
    console.log(`  LỆCH  ${f.slug}: đang ghi ${f.stored} nhưng Finly API nói hiện không có rebate (tắt hoặc pause)`);
  }
}

/**
 * Sửa dòng `rebate:` CỦA RIÊNG một tài khoản. Trả `null` nếu không có dòng nào
 * để sửa trong khối của chính nó.
 *
 * Bản cũ dùng một regex `(slug: "X",[\s\S]*?)rebate: "[^"]*",\n` — không có gì
 * giữ phép lười lại trong khối của tài khoản đang sửa. Tài khoản A không có
 * dòng `rebate:` thì nó đi tiếp qua dấu `},` và ăn dòng `rebate:` của tài
 * khoản B ngay dưới: đã dựng lại và tái hiện được ngày 31/08/2026 — con số mới
 * của A bị ghi lên B, còn A vẫn trống. Mà "A không có dòng rebate" chính là
 * thứ nhánh `gone` tạo ra ở lượt chạy trước.
 *
 * CẮT CHUỖI, KHÔNG DÙNG REGEX CÓ RÀO. Bản vá đầu dùng `(?:(?!\n  \},)[\s\S])*?`
 * để chặn ở dấu đóng khối — chạy đúng, nhưng cái rào ấy phụ thuộc vào việc file
 * thụt đúng hai dấu cách. Đổi sang thụt bốn, sang tab, hay viết
 * `} satisfies BankAccount,` là rào biến mất trong im lặng và lỗi cũ quay lại
 * y nguyên. Ranh giới đáng tin hơn là `slug: "` của tài khoản KẾ TIẾP: nó
 * không phụ thuộc định dạng, và trong file này `slug: "` chỉ xuất hiện trong
 * các khối tài khoản.
 */
// Ăn cả phần thụt lề đứng trước: xoá dòng mà để lại thụt lề thì nó dính vào
// dấu `},` ngay dưới (`      },`) — lần `gone` thật đầu tiên, 29/10/2026.
const REBATE_LINE = /([ \t]*)rebate: "[^"]*",\n/;

function replaceRebateLine(source: string, slug: string, line: string | null): string | null {
  const start = source.indexOf(`slug: "${slug}",`);
  if (start === -1) return null;

  const nextSlug = source.indexOf('slug: "', start + 1);
  const end = nextSlug === -1 ? source.length : nextSlug;
  const block = source.slice(start, end);
  if (!REBATE_LINE.test(block)) return null;

  // `line` đi qua dạng HÀM, không phải chuỗi thay thế: xem chú thích ở chỗ gọi.
  return (
    source.slice(0, start) +
    block.replace(REBATE_LINE, (_match, indent: string) => (line === null ? "" : indent + line)) +
    source.slice(end)
  );
}

if (drift.length && fix) {
  let source = fs.readFileSync(FILE, "utf8");
  // Bản vá không bám được vào đâu. Ca thật: tài khoản có `rebate` mới xuất
  // hiện trên FinlyWealth nhưng trong file chưa có dòng `rebate:` nào để thay.
  // Trước đây `replace` lặng lẽ không đổi gì mà `--fix` vẫn thoát 0, nên job
  // xanh trong khi con số vẫn lệch — đúng kiểu lỗi tự rửa mình mà AGENTS.md
  // nói phải tránh. Chèn một property mới vào giữa object là việc cần người
  // quyết (đặt ở đâu, có kèm comment lý do không), nên ở đây báo chứ không tự
  // đoán.
  const unfixed: typeof drift = [];

  for (const f of drift) {
    // Chuỗi mới đi qua dạng HÀM trong `replaceRebateLine`, không phải chuỗi
    // thay thế. Trong chuỗi thay thế của `String.replace`, `$` là ký tự điều
    // khiển — và con số rebate LUÔN bắt đầu bằng `$`. Bản cũ ghép
    // `$1rebate: "${f.live}",` nên với `f.live = "$100"` nó được đọc là: nhóm
    // 1, chữ `rebate: "`, rồi `$10` (không có nhóm 10 nên lùi về) → NHÓM 1
    // MỘT LẦN NỮA, rồi `00`. Cả đoạn đã khớp bị nhét vào giữa một string
    // literal, file thành TypeScript hỏng, và workflow commit nó vào main.
    //
    // Không phải ca lý thuyết: `$100` là số đang chạy của KOHO Everything
    // Plan, `$125` là số cũ của BMO®, và `$150`/`$1,000` cùng hình dạng. Nó
    // chưa nổ chỉ vì `--fix` chưa lần nào phải ghi một số bắt đầu bằng `$1`.
    const next = replaceRebateLine(source, f.slug, f.kind === "stale" ? `rebate: "${f.live}",\n` : null);
    if (next === null) {
      unfixed.push(f);
      continue;
    }
    source = next;
  }

  fs.writeFileSync(FILE, source);
  console.log(`\nđã sửa ${drift.length - unfixed.length} con số trong src/lib/bank-accounts.ts`);

  for (const f of unfixed) {
    errors.push(
      `${f.slug}: không tìm thấy dòng \`rebate:\` nào trong khối của tài khoản này để sửa` +
        (f.kind === "stale" ? ` — thêm tay \`rebate: "${f.live}",\`` : ""),
    );
  }
  if (unfixed.length) {
    console.log(`\n${unfixed.length} tài khoản KHÔNG sửa được tự động:`);
    for (const f of unfixed) console.log("  ·", f.slug);
  }
} else if (drift.length) {
  console.log(`\nchạy \`npm run audit:rebates -- --fix\` để sửa ${drift.length} con số.`);
} else {
  console.log("Mọi số rebate đều khớp với FinlyWealth.");
}

if (linkNotes.length) {
  console.log(
    `\nNhắc (không phải lỗi): ${linkNotes.length} tài khoản đang dùng link /banking/` +
      ` trong khi bản /rebates/ cùng slug có trả tiền. Đây là link tác giả chọn,` +
      ` script không đổi. Muốn đổi thì sửa tay trong src/lib/bank-accounts.ts.`,
  );
  for (const f of linkNotes) console.log(`  ·  ${f.slug} — offer ${f.rebateSlug} trả ${f.live} qua trang rebate`);
}

// Ở chế độ `--fix` thì lệch không phải là thất bại: nó vừa được sửa xong, và
// commit mới là thứ báo cho người biết. Chỉ chế độ báo cáo mới coi lệch là lỗi,
// để CI đỏ đúng lúc cần người nhìn vào.
//
// Lỗi và trang không có trong API thì lúc nào cũng đỏ: im lặng bỏ qua thì một
// link chết sẽ làm job xanh y như lúc mọi thứ đều đúng.
process.exit((!fix && drift.length) || errors.length || unlisted.length ? 1 : 0);
