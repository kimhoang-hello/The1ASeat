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
  country: CardCountry;
  annualFee: string;
  cardType: string;
  /**
   * Con số welcome bonus, đủ ngắn để làm số lớn trên thẻ ("110,000 điểm
   * Aeroplan®"). Bỏ trống ở thẻ không có welcome bonus — thẻ cashback bán tỷ
   * lệ hoàn tiền, không bán một khoản thưởng mở thẻ — và thẻ đó hiển thị phí
   * thường niên làm số lớn thay thế.
   */
  welcomeBonus?: string;
  headline: string;
  editorsTake: string;
  keyBenefits: string[];
  elevatedBonus: boolean;
  expiresAt?: string;
  /** Vắng khi giá trị trong Contentful không phải `http(s)` — xem `safeApplyUrl`.
   *  Chỗ nào render nút Apply thì phải xử lý trường hợp vắng, đừng ép kiểu. */
  applyUrl?: string;
  rebate?: string;
  /** `sys.updatedAt` của Contentful — dùng cho `lastmod` trong sitemap. Thẻ
   *  không có `publishedAt` như bài viết, nên đây là ngày duy nhất nói được
   *  trang này đổi lúc nào; welcome offer đổi thường xuyên hơn bài viết nhiều. */
  updatedAt?: string;
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
