export type Locale = "vi" | "en";

export type Localized<T> = Record<Locale, T>;

export interface BlogPost {
  slug: string;
  category: Localized<string>;
  title: Localized<string>;
  excerpt: Localized<string>;
  body: Localized<string>;
  coverImage: string;
  publishedAt: string;
  minutesRead: number;
  author: string;
}

export interface CreditCardOffer {
  slug: string;
  name: string;
  issuer: string;
  image: string;
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
