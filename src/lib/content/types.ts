export type BlogPostType = "post" | "video";

export interface BlogPost {
  slug: string;
  type: BlogPostType;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  coverPhoto?: string;
  videoUrl?: string;
  publishedAt: string;
  /** Contentful's sys.updatedAt, used for dateModified in JSON-LD. */
  updatedAt?: string;
  minutesRead: number;
  author: string;
  /** Optional search-result title override; falls back to `title`. */
  seoTitle?: string;
  /** Optional meta-description override; falls back to `excerpt`. */
  seoDescription?: string;
}

export type CardCountry = "US" | "CA";

export interface CreditCardOffer {
  slug: string;
  name: string;
  issuer: string;
  image: string;
  cardImage: string;
  /** Width ÷ height of `cardImage`, used to fit the apply link to the artwork. */
  cardImageAspect?: number;
  country: CardCountry;
  annualFee: string;
  cardType: string;
  headline: string;
  editorsTake: string;
  keyBenefits: string[];
  elevatedBonus: boolean;
  expiresAt?: string;
  applyUrl: string;
  rebate?: string;
}

export interface TransferBonus {
  slug: string;
  fromProgram: string;
  toProgram: string;
  bonusPercent: number;
  expiresAt: string;
  url: string;
  note?: string;
}

export interface AuthorProfile {
  name: string;
  photo: string;
  bio: string;
}
