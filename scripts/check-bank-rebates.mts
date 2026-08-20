// Giữ cho số rebate của tài khoản ngân hàng khớp với FinlyWealth.
//
//   npm run audit:rebates        chỉ báo, không sửa (exit 1 nếu có sai lệch)
//   npm run audit:rebates -- --fix   sửa thẳng vào src/lib/bank-accounts.ts
//
// VÌ SAO CẦN RIÊNG MỘT SCRIPT: thẻ tín dụng đã có `/api/check-rebates` chạy
// hằng ngày, nhưng route đó chỉ đi qua `creditCardOffer` trong Contentful.
// Rebate tài khoản ngân hàng nằm trong một file TypeScript trong repo, mà một
// route đang chạy thì không sửa được file nguồn — nên suốt thời gian qua chưa
// có gì canh chừng chúng cả. Ngày 19/08/2026 phát hiện Scotiabank® Preferred
// Package vẫn ghi $100 trong khi FinlyWealth đã hạ xuống $75 từ lúc nào không
// biết; hứa dư $25 với người đọc còn tệ hơn là không ghi số nào.
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
 * Số tiền trên trang rebate, hoặc null nếu trang không tồn tại.
 *
 * Đọc <title> chứ không đọc phần thân, đúng lý do đã ghi trong
 * `src/lib/finlywealth.ts`: phần thân còn giữ cả mức cũ đã gạch ngang
 * ("Get $75$100 rebate"), chỉ tiêu đề mới có đúng một con số.
 *
 * Trang không tồn tại trả về tiêu đề "Not Found" kèm HTTP 200, nên không thể
 * tin vào status code. Có trang trả tiêu đề bắt đầu bằng "null" (EQ Bank™
 * Personal Account) — trang có thật nhưng FinlyWealth chưa điền số; coi như
 * không có số, đừng ghi chữ "null" lên site.
 */
async function fetchRebate(slug: string): Promise<string | null> {
  const res = await fetch(REBATE_BASE + slug, {
    headers: { "User-Agent": "Ghe1A-RebateCheck/1.0 (+https://ghe1a.com)" },
  });
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  if (!title || /^not found/i.test(title)) return null;
  const amount = title.match(/^\$([\d,]+)\s+.*Rebate from FinlyWealth/i)?.[1];
  return amount ? `$${amount}` : null;
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
  let live: string | null;
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
    if (live) findings.push({ kind: "missing-link", slug: account.slug, live, rebateSlug });
    continue;
  }

  if (live === null) {
    if (account.rebate) findings.push({ kind: "gone", slug: account.slug, stored: account.rebate });
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

if (drift.length && fix) {
  let source = fs.readFileSync(FILE, "utf8");
  for (const f of drift) {
    // Neo vào đúng khối của tài khoản đó qua `slug: "..."`, rồi sửa dòng
    // `rebate:` đầu tiên sau nó — bám theo slug chứ không bám theo con số, vì
    // nhiều tài khoản trùng số rebate.
    const anchor = new RegExp(`(slug: "${f.slug}",[\\s\\S]*?)rebate: "[^"]*",\\n`);
    source = source.replace(anchor, f.kind === "stale" ? `$1rebate: "${f.live}",\n` : "$1");
  }
  fs.writeFileSync(FILE, source);
  console.log(`\nđã sửa ${drift.length} con số trong src/lib/bank-accounts.ts`);
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
