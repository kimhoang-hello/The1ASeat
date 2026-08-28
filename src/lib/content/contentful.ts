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
      const rel = relForUrl(uri);
      const attrs = rel ? ` target="_blank" rel="${rel}"` : "";
      return `<a href="${escapeAttribute(uri)}"${attrs}>${next(node.content)}</a>`;
    },
  },
};

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
 * cảnh báo. Lấy đủ mọi trang thay vì tin vào mặc định.
 *
 * Giới hạn đã biết, chấp nhận: phân trang theo `skip` nên bất cứ thay đổi nào
 * xảy ra giữa hai lượt lấy — publish thêm, unpublish bớt, hay sửa chính trường
 * dùng để sắp thứ tự — đều làm các entry dịch chỗ và một vài cái có thể bị
 * nhảy qua hoặc lấy hai lần. Chỉ xảy ra khi vượt 100 entry một content
 * type — hiện là 23 thẻ, tức vòng lặp chạy đúng một lượt — và lần chạy sau
 * (hoặc webhook publish) tự sửa lại. Chữa triệt để phải dùng con trỏ theo
 * `sys.createdAt`, không đáng đổi lấy độ phức tạp đó lúc này.
 */
const PAGE_SIZE = 100;

async function getAllEntries<S extends EntrySkeletonType>(
  query: Record<string, unknown>,
): Promise<Entry<S, undefined, string>[]> {
  const items: Entry<S, undefined, string>[] = [];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const res = await client!.getEntries<S>({ ...query, skip, limit: PAGE_SIZE });
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) return items;
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
 * lần Google crawl trong khi nội dung không đổi. Thẻ mới nhất lên đầu — content
 * model không có trường thứ tự nên đây là thứ gần nhất với ý định biên tập.
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
