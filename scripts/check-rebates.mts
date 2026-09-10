// Giữ cho số rebate của THẺ TÍN DỤNG khớp với FinlyWealth.
//
//   npm run job:check-rebates
//
// Chạy hai lượt mỗi ngày bởi .github/workflows/check-rebates.yml. Đây là cùng
// một phép so mà `/api/check-rebates` chạy — cả hai gọi `runCheckRebates` trong
// `src/lib/check-rebates.ts`, không bên nào chép lại của bên nào.
//
// VÌ SAO CHẠY TRONG RUNNER CHỨ KHÔNG GỌI QUA ghe1a.com NỮA:
//
// Workflow trước đây `curl -X POST https://ghe1a.com/api/check-rebates`, và
// edge Hostinger (`server: hcdn`) chặn IP của runner GitHub. Đo trong 6 ngày
// (04–09/09/2026): 04/09 và 05/09 trả 403 ở cả 5 lượt; 08/09 và 09/09 nặng hơn,
// không bắt được cả TCP — `curl (28) Failed to connect ... after 268s`, 5 lượt,
// ~25 phút runner đốt cho một job không chạy được dòng nào. Cùng lúc đó site
// hoàn toàn khoẻ: gọi từ máy nhà trả 200 trong 0.4 giây. Bản vá 04/09 (đổi
// User-Agent, bỏ `-f`) không giữ được — 05/09 vẫn 403.
//
// Hai ngày liền mỗi ngày mất đúng một trong hai lượt, tức lịch "hai lượt" trên
// giấy thành một lượt trên thực tế — đúng cái mà lượt thứ hai sinh ra để chặn.
//
// Chạy thẳng trong runner thì không còn cửa nào cho WAF chen vào: script nói
// chuyện với Contentful và FinlyWealth, hai chỗ chưa bao giờ chặn runner.
// Đánh đổi: runner phải có token Contentful (ba secret dưới đây), thứ mà trước
// đây chỉ server mới có — và đó cũng là lý do cũ khiến job phải đi vòng.

import {
  runCheckRebates,
  type Change,
  type CheckRebatesResult,
} from "../src/lib/check-rebates.ts";
import { isTransient } from "../src/lib/job-retry.ts";

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

// Thiếu biến thì đỏ NGAY, không chạy tiếp. Không có token thì `listEntries`
// trả 401 và job sẽ đỏ với một câu lỗi HTTP nói về Contentful — đọc giống hệt
// "Contentful đang hỏng", trong khi thứ hỏng là cấu hình của chính repo này.
//
// `CONTENTFUL_ACCESS_TOKEN` (CDA, đọc bản đã publish) kiểm cùng chỗ dù script
// không dùng trực tiếp: `src/lib/content/contentful.ts` đọc nó lúc import và
// nếu thiếu thì `client` là `null`, `fetchContentfulCreditCardOffers` ném lỗi
// ở tận trong vòng lặp thay vì báo ngay tại đây.
const missing = [
  ["CONTENTFUL_SPACE_ID", spaceId],
  ["CONTENTFUL_ACCESS_TOKEN", process.env.CONTENTFUL_ACCESS_TOKEN],
  ["CONTENTFUL_MANAGEMENT_TOKEN", managementToken],
].filter(([, value]) => !value);

if (missing.length) {
  console.error(`Thiếu biến môi trường: ${missing.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

/**
 * Chạy lại khi — và CHỈ khi — lượt vừa rồi có thứ mà chạy lại chữa được.
 *
 * Bản `curl --retry 5` cũ thử lại theo HTTP status, mà status thì gộp mọi loại
 * hỏng vào một mã 500: một trang FinlyWealth timeout và một con số viết tay gõ
 * nhầm đọc giống hệt nhau từ phía curl, nên nó chạy lại cả hai. Cái thứ hai
 * không bao giờ khỏi — mỗi lượt thừa là mười lần đọc FinlyWealth đổ đi, và
 * quota bên đó có hạn.
 *
 * Ở đây phân biệt được vì đọc thẳng kết quả: `retryable` chỉ được gắn cho lỗi
 * mạng lúc đọc một trang thẻ. Ném thẳng (Contentful không liệt kê được, mạng
 * chết giữa chừng) cũng chạy lại — lượt đó chưa kiểm được thẻ nào cả.
 *
 * BA lượt chứ không phải năm: gọi lại an toàn nhưng không miễn phí. Mỗi lượt
 * đọc tuần tự mười trang FinlyWealth, và từ 09/09/2026 job này chạy trong
 * runner nên không còn `curl --max-time 300` cắt ngang một lượt treo.
 */
const ATTEMPTS = 3;
const DELAY_MS = 30_000;

let result!: CheckRebatesResult;

/**
 * Thẻ đã ghi ở MỌI lượt, không riêng lượt cuối.
 *
 * `result` bị ghi đè mỗi lượt, mà lượt sau đọc lại bản đã publish nên thẻ vừa
 * sửa ở lượt trước quay về `unchanged`. Lấy nguyên `result.updated` của lượt
 * cuối là log tuyên bố sai: lượt 1 sửa thẻ A rồi thẻ B rớt mạng, lượt 2 sửa
 * được B — log chỉ còn B, và A đã bị GHI vào Contentful mà không dòng nào nói
 * ra. Log của lượt chạy là bản ghi duy nhất về việc job đã đổi những gì.
 *
 * Gộp theo slug: giữ `from` của lần thấy ĐẦU (số thật lúc site còn sai) và
 * `to` của lần ghi CUỐI.
 */
const writes = new Map<string, Change>();

function remember(changes: Change[]): void {
  for (const change of changes) {
    const seen = writes.get(change.slug);
    writes.set(
      change.slug,
      seen
        ? { ...change, from: seen.from, prose: [...new Set([...seen.prose, ...change.prose])] }
        : change,
    );
  }
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  if (attempt > 1) {
    console.log(`\nLượt ${attempt}/${ATTEMPTS} sau ${DELAY_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  try {
    result = await runCheckRebates({ spaceId: spaceId!, managementToken: managementToken! });
  } catch (err) {
    // Lượt cuối thì để lỗi thoát ra: đỏ kèm nguyên stack đọc ra được nhiều hơn
    // là một câu tóm tắt tự chế.
    if (attempt === ATTEMPTS) throw err;

    // Cùng phép phân loại với lỗi theo từng thẻ. Chỗ này hay ném nhất là
    // `listEntries` trả 401 vì token management sai hoặc chưa Authorize cho
    // org — gọi thêm mười lượt cũng vậy, và đỏ NGAY mới là tín hiệu đúng.
    if (!isTransient(err)) throw err;

    console.error(`Lượt ${attempt} hỏng giữa chừng: ${err instanceof Error ? err.message : err}`);
    continue;
  }

  remember(result.updated);

  if (!result.errors.some((e) => e.retryable)) break;
  if (attempt < ATTEMPTS) {
    const n = result.errors.filter((e) => e.retryable).length;
    console.error(`Lượt ${attempt}: ${n} thẻ lỗi thoáng qua, thử lại.`);
  }
}

// Thứ đi ra ngoài là hợp của mọi lượt, không phải ảnh chụp lượt cuối.
//
// `unchanged` phải lọc theo: thẻ sửa ở lượt 1 thì lượt 2 đọc lại bản đã
// publish và thấy nó khớp, nên nó rơi vào `unchanged` của lượt cuối. Để nguyên
// thì cùng một slug nằm ở CẢ HAI danh sách, và ai đọc log sau này không biết
// tin bên nào. `updated` thắng: nó nói về một lần GHI đã xảy ra thật.
const written = new Set(writes.keys());
result = {
  ...result,
  updated: [...writes.values()],
  unchanged: result.unchanged.filter((slug) => !written.has(slug)),
};

// In nguyên khối JSON như route vẫn trả, để log của lượt chạy trong runner đọc
// giống hệt log của những lượt gọi qua HTTP trước đây — nhật ký cũ và mới so
// được với nhau.
console.log(JSON.stringify(result));

if (result.updated.length) {
  console.log(`\n${result.updated.length} thẻ vừa đổi số:`);
  for (const change of result.updated) {
    const prose = change.prose.length ? ` (sửa kèm: ${change.prose.join(", ")})` : "";
    console.log(`  ·  ${change.slug}: ${change.from ?? "(trống)"} → ${change.to}${prose}`);
  }
} else {
  console.log(`\nKhông số nào đổi (${result.checked} thẻ được kiểm).`);
}

if (result.errors.length) {
  console.log(`\n${result.errors.length} chuyện cần người nhìn vào:`);
  for (const err of result.errors) console.error(`  ·  ${err.slug}: ${err.message}`);
}

// Đỏ khi có lỗi, cùng ngưỡng với mã 500 mà route trả: gom lỗi vào body rồi vẫn
// xanh nghĩa là FinlyWealth đổi markup hay timeout thì con số cũ nằm lại trên
// site vô thời hạn, không ai được báo.
process.exit(result.errors.length ? 1 : 0);
