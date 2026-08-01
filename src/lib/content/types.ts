export type Locale = "vi" | "en";

export type Localized<T> = Record<Locale, T>;

export type BlogPostType = "post" | "video";

export interface BlogPost {
  slug: string;
  type: BlogPostType;
  category: Localized<string>;
  title: Localized<string>;
  excerpt: Localized<string>;
  body: Localized<string>;
  coverImage: string;
  videoUrl?: string;
  publishedAt: string;
  minutesRead: number;
  author: string;
}

export type CardCountry = "US" | "CA";

export interface CreditCardOffer {
  slug: string;
  name: string;
  issuer: string;
  image: string;
  country: CardCountry;
  annualFee: Localized<string>;
  cardType: Localized<string>;
  headline: Localized<string>;
  editorsTake: Localized<string>;
  keyBenefits: Localized<string[]>;
  elevatedBonus: boolean;
  applyUrl: string;
}

export interface TransferBonus {
  slug: string;
  fromProgram: string;
  toProgram: string;
  bonusPercent: number;
  expiresAt: string;
  url: string;
}

export interface AuthorProfile {
  name: string;
  photo: string;
  bio: Localized<string>;
}
