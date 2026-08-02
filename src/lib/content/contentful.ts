import { createClient, EntryFieldTypes } from "contentful";
import type { Asset, Entry } from "contentful";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import type { AuthorProfile, BlogPost, CreditCardOffer, Locale, TransferBonus } from "./types";

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;

export const isContentfulConfigured = Boolean(spaceId && accessToken);

const client = isContentfulConfigured
  ? createClient({ space: spaceId!, accessToken: accessToken! })
  : null;

function assetUrl(asset: unknown): string {
  if (asset && typeof asset === "object" && "fields" in asset) {
    const url = (asset as Asset).fields?.file?.url;
    if (typeof url === "string") return `https:${url}`;
  }
  return "";
}

interface PostSkeleton {
  contentTypeId: "blogPost";
  fields: {
    slug: EntryFieldTypes.Symbol;
    type: EntryFieldTypes.Symbol<"post" | "video">;
    categoryVi: EntryFieldTypes.Symbol;
    categoryEn: EntryFieldTypes.Symbol;
    titleVi: EntryFieldTypes.Symbol;
    titleEn: EntryFieldTypes.Symbol;
    excerptVi: EntryFieldTypes.Text;
    excerptEn: EntryFieldTypes.Text;
    bodyVi: EntryFieldTypes.RichText;
    bodyEn: EntryFieldTypes.RichText;
    coverImage: EntryFieldTypes.Symbol<
      "airplane" | "globe" | "building" | "armchair" | "credit-card" | "avatar"
    >;
    videoUrl?: EntryFieldTypes.Symbol;
    publishedAt: EntryFieldTypes.Date;
    minutesRead: EntryFieldTypes.Integer;
    author: EntryFieldTypes.Symbol;
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
    country: EntryFieldTypes.Symbol<"US" | "CA">;
    annualFeeVi: EntryFieldTypes.Symbol;
    annualFeeEn: EntryFieldTypes.Symbol;
    cardTypeVi: EntryFieldTypes.Symbol;
    cardTypeEn: EntryFieldTypes.Symbol;
    headlineVi: EntryFieldTypes.Text;
    headlineEn: EntryFieldTypes.Text;
    editorsTakeVi: EntryFieldTypes.Text;
    editorsTakeEn: EntryFieldTypes.Text;
    keyBenefitsVi: EntryFieldTypes.Array<EntryFieldTypes.Symbol>;
    keyBenefitsEn: EntryFieldTypes.Array<EntryFieldTypes.Symbol>;
    elevatedBonus: EntryFieldTypes.Boolean;
    applyUrl: EntryFieldTypes.Symbol;
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
  };
}

interface AuthorSkeleton {
  contentTypeId: "author";
  fields: {
    name: EntryFieldTypes.Symbol;
    photo?: EntryFieldTypes.AssetLink;
    bioVi: EntryFieldTypes.Text;
    bioEn: EntryFieldTypes.Text;
  };
}

function toPost(entry: Entry<PostSkeleton, undefined>): BlogPost {
  const f = entry.fields;
  return {
    slug: f.slug,
    type: f.type,
    category: { vi: f.categoryVi, en: f.categoryEn },
    title: { vi: f.titleVi, en: f.titleEn },
    excerpt: { vi: f.excerptVi, en: f.excerptEn },
    body: { vi: documentToHtmlString(f.bodyVi), en: documentToHtmlString(f.bodyEn) },
    coverImage: f.coverImage,
    videoUrl: f.videoUrl,
    publishedAt: f.publishedAt,
    minutesRead: f.minutesRead,
    author: f.author,
  };
}

function toCard(entry: Entry<CardSkeleton, undefined>): CreditCardOffer {
  const f = entry.fields;
  return {
    slug: f.slug,
    name: f.name,
    issuer: f.issuer,
    image: f.image,
    country: f.country,
    annualFee: { vi: f.annualFeeVi, en: f.annualFeeEn },
    cardType: { vi: f.cardTypeVi, en: f.cardTypeEn },
    headline: { vi: f.headlineVi, en: f.headlineEn },
    editorsTake: { vi: f.editorsTakeVi, en: f.editorsTakeEn },
    keyBenefits: { vi: f.keyBenefitsVi, en: f.keyBenefitsEn },
    elevatedBonus: f.elevatedBonus,
    applyUrl: f.applyUrl,
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
  };
}

function toAuthor(entry: Entry<AuthorSkeleton, undefined>): AuthorProfile {
  const f = entry.fields;
  return {
    name: f.name,
    photo: assetUrl(f.photo),
    bio: { vi: f.bioVi, en: f.bioEn },
  };
}

export async function fetchContentfulPosts(): Promise<BlogPost[]> {
  const res = await client!.getEntries<PostSkeleton>({ content_type: "blogPost", order: ["-fields.publishedAt"] });
  return res.items.map(toPost);
}

export async function fetchContentfulCreditCardOffers(): Promise<CreditCardOffer[]> {
  const res = await client!.getEntries<CardSkeleton>({ content_type: "creditCardOffer" });
  return res.items.map(toCard);
}

export async function fetchContentfulTransferBonuses(): Promise<TransferBonus[]> {
  const res = await client!.getEntries<BonusSkeleton>({ content_type: "transferBonus", order: ["fields.expiresAt"] });
  return res.items.map(toBonus);
}

export async function fetchContentfulAuthor(): Promise<AuthorProfile | null> {
  const res = await client!.getEntries<AuthorSkeleton>({ content_type: "author", limit: 1 });
  return res.items[0] ? toAuthor(res.items[0]) : null;
}

export type { Locale };
