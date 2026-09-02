import { createClient, EntryFieldTypes } from "contentful";
import type { Asset, Entry, EntrySkeletonType } from "contentful";
import { documentToHtmlString, type Options } from "@contentful/rich-text-html-renderer";
import { INLINES, type Document } from "@contentful/rich-text-types";
import { relForUrl } from "@/lib/affiliate-links";
import { keepBrandTogether } from "@/lib/t";
import type { AuthorProfile, BlogPost, CreditCardOffer, TransferBonus } from "./types";

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;

export const isContentfulConfigured = Boolean(spaceId && accessToken);

const client = isContentfulConfigured
  ? createClient({ space: spaceId!, accessToken: accessToken! })
  : null;

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Contentful's rich text has nowhere for an editor to set `rel` or `target`, so
 * a link written in a post body would otherwise ship bare — including the
 * referral links, which every other surface on the site marks as `sponsored`.
 * The host decides; see lib/affiliate-links.
 */
const bodyOptions: Options = {
  renderNode: {
    [INLINES.HYPERLINK]: (node, next) => {
      const uri = String((node.data as { uri?: unknown }).uri ?? "");
      const text = next(node.content);
      // Ô nhập link của Contentful nhận chuỗi tự do, nên `javascript:` gõ vào
      // đó sẽ chạy dưới origin ghe1a.com khi người đọc bấm — thân bài đi qua
      // `dangerouslySetInnerHTML` ở `blog/[slug]`. Escape thuộc tính giữ được
      // dấu nháy, KHÔNG giữ được scheme. Chỉ nhận scheme đọc được là link, còn
      // lại trả về chữ trần: mất một cái link thì thấy ngay, còn giữ nó lại
      // thì hỏng thầm lặng.
      if (!isSafeHref(uri)) return text;
      // Một chuỗi duy nhất đi tiếp, đã trim. `isSafeHref` vốn đã trim trước khi
      // duyệt, nên trước đây cửa an toàn phán trên chuỗi đã cắt còn `href` và
      // `relForUrl` lại nhận chuỗi thô — ba cách đọc khác nhau cho cùng một
      // link. Chốt lại ở đây để chúng không thể lệch nhau nữa.
      const href = uri.trim();
      const rel = relForUrl(href);
      const attrs = rel ? ` target="_blank" rel="${rel}"` : "";
      return `<a href="${escapeAttribute(href)}"${attrs}>${text}</a>`;
    },
  },
};

/** `http(s)`, `mailto`, `tel`, và link nội bộ (`/…`, `#…`, `?…`). Mọi thứ khác
 *  — kể cả `javascript:` và `data:` — không phải thứ một bài viết cần tới. */
function isSafeHref(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
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
      return new URL(trimmed, "https://internal.invalid/").hostname === "internal.invalid";
    } catch {
      return false;
    }
  }
  // Ký tự điều khiển nhét giữa scheme (`java\0script:`) là cách cũ để lách
  // phép so scheme, nên bỏ chúng TRƯỚC khi so, không phải sau.
  const cleaned = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  return /^(https?|mailto|tel):/i.test(cleaned);
}

export function renderPostBody(document: Document): string {
  return documentToHtmlString(document, bodyOptions);
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
  return {
    slug: f.slug,
    type: f.type,
    category: f.categoryVi,
    // Keep the site name from splitting across a line wherever it appears in
    // editor-written copy, the same way the UI strings are treated in lib/t.
    title: keepBrandTogether(f.titleVi),
    excerpt: keepBrandTogether(f.excerptVi),
    body: keepBrandTogether(renderPostBody(f.bodyVi)),
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
    applyUrl: f.applyUrl,
    rebate: f.rebateVi,
    updatedAt: entry.sys.updatedAt,
  };
}

function toBonus(entry: Entry<BonusSkeleton, undefined>): TransferBonus {
  const f = entry.fields;
  return {
    slug: f.slug,
    fromProgram: f.fromProgram,
    toProgram: f.toProgram,
    bonusPercent: f.bonusPercent,
    expiresAt: f.expiresAt,
    url: f.url,
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
