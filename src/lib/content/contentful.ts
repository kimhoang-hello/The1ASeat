import { createClient, EntryFieldTypes } from "contentful";
import type { Asset, Entry, EntrySkeletonType } from "contentful";
import { documentToHtmlString, type Options } from "@contentful/rich-text-html-renderer";
import { BLOCKS, INLINES, type Document } from "@contentful/rich-text-types";
import { relForUrl } from "@/lib/affiliate-links";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { keepBrandTogether, t as translate } from "@/lib/t";
import type { AuthorProfile, BlogPost, CreditCardOffer, TransferBonus } from "./types";

const posts_t = translate("posts");

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;

export const isContentfulConfigured = Boolean(spaceId && accessToken);

// `CONTENTFUL_HOST=preview.contentful.com` (kèm token Preview API ở
// `CONTENTFUL_ACCESS_TOKEN`) cho chạy site ở máy với cả bản NHÁP — để tác giả
// duyệt một bài trước khi bấm Publish. Không đặt thì SDK dùng CDA như cũ;
// Hostinger không có biến này.
const host = process.env.CONTENTFUL_HOST;

const client = isContentfulConfigured
  ? createClient({ space: spaceId!, accessToken: accessToken!, ...(host ? { host } : {}) })
  : null;

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Ảnh chèn trong thân bài (embedded asset của rich text).
 *
 * Bộ render mặc định trả về chuỗi rỗng cho khối này, nên trước 11/10/2026 một
 * ảnh tác giả chèn vào bài sẽ biến mất không báo gì. File gốc là ảnh chụp
 * cỡ lớn; Images API của Contentful cắt ra bản WebP theo bề rộng, và
 * `width`/`height` gốc giữ chỗ để trang không giật khi ảnh tải xong. Alt lấy từ
 * Description của asset, thiếu thì Title. Asset chưa giải được (chưa publish)
 * hay không phải ảnh thì bỏ qua.
 */
const BODY_IMAGE_WIDTHS = [640, 960, 1344, 1800];

interface BodyImage {
  src: string;
  srcset: string;
  width?: number;
  height?: number;
  alt: string;
}

function bodyImage(target: unknown): BodyImage | null {
  if (!target || typeof target !== "object" || !("fields" in target)) return null;
  const fields = (target as Asset).fields;
  const file = fields?.file;
  const url = typeof file?.url === "string" ? file.url : "";
  if (!url || !String(file?.contentType ?? "").startsWith("image/")) return null;

  const src = (w: number) => `https:${url}?w=${w}&fm=webp&q=75`;
  const size = (file?.details as { image?: { width: number; height: number } } | undefined)?.image;
  // Images API không phóng to ảnh, nên mức rộng hơn file gốc phải gộp về
  // đúng bề rộng gốc — khai `1800w` cho một file 600px làm trình duyệt tưởng
  // ảnh có mật độ cao và vẽ nó nhỏ lại (cột dùng `w-auto`).
  const widths = [...new Set(BODY_IMAGE_WIDTHS.map((w) => Math.min(w, size?.width ?? w)))];
  const fallback = widths.find((w) => w >= 1344) ?? widths[widths.length - 1];

  return {
    src: src(fallback),
    srcset: widths.map((w) => `${src(w)} ${w}w`).join(", "),
    width: size?.width,
    height: size?.height,
    alt: String(fields.description || fields.title || ""),
  };
}

function imgTag(image: BodyImage, className = ""): string {
  const dims = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
  const cls = className ? ` class="${className}"` : "";
  return `<img src="${escapeAttribute(image.src)}" srcset="${escapeAttribute(image.srcset)}" sizes="(min-width: 768px) 42rem, 100vw"${dims} alt="${escapeAttribute(image.alt)}"${cls} loading="lazy" decoding="async">`;
}

function renderBodyImage(target: unknown): string {
  const image = bodyImage(target);
  return image ? `<figure>${imgTag(image)}</figure>` : "";
}

const CARET_LEFT = "M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z";
const CARET_RIGHT = "M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z";

/**
 * Hai ảnh trở lên đứng liền nhau trong thân bài thành MỘT carousel (11/10/2026,
 * user chốt cho review flights & hotels): cuộn ngang, mỗi lần một ảnh, nút
 * mũi tên cùng kiểu với carousel bài viết ở trang chủ (`PostCarousel`).
 *
 * Tác giả không phải làm gì đặc biệt — chèn các ảnh sát nhau trong Contentful
 * là đủ; đoạn trống mà trình soạn thảo tự chèn giữa hai ảnh được bỏ qua. Cuộn
 * là cuộn gốc của trình duyệt (vuốt, trackpad, phím mũi tên khi khung có
 * focus), nên không có JS vẫn xem hết được ảnh; `PostImageCarousels` chỉ gắn
 * nút và bộ đếm.
 *
 * Khung lấy tỉ lệ của ẢNH ĐẦU (4:3 ngang hoặc 3:4 dọc) và cắt `object-cover`
 * những ảnh lệch tỉ lệ — nên gom ảnh cùng chiều vào một bộ. Bộ ảnh dọc hẹp lại
 * (`max-w-md`) để không cao quá một màn hình.
 */
function renderImageCarousel(images: BodyImage[]): string {
  const first = images[0];
  const portrait = Boolean(first.width && first.height && first.height > first.width);
  const arrow =
    "absolute top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-0";
  const icon = (d: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${d}"></path></svg>`;
  const slides = images
    .map(
      (image) =>
        `<figure class="m-0 w-full shrink-0 snap-center ${portrait ? "aspect-[3/4]" : "aspect-[4/3]"}">${imgTag(image, "h-full w-full object-cover")}</figure>`,
    )
    .join("");

  return (
    `<div class="not-prose my-8" data-image-carousel>` +
    `<div class="relative${portrait ? " mx-auto max-w-md" : ""}">` +
    `<div data-carousel-track tabindex="0" role="region" aria-roledescription="carousel" aria-label="${escapeAttribute(posts_t("galleryLabel", { count: images.length }))}" class="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-xl bg-primary [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">${slides}</div>` +
    `<button type="button" data-carousel-prev disabled aria-label="${escapeAttribute(posts_t("galleryPrev"))}" class="${arrow} left-3">${icon(CARET_LEFT)}</button>` +
    `<button type="button" data-carousel-next aria-label="${escapeAttribute(posts_t("galleryNext"))}" class="${arrow} right-3">${icon(CARET_RIGHT)}</button>` +
    `<span data-carousel-count aria-live="polite" aria-atomic="true" class="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white tabular-nums">1 / ${images.length}</span>` +
    `</div></div>`
  );
}

/**
 * Video chèn trong thân bài: tác giả chèn chính entry bài VIDEO (blogPost có
 * `videoUrl`) vào rich text, và bài viết nhúng player của video đó — cùng iframe
 * với trang bài video. URL đi qua `getVideoEmbedUrl`, nên chỉ YouTube/Vimeo
 * đúng hình dạng mới thành `src`; entry khác loại hay chưa publish thì bỏ qua.
 */
function renderBodyVideo(target: unknown): string {
  if (!target || typeof target !== "object" || !("fields" in target)) return "";
  const fields = (target as { fields?: { videoUrl?: unknown; titleVi?: unknown } }).fields;
  const embedUrl = getVideoEmbedUrl(typeof fields?.videoUrl === "string" ? fields.videoUrl : "");
  if (!embedUrl) return "";
  const title = String(fields?.titleVi ?? "");

  return `<div class="not-prose my-8 aspect-video w-full overflow-hidden rounded-2xl bg-primary"><iframe src="${escapeAttribute(embedUrl)}" title="${escapeAttribute(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="h-full w-full"></iframe></div>`;
}

/**
 * Contentful's rich text has nowhere for an editor to set `rel` or `target`, so
 * a link written in a post body would otherwise ship bare — including the
 * referral links, which every other surface on the site marks as `sponsored`.
 * The host decides; see lib/affiliate-links.
 */

const bodyOptions: Options = {
  renderNode: {
    [BLOCKS.EMBEDDED_ASSET]: (node) => renderBodyImage((node.data as { target?: unknown }).target),
    [BLOCKS.EMBEDDED_ENTRY]: (node) => renderBodyVideo((node.data as { target?: unknown }).target),
    [INLINES.HYPERLINK]: (node, next) => {
      const uri = String((node.data as { uri?: unknown }).uri ?? "");
      const text = next(node.content);
      // Ô nhập link của Contentful nhận chuỗi tự do, nên `javascript:` gõ vào
      // đó sẽ chạy dưới origin ghe1a.com khi người đọc bấm — thân bài đi qua
      // `dangerouslySetInnerHTML` ở `blog/[slug]`. Escape thuộc tính giữ được
      // dấu nháy, KHÔNG giữ được scheme. Chỉ nhận scheme đọc được là link, còn
      // lại trả về chữ trần: mất một cái link thì thấy ngay, còn giữ nó lại
      // thì hỏng thầm lặng.
      // `safeHref` trả về ĐÚNG chuỗi được phép in — đã trim và đã bỏ ký tự
      // điều khiển. Dùng lại chính nó cho `href` và cho `relForUrl` là cách duy
      // nhất giữ ba cách đọc không lệch nhau; đừng quay lại dùng `uri` ở đây.
      const href = safeHref(uri);
      if (href === null) return text;
      const rel = relForUrl(href);
      const attrs = rel ? ` target="_blank" rel="${rel}"` : "";
      return `<a href="${escapeAttribute(href)}"${attrs}>${text}</a>`;
    },
  },
};

/**
 * Chuỗi href ĐƯỢC PHÉP IN RA, hoặc `null` nếu không phải link đọc được.
 *
 * Trả về CHUỖI chứ không trả `boolean`, vì đây là chỗ ba cách đọc từng lệch
 * nhau. `href`, `relForUrl` và chính cửa an toàn này BẮT BUỘC nhìn cùng một
 * chuỗi: bản cũ lọc ký tự điều khiển để duyệt scheme rồi lại in chuỗi THÔ ra
 * `href`, nên `"http\ns://finlywealth.com/r/x"` qua được cửa, mà `relForUrl`
 * (khớp `^https?://` trên chuỗi thô) trả `null` — link referral ra site không
 * `sponsored`, không `target="_blank"`, `AffiliateClickTracker` không đếm, còn
 * trình duyệt thì vẫn cắt ký tự điều khiển và đi thẳng tới FinlyWealth. Đo
 * được cả ba hình dạng: xuống dòng, tab, và CR chèn giữa scheme.
 *
 * Đây là lần thứ ba cùng một lớp lỗi ở đúng chỗ này (khoảng trắng đầu chuỗi,
 * rồi `/\host`, giờ tới ký tự điều khiển). Nên cửa không còn trả lời "có/không"
 * nữa — nó trả về đúng chuỗi phải dùng, và mọi chỗ phía sau dùng lại chuỗi đó.
 *
 * `http(s)`, `mailto`, `tel`, và link nội bộ (`/…`, `#…`, `?…`). Mọi thứ khác
 * — kể cả `javascript:` và `data:` — không phải thứ một bài viết cần tới.
 */
export function safeHref(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;
  // Link nội bộ được XÁC NHẬN BẰNG CÁCH GIẢI RA, không bằng cách nhìn ký tự
  // đầu. `//host/path` bắt đầu bằng `/` nhưng là link ra ngoài mượn scheme của
  // trang, và chuẩn URL của WHATWG còn coi `\` ngang hàng `/` ở chỗ này — nên
  // `/\finlywealth.com/r/x` cũng đi thẳng ra ngoài (đo được: giải với gốc
  // `https://ghe1a.com/blog/x` ra `https://finlywealth.com/r/x`). Lọt qua
  // nhánh "nội bộ" thì `relForUrl` (chỉ khớp `^https?://`) trả `null`, nên
  // link referral viết kiểu đó ra site mà không có `sponsored` — đúng thứ
  // `affiliate-links` sinh ra để không bao giờ xảy ra.
  //
  // Chặn bằng regex đếm hai ký tự đầu thì mỗi lần chuẩn URL có thêm một ký tự
  // tương đương lại hở tiếp. Để chính bộ giải URL trả lời: giải trên một gốc
  // KHÔNG THỂ TỒN TẠI thật (`.invalid` là TLD dành riêng, RFC 2606), rồi đòi
  // host phải không đổi. Đường dẫn thật giữ nguyên host; mọi hình dạng lén đổi
  // host — dù viết bằng `/`, `\` hay thứ chuẩn thêm vào sau này — đều lộ ra.
  if (/^[/#?\\]/.test(trimmed)) {
    try {
      const stays = new URL(trimmed, "https://internal.invalid/").hostname === "internal.invalid";
      return stays ? trimmed : null;
    } catch {
      return null;
    }
  }
  // Ký tự điều khiển nhét giữa scheme (`java\0script:`) là cách cũ để lách
  // phép so scheme, nên bỏ chúng TRƯỚC khi so, không phải sau — VÀ trả về đúng
  // chuỗi đã bỏ, để không chỗ nào phía sau còn nhìn thấy bản thô.
  const cleaned = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  // Lần thứ TƯ cùng một lớp lỗi: regex chỉ so TIỀN TỐ scheme (`/^https?:/`)
  // mà không đòi cú pháp `//` theo sau, nên `https:\finlywealth.com/r/x` (một
  // gạch chéo ngược, không phải `//`) qua được cửa và bị trả về NGUYÊN VĂN có
  // gạch chéo ngược — `relForUrl` (khớp `^https?://`, hai gạch chéo xuôi)
  // không nhận ra nó là link ngoài, nên site in link referral này mà THIẾU
  // `sponsored`.
  //
  // Bản vá ĐẦU dùng `new URL(cleaned)` KHÔNG base để tự giải rồi trả
  // `.toString()` — và vòng phản biện Codex bắt đây là BẢN VÁ HỎNG: không có
  // base, `new URL` coi "https:\host" là một URL ĐỘC LẬP nên đọc host là
  // "host" → link ngoài. Nhưng trình duyệt LUÔN giải `href` với base là
  // chính trang đang đứng; với base đó, vì scheme "https" TRÙNG scheme của
  // trang, WHATWG cho vào "special-authority-slashes state" và bỏ qua nhóm
  // "https:" dư — phần còn lại ("\host/path", gạch ngược đọc như gạch xuôi)
  // trở thành ĐƯỜNG DẪN CÙNG ORIGIN `https://ghe1a.com/host/path`, không
  // phải link ra ngoài. Hai cách giải ra hai đích khác hẳn nhau — không có
  // cách nào "biết chắc" người viết định trỏ đi đâu.
  //
  // Nên KHÔNG đoán: một scheme tuyệt đối phải viết ĐÚNG `//` mới được chấp
  // nhận. Thiếu `//` thì trả `null` — mất một link viết sai còn hơn giữ một
  // link mà chính trình duyệt và server đọc ra hai đích khác nhau. Đã đối
  // chiếu: cả 35 link thật đang có trên site đều viết đúng `//`.
  if (/^(mailto|tel):/i.test(cleaned)) return cleaned;
  return /^https?:\/\//i.test(cleaned) ? cleaned : null;
}

/**
 * Thân bài cắt theo khối cấp cao nhất — xem `BlogPost.bodyBlocks`.
 *
 * `documentToHtmlString` nối các khối cấp cao nhất lại mà không chèn gì vào
 * giữa, nên render từng khối một rồi nối lại cho ra ĐÚNG chuỗi cũ. Đã đo trên
 * cả 40 bài đang có (390 khối): không lệch một byte nào. Nếu một ngày nào đó
 * bộ render thêm thứ gì vào giữa hai khối, `body` bên dưới sẽ đổi theo và
 * trang vẫn đúng — hai giá trị luôn được dựng từ cùng một mảng.
 *
 * Ngoại lệ duy nhất: một dãy ảnh liền nhau gộp thành MỘT khối carousel (xem
 * `renderImageCarousel`). Mọi chỗ đếm khối (`afterBlock` của khối thẻ, mục lục)
 * đều đọc chính mảng này nên vẫn khớp nhau.
 */
export function renderPostBlocks(document: Document): string[] {
  const nodes = document.content ?? [];
  const blocks: string[] = [];
  let i = 0;
  while (i < nodes.length) {
    const run: BodyImage[] = [];
    let next = i;
    while (next < nodes.length && nodes[next].nodeType === BLOCKS.EMBEDDED_ASSET) {
      const image = bodyImage((nodes[next].data as { target?: unknown }).target);
      if (!image) break;
      run.push(image);
      next++;
      // Trình soạn thảo Contentful tự chèn một đoạn trống sau mỗi khối nhúng;
      // đoạn trống nằm GIỮA hai ảnh không được cắt đôi bộ ảnh.
      let after = next;
      while (after < nodes.length && isEmptyParagraph(nodes[after])) after++;
      if (after > next && nodes[after]?.nodeType === BLOCKS.EMBEDDED_ASSET) next = after;
    }
    if (run.length >= 2) {
      blocks.push(renderImageCarousel(run));
      i = next;
    } else {
      blocks.push(documentToHtmlString({ ...document, content: [nodes[i]] }, bodyOptions));
      i++;
    }
  }
  return blocks;
}

function isEmptyParagraph(node: Document["content"][number]): boolean {
  return (
    node.nodeType === BLOCKS.PARAGRAPH &&
    node.content.every((child) => child.nodeType === "text" && child.value.trim() === "")
  );
}

function assetUrl(asset: unknown): string {
  if (asset && typeof asset === "object" && "fields" in asset) {
    const url = (asset as Asset).fields?.file?.url;
    if (typeof url === "string") return `https:${url}`;
  }
  return "";
}

// The Contentful content model still has "...Vi"/"...En" field pairs
// (see CONTENTFUL.md) — the website only reads the Vi side now.
interface PostSkeleton {
  contentTypeId: "blogPost";
  fields: {
    slug: EntryFieldTypes.Symbol;
    type: EntryFieldTypes.Symbol<"post" | "video">;
    categoryVi: EntryFieldTypes.Symbol;
    titleVi: EntryFieldTypes.Symbol;
    excerptVi: EntryFieldTypes.Text;
    bodyVi: EntryFieldTypes.RichText;
    coverImage: EntryFieldTypes.Symbol<
      "airplane" | "globe" | "building" | "armchair" | "credit-card" | "avatar"
    >;
    coverPhoto?: EntryFieldTypes.AssetLink;
    videoUrl?: EntryFieldTypes.Symbol;
    publishedAt: EntryFieldTypes.Date;
    minutesRead: EntryFieldTypes.Integer;
    author: EntryFieldTypes.Symbol;
    seoTitleVi?: EntryFieldTypes.Symbol;
    seoDescriptionVi?: EntryFieldTypes.Text;
  };
}

interface CardSkeleton {
  contentTypeId: "creditCardOffer";
  fields: {
    slug: EntryFieldTypes.Symbol;
    name: EntryFieldTypes.Symbol;
    issuer: EntryFieldTypes.Symbol;
    image: EntryFieldTypes.Symbol<
      "airplane" | "globe" | "building" | "armchair" | "credit-card" | "avatar"
    >;
    cardImage?: EntryFieldTypes.AssetLink;
    country: EntryFieldTypes.Symbol<"US" | "CA">;
    annualFeeVi: EntryFieldTypes.Symbol;
    cardTypeVi: EntryFieldTypes.Symbol;
    welcomeBonusVi?: EntryFieldTypes.Symbol;
    headlineVi: EntryFieldTypes.Text;
    editorsTakeVi: EntryFieldTypes.Text;
    keyBenefitsVi: EntryFieldTypes.Array<EntryFieldTypes.Symbol>;
    elevatedBonus: EntryFieldTypes.Boolean;
    expiresAt?: EntryFieldTypes.Date;
    applyUrl: EntryFieldTypes.Symbol;
    rebateVi?: EntryFieldTypes.Symbol;
  };
}

interface BonusSkeleton {
  contentTypeId: "transferBonus";
  fields: {
    slug: EntryFieldTypes.Symbol;
    fromProgram: EntryFieldTypes.Symbol;
    toProgram: EntryFieldTypes.Symbol;
    bonusPercent: EntryFieldTypes.Integer;
    expiresAt: EntryFieldTypes.Date;
    url: EntryFieldTypes.Symbol;
    noteVi?: EntryFieldTypes.Text;
  };
}

interface AuthorSkeleton {
  contentTypeId: "author";
  fields: {
    name: EntryFieldTypes.Symbol;
    photo?: EntryFieldTypes.AssetLink;
    bioVi: EntryFieldTypes.Text;
  };
}

function toPost(entry: Entry<PostSkeleton, undefined>): BlogPost {
  const f = entry.fields;
  const bodyBlocks = renderPostBlocks(f.bodyVi).map(keepBrandTogether);

  return {
    slug: f.slug,
    type: f.type,
    category: f.categoryVi,
    // Keep the site name from splitting across a line wherever it appears in
    // editor-written copy, the same way the UI strings are treated in lib/t.
    title: keepBrandTogether(f.titleVi),
    excerpt: keepBrandTogether(f.excerptVi),
    // `body` dựng TỪ `bodyBlocks`, không gọi renderer lần thứ hai: hai giá trị
    // phải là cùng một chuỗi, và cách chắc chắn nhất là chỉ có một nguồn.
    body: bodyBlocks.join(""),
    bodyBlocks,
    coverImage: f.coverImage,
    coverPhoto: f.coverPhoto ? assetUrl(f.coverPhoto) || undefined : undefined,
    videoUrl: f.videoUrl,
    publishedAt: f.publishedAt,
    updatedAt: entry.sys.updatedAt,
    minutesRead: f.minutesRead,
    author: f.author,
    seoTitle: f.seoTitleVi,
    seoDescription: f.seoDescriptionVi,
  };
}

/**
 * `applyUrl` phải là `http(s)`, kiểm NGAY LÚC MAP chứ không đợi audit.
 *
 * Ô nhập của Contentful là chuỗi tự do, và khác với link trong thân bài (đã có
 * `isSafeHref` gác), giá trị này đi thẳng vào `href` của nút Apply và vào
 * JSON-LD, không qua cửa nào — `javascript:…` gõ vào đó sẽ chạy dưới origin
 * ghe1a.com khi người đọc bấm. `npm run audit:health` cũng bắt ca này, nhưng
 * audit là hậu kiểm: một entry publish lúc 10 giờ sáng vẫn sống trên site cho
 * tới lượt audit kế tiếp.
 *
 * Trả `undefined` chứ không ném, và TUYỆT ĐỐI KHÔNG trả chuỗi rỗng: `href=""`
 * giải ra chính URL của trang đang đứng, nên với `target="_blank"` người đọc
 * bấm Apply sẽ mở lại đúng trang đó ở tab mới — và `apply_clicked` vẫn bắn,
 * tức số đo doanh thu nói có một cú bấm đi đâu đó. Đó là hỏng THẦM LẶNG, đúng
 * thứ cửa này sinh ra để chặn. `undefined` buộc mọi chỗ render phải xử lý.
 *
 * Không ném vì một link hỏng không đáng làm sập cả trang thẻ.
 *
 * Đòi `^https?:\/\/` bằng KÝ TỰ trên chuỗi gốc, không chỉ đòi `new URL()` chạy
 * được — `new URL()` (không có base) hiểu cả `https:finlywealth.com/x` và
 * `https:/finlywealth.com/x` là https hợp lệ và trả `protocol: "https:"`, vì
 * WHATWG tự thêm `//` cho scheme đặc biệt khi PHÂN TÍCH ĐỘC LẬP. Nhưng trình
 * duyệt lại phân tích chuỗi này làm `href` với BASE là trang đang đứng (vì nó
 * thiếu `//` nên bị coi là tham chiếu tương đối), ra
 * `https://ghe1a.com/credit-cards/finlywealth.com/x` — một URL NỘI BỘ 404,
 * trong khi cửa kiểm này đã gật đầu cho nó đi qua như một link ngoài hợp lệ.
 * Nút Apply vẫn bắn `apply_clicked` và `check-rebates` vẫn coi đây là link
 * FinlyWealth thật. Cùng lớp lỗi "một chuỗi đọc được nhiều cách khác nhau" đã
 * vá ba lần ở `safeHref`/`relForUrl` — xem AGENTS.md.
 */
function safeApplyUrl(url: string, slug: string): string | undefined {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      // Rơi xuống dưới.
    }
  }
  console.warn(`[content] thẻ "${slug}" có applyUrl không phải http(s), đã bỏ: ${url}`);
  return undefined;
}

function toCard(entry: Entry<CardSkeleton, undefined>): CreditCardOffer {
  const f = entry.fields;
  return {
    slug: f.slug,
    name: f.name,
    issuer: f.issuer,
    image: f.image,
    cardImage: assetUrl(f.cardImage),
    country: f.country,
    annualFee: f.annualFeeVi,
    cardType: f.cardTypeVi,
    welcomeBonus: f.welcomeBonusVi,
    headline: keepBrandTogether(f.headlineVi),
    editorsTake: keepBrandTogether(f.editorsTakeVi),
    keyBenefits: f.keyBenefitsVi.map(keepBrandTogether),
    elevatedBonus: f.elevatedBonus,
    expiresAt: f.expiresAt,
    applyUrl: safeApplyUrl(f.applyUrl, f.slug),
    rebate: f.rebateVi,
    updatedAt: entry.sys.updatedAt,
  };
}

/**
 * `url` của transfer bonus là chuỗi tự do từ Contentful và đi thẳng vào `href`
 * ở trang chủ lẫn `/transfer-bonuses`. React 19 chặn `javascript:`, nhưng
 * không chặn `data:` hay các hình dạng đổi host mà `safeHref` đã phải vá bốn
 * lần — nên đi qua đúng cửa đó như link trong thân bài. Không qua được thì trỏ
 * về trang danh sách: thẻ bonus vẫn hiện, chỉ mất link ra ngoài.
 */
function safeBonusUrl(url: string, slug: string): string {
  const href = safeHref(url);
  if (href !== null) return href;
  console.warn(`[content] transfer bonus "${slug}" có url không an toàn, đã bỏ: ${url}`);
  return "/transfer-bonuses";
}

function toBonus(entry: Entry<BonusSkeleton, undefined>): TransferBonus {
  const f = entry.fields;
  return {
    slug: f.slug,
    fromProgram: f.fromProgram,
    toProgram: f.toProgram,
    bonusPercent: f.bonusPercent,
    expiresAt: f.expiresAt,
    url: safeBonusUrl(f.url, f.slug),
    note: f.noteVi,
  };
}

function toAuthor(entry: Entry<AuthorSkeleton, undefined>): AuthorProfile {
  const f = entry.fields;
  return {
    name: f.name,
    photo: assetUrl(f.photo),
    bio: keepBrandTogether(f.bioVi),
  };
}

/**
 * Contentful trả tối đa 100 entry mỗi lần và không nói gì khi còn nữa: quá 100
 * thẻ thì những thẻ sau đơn giản biến mất khỏi danh sách lẫn khỏi
 * `generateStaticParams`, và trang riêng của chúng trả 404 — không lỗi, không
 * cảnh báo.
 *
 * Dùng CON TRỎ MỜ của Contentful (`getEntriesWithCursor` → `pages.next`), không
 * phải `skip` và cũng không phải con trỏ tự chế theo `sys.createdAt`. Đã thử cả
 * hai và cả hai đều mất entry trong im lặng:
 *
 * - `skip`: entry bị unpublish giữa hai lượt lấy làm những entry sau dồn lên,
 *   và một vài cái còn sống bị nhảy qua.
 * - `sys.createdAt[lte]` tự chế: 100 entry trùng mốc thời gian (import hàng
 *   loạt) thì lượt sau trả về đúng 100 cái cũ, không cách nào đi tiếp qua cái
 *   mốc đó.
 *
 * Con trỏ mờ do server cấp không có cả hai vấn đề, và trả `order` về lại cho
 * Contentful — nên thứ tự vẫn do query quyết định, không phải sắp lại trong JS.
 */
const PAGE_SIZE = 100;

async function getAllEntries<S extends EntrySkeletonType>(
  query: Record<string, unknown>,
): Promise<Entry<S, undefined, string>[]> {
  const items: Entry<S, undefined, string>[] = [];
  let pageNext: string | undefined;

  for (;;) {
    const res = await client!.getEntriesWithCursor<S>({
      ...query,
      limit: PAGE_SIZE,
      ...(pageNext ? { pageNext } : {}),
    });

    items.push(...res.items);
    if (!res.pages.next) return items;
    pageNext = res.pages.next;
  }
}

export async function fetchContentfulPosts(): Promise<BlogPost[]> {
  const items = await getAllEntries<PostSkeleton>({
    content_type: "blogPost",
    order: ["-fields.publishedAt"],
  });
  return items.map(toPost);
}

/**
 * `order` chứ không để Contentful tự quyết: không có nó thì thứ tự thẻ đổi mỗi
 * lần sửa một entry, kéo theo `position` trong ItemList JSON-LD xáo giữa các
 * lần Google crawl trong khi nội dung không hề đổi. Thẻ mới nhất lên đầu —
 * content model không có trường thứ tự nên đây là thứ gần nhất với ý định
 * biên tập.
 */
export async function fetchContentfulCreditCardOffers(): Promise<CreditCardOffer[]> {
  const items = await getAllEntries<CardSkeleton>({
    content_type: "creditCardOffer",
    order: ["-sys.createdAt"],
  });
  return items.map(toCard);
}

export async function fetchContentfulTransferBonuses(): Promise<TransferBonus[]> {
  const items = await getAllEntries<BonusSkeleton>({
    content_type: "transferBonus",
    order: ["fields.expiresAt"],
  });
  return items.map(toBonus);
}

export async function fetchContentfulAuthor(): Promise<AuthorProfile | null> {
  const res = await client!.getEntries<AuthorSkeleton>({ content_type: "author", limit: 1 });
  return res.items[0] ? toAuthor(res.items[0]) : null;
}
