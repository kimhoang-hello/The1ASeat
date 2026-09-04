// Giữ cho số rebate của tài khoản ngân hàng khớp với FinlyWealth.
//
//   npm run audit:rebates        chỉ báo, không sửa (exit 1 nếu có sai lệch)
//   npm run audit:rebates -- --fix   sửa thẳng vào src/lib/bank-accounts.ts
//
// VÌ SAO CẦN RIÊNG MỘT SCRIPT: thẻ tín dụng đã có `/api/check-rebates` chạy
// hai lượt mỗi ngày, nhưng route đó chỉ đi qua `creditCardOffer` trong
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

const FILE = path.join(process.cwd(), "src/lib/bank-accounts.ts");
const fix = process.argv.includes("--fix");

const REBATE_BASE = "https://www.finlywealth.com/rebates/bank-accounts/";

/** Slug cuối cùng của đường dẫn đích, dù là link `/rebates/` hay `/banking/`. */
function destinationSlug(affiliateUrl: string): string | null {
  const dest = new URL(affiliateUrl).searchParams.get("url");
  if (!dest) return null;
  return dest.replace(/\/$/, "").split("/").pop() ?? null;
}

/**
 * Số tiền trên trang rebate, hoặc null nếu trang thật sự không còn.
 *
 * Đọc <title> chứ không đọc phần thân, đúng lý do đã ghi trong
 * `src/lib/finlywealth.ts`: phần thân còn giữ cả mức cũ đã gạch ngang
 * ("Get $75$100 rebate"), chỉ tiêu đề mới có đúng một con số.
 *
 * NÉM chứ không trả `null` ở mọi thứ không nhận ra được, vì `null` ở đây KHÔNG
 * phải "không đọc được" — nó là tín hiệu `gone`, và `--fix` xoá dòng `rebate:`
 * theo tín hiệu đó rồi commit thẳng vào main (xem check-bank-rebates.yml). Một
 * lần đọc hỏng mà trả `null` là tự tay xoá một con số tiền đang đúng.
 *
 * Ba cửa, theo đúng thứ tự đó:
 *
 * 1. `!res.ok` — trước đây status code bị bỏ qua HOÀN TOÀN, với lý do "trang
 *    không tồn tại trả 200 kèm tiêu đề Not Found nên không tin được status".
 *    Vế đó đúng, nhưng kết luận thì quá tay: 200 không chứng minh được trang
 *    còn sống, mà 503 thì chứng minh được là KHÔNG đọc được. Một trang lỗi
 *    5xx của CDN có `<title>Service Unavailable</title>` — không khớp "not
 *    found", không khớp regex tiền — nên trước đây rơi thẳng vào `gone`.
 *
 * 2. Tiêu đề rỗng. Đây không phải ca lý thuyết: đo ngày 31/08/2026, trang
 *    `koho-everything-plan` trả 200 với `<title></title>` ở 1 trong 7 lượt
 *    gọi liên tiếp, sáu lượt còn lại trả đúng "$100 …". Dòng `if (!title)
 *    return null` cũ biến đúng cú nấc đó thành lệnh xoá rebate.
 *
 * 3. Tiêu đề có chữ nhưng không phải trang rebate của FinlyWealth (không khớp
 *    "Not Found" và cũng không kết thúc bằng "Rebate from FinlyWealth") —
 *    trang chặn bot, trang interstitial, trang đăng nhập. Không biết là gì thì
 *    không được coi là dữ liệu.
 *
 * Trả về BA thứ khác nhau, không gộp thành `string | null` như trước, vì
 * "không có số" có hai nghĩa và chỉ một nghĩa được phép xoá dòng `rebate:`:
 *
 * - `"gone"` — tiêu đề "Not Found": sản phẩm rebate đã bị gỡ. Xoá là đúng.
 * - `"no-amount"` — trang rebate còn sống nhưng FinlyWealth chưa điền số,
 *   tiêu đề bắt đầu bằng "null" (EQ Bank™ Personal Account). KHÔNG phải
 *   `gone`: rebate không biến mất, chỉ là chưa hiện. Gộp hai cái này lại là
 *   một ngày FinlyWealth dựng lại trang thì site tự xoá con số đang đúng.
 * - một chuỗi `"$75"` — đọc được số.
 *
 * Mọi tiêu đề CÓ CHỮ nhưng không rơi vào ba nhóm trên đều ném. Trước đây điều
 * kiện là "không khớp regex số thì coi như không có số", nên một tiêu đề hợp
 * lệ kiểu "Up to $75 … Rebate from FinlyWealth" (không mở đầu bằng `$`) cũng
 * lặng lẽ thành `gone`.
 *
 * KHÔNG BẮT ĐƯỢC, ghi ra để không ai tưởng hàm này mạnh hơn thực tế: rebate bị
 * PAUSE mà FinlyWealth vẫn giữ con số cũ trong `<title>`. Trang Wealthsimple
 * Chequing ngày 31/08/2026 là đúng hình dạng đó — tiêu đề "$25 … Rebate from
 * FinlyWealth" trong khi thân trang nói đã pause. Đọc tiêu đề thì không có
 * cách nào thấy; mà đọc thân trang thì vấp đúng lý do khiến `finlywealth.ts`
 * chọn tiêu đề ngay từ đầu (thân trang giữ cả mức cũ đã gạch ngang). Đây là
 * giới hạn có sẵn của cách đọc này, không phải thứ ba trạng thái dưới đây
 * chữa được.
 */
type RebateReading = string | "gone" | "no-amount";

const FINLY_TITLE = /Rebate from FinlyWealth/i;

/**
 * Thử lại cho TỪNG trang, vì một lượt chạy quét 29 URL tuần tự vào cùng một
 * host. Từ khi `fetchRebate` ném ở nhiều nhánh hơn, chỉ cần MỘT trang chạm
 * rate-limit là cả lượt chạy đỏ — và nếu Finly siết quota xuống dưới 29 thì nó
 * đỏ mọi lượt, mà từ 04/09/2026 mỗi ngày có hai lượt chứ không còn một, tức
 * gấp đôi áp lực quota. Thử lại đúng vào chỗ hỏng thì rẻ hơn nhiều so với nới
 * lỏng cửa an toàn, vì hết lượt thử vẫn ném và một trang hỏng dai vẫn hiện ra.
 */
const ATTEMPTS = 3;

async function fetchRebate(slug: string): Promise<RebateReading> {
  let res: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    try {
      res = await fetch(REBATE_BASE + slug, {
        headers: { "User-Agent": "Ghe1A-RebateCheck/1.0 (+https://ghe1a.com)" },
        signal: AbortSignal.timeout(15_000),
      });
      // 404/403 là câu trả lời dứt khoát về chính URL này; thử lại vô ích.
      if (res.ok || (res.status < 500 && res.status !== 429)) break;
      lastError = new Error(`${REBATE_BASE}${slug} trả ${res.status} ${res.statusText}`);
      res = undefined;
    } catch (err) {
      lastError = err;
      res = undefined;
    }
  }

  if (!res) {
    throw new Error(
      `${REBATE_BASE}${slug} hỏng sau ${ATTEMPTS} lượt: ` +
        (lastError instanceof Error ? lastError.message : String(lastError)),
    );
  }
  if (!res.ok) throw new Error(`${REBATE_BASE}${slug} trả ${res.status} ${res.statusText}`);

  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  if (!title) throw new Error(`${REBATE_BASE}${slug} trả 200 nhưng <title> rỗng`);

  if (/^not found/i.test(title)) return "gone";

  // Khớp ở BẤT KỲ đâu trong tiêu đề, không neo cuối chuỗi. Neo `\s*$` như bản
  // đầu thì một ngày FinlyWealth thêm hậu tố SEO ("… Rebate from FinlyWealth
  // | Bank Accounts") là script ném cho tất cả 29 tài khoản và không lượt chạy
  // nào tự khỏi. Cụm giữa tiêu đề đã đủ nhận diện trang của họ.
  if (!FINLY_TITLE.test(title)) {
    throw new Error(`${REBATE_BASE}${slug} trả một tiêu đề lạ: ${title.slice(0, 80)}`);
  }

  const amount = title.match(/\$([\d,]+)\s+.*Rebate from FinlyWealth/i)?.[1];
  if (amount) return `$${amount}`;
  if (/^null\b/i.test(title)) return "no-amount";

  throw new Error(`${REBATE_BASE}${slug}: trang FinlyWealth nhưng không đọc ra số: ${title.slice(0, 80)}`);
}

type Finding =
  | { kind: "stale"; slug: string; stored: string; live: string }
  | { kind: "missing-link"; slug: string; live: string; rebateSlug: string }
  | { kind: "gone"; slug: string; stored: string };

const findings: Finding[] = [];
const errors: string[] = [];
let checked = 0;

for (const account of BANK_ACCOUNTS) {
  if (!account.affiliateUrl) continue;
  const rebateSlug = destinationSlug(account.affiliateUrl);
  if (!rebateSlug) continue;

  checked += 1;
  let live: RebateReading;
  try {
    live = await fetchRebate(rebateSlug);
  } catch (err) {
    errors.push(`${account.slug}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }

  const onRebateLink = account.affiliateUrl.includes("%2Frebates%2F");

  if (!onRebateLink) {
    // Đang dùng link `/banking/` — nếu bản `/rebates/` cùng slug có tiền thì
    // đây là tiền đang bỏ lại trên bàn.
    if (live !== "gone" && live !== "no-amount") {
      findings.push({ kind: "missing-link", slug: account.slug, live, rebateSlug });
    }
    continue;
  }

  if (live === "gone") {
    if (account.rebate) findings.push({ kind: "gone", slug: account.slug, stored: account.rebate });
    continue;
  }

  // Trang còn sống nhưng chưa điền số: không xoá gì cả. Chỉ báo khi site đang
  // ghi một con số, vì lúc đó hai bên đã lệch và cần người nhìn.
  if (live === "no-amount") {
    if (account.rebate) {
      errors.push(
        `${account.slug}: site đang ghi ${account.rebate} nhưng trang rebate còn sống mà chưa hiện số` +
          ` — kiểm tay, script không tự xoá`,
      );
    }
    continue;
  }

  if (account.rebate !== live) {
    findings.push({ kind: "stale", slug: account.slug, stored: account.rebate ?? "(chưa có)", live });
  }
}

console.log(`đã kiểm ${checked} tài khoản có link FinlyWealth\n`);

if (errors.length) {
  console.log(`không đọc được ${errors.length} trang:`);
  for (const e of errors) console.log("  ·", e);
  console.log();
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
  if (f.kind === "gone") console.log(`  LỆCH  ${f.slug}: đang ghi ${f.stored} nhưng trang rebate không còn`);
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
const REBATE_LINE = /rebate: "[^"]*",\n/;

function replaceRebateLine(source: string, slug: string, line: string | null): string | null {
  const start = source.indexOf(`slug: "${slug}",`);
  if (start === -1) return null;

  const nextSlug = source.indexOf('slug: "', start + 1);
  const end = nextSlug === -1 ? source.length : nextSlug;
  const block = source.slice(start, end);
  if (!REBATE_LINE.test(block)) return null;

  // `line` đi qua dạng HÀM, không phải chuỗi thay thế: xem chú thích ở chỗ gọi.
  return source.slice(0, start) + block.replace(REBATE_LINE, () => line ?? "") + source.slice(end);
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
  for (const f of linkNotes) console.log(`  ·  ${f.slug} — /rebates/${f.rebateSlug} trả ${f.live}`);
}

// Ở chế độ `--fix` thì lệch không phải là thất bại: nó vừa được sửa xong, và
// commit mới là thứ báo cho người biết. Chỉ chế độ báo cáo mới coi lệch là lỗi,
// để CI đỏ đúng lúc cần người nhìn vào.
//
// Không đọc được trang thì lúc nào cũng là lỗi: im lặng bỏ qua thì một trang
// chết sẽ làm job xanh y như lúc mọi thứ đều đúng.
process.exit((!fix && drift.length) || errors.length ? 1 : 0);
