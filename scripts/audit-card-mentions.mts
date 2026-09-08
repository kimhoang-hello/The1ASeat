// Rà khối thẻ chèn trong thân bài viết.
//
//   npm run audit:card-mentions
//
// VÌ SAO CẦN: khối thẻ trong bài KHÔNG do người viết đặt tay — nó hiện ra khi
// `cardMentionsInPost` nhận ra tên một thẻ trong thân bài, lúc render. Ưu điểm
// là bài cũ cũng được, và mọi con số luôn là số của hôm nay. Nhược điểm là
// toàn bộ tính năng có thể im lặng không làm gì: thêm một thẻ mới mà người
// viết chỉ gọi nó bằng tên rút gọn thì không bài nào hiện khối, và không có
// lỗi nào nổ ra.
//
// Script này in ra ĐỘ PHỦ THẬT để con số đó không bao giờ là chuyện đoán:
// bao nhiêu bài có khối, thẻ nào chưa có bí danh, bí danh nào đã mồ côi.
//
// Exit 1 chỉ khi bảng bí danh trỏ tới thẻ không còn tồn tại — thứ luôn là lỗi.
// Độ phủ thấp thì IN RA chứ không làm đỏ: phần lớn bài viết nói về chương
// trình điểm chứ không về một tấm thẻ cụ thể, nên "ít bài có khối" là sự thật
// của nội dung, không phải hỏng hóc. Cùng luật với `audit:health`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
for (const line of readFileSync(join(REPO, ".env.local"), "utf8").split("\n")) {
  if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
  const at = line.indexOf("=");
  process.env[line.slice(0, at).trim()] ??= line.slice(at + 1).trim();
}

// Gọi THẲNG tầng Contentful. `lib/content/index.ts` bọc `unstable_cache`, thứ
// chỉ chạy được bên trong Next — cùng lý do `audit:best-cards` cũng tự đọc CDA.
const { fetchContentfulPosts, fetchContentfulCreditCardOffers } = await import(
  "../src/lib/content/contentful.ts"
);
const { cardMentionsInPost, cardsWithoutAliases, orphanAliasSlugs } = await import(
  "../src/lib/post-card-mentions.ts"
);

const [posts, offers] = await Promise.all([
  fetchContentfulPosts(),
  fetchContentfulCreditCardOffers(),
]);

console.log(`${posts.length} bài, ${offers.length} thẻ\n`);

let withBlocks = 0;
let blocks = 0;
for (const post of posts) {
  const mentions = cardMentionsInPost(post, offers);
  if (mentions.length === 0) continue;
  withBlocks++;
  blocks += mentions.length;
  console.log(`  ${post.slug}`);
  for (const mention of mentions) {
    console.log(`      sau khối #${mention.afterBlock} → ${mention.card.slug}`);
  }
}

console.log(`\n${withBlocks}/${posts.length} bài có khối thẻ, tổng ${blocks} khối`);

const noAlias = cardsWithoutAliases(offers);
if (noAlias.length > 0) {
  console.log(
    `\n⚠︎  ${noAlias.length}/${offers.length} thẻ chưa có bí danh trong ALIASES ` +
      `(chỉ khớp khi bài viết TRỌN tên thẻ):`,
  );
  for (const offer of noAlias) console.log(`      ${offer.slug} — ${offer.name}`);
  console.log(
    `      Không phải lỗi: thẻ nào chưa ai viết bài nhắc tới thì không cần bí danh.\n` +
      `      Thêm vào src/lib/post-card-mentions.ts khi viết bài gọi thẻ bằng tên rút gọn.`,
  );
}

const orphans = orphanAliasSlugs(offers);
if (orphans.length > 0) {
  console.error(`\n✗ bí danh trỏ tới thẻ không còn trên Contentful: ${orphans.join(", ")}`);
  process.exit(1);
}

console.log("\n✓ bảng bí danh khớp với thẻ đang có");
