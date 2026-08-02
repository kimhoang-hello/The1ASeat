export type BlogPostType = "post" | "video";

export interface BlogPost {
  slug: string;
  type: BlogPostType;
  category: string;
  title: string;
  excerpt: string;
  body: string;
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
  cardImage: string;
  country: CardCountry;
  annualFee: string;
  cardType: string;
  headline: string;
  editorsTake: string;
  keyBenefits: string[];
  elevatedBonus: boolean;
  expiresAt?: string;
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
  bio: string;
}
