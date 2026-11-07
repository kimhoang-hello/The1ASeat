export type BlogPostType = "post" | "video";

export interface BlogPost {
  slug: string;
  type: BlogPostType;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  /**
   * Thân bài cắt theo KHỐI CẤP CAO NHẤT của rich text — mỗi đoạn, mỗi tiêu đề,
   * mỗi danh sách là một chuỗi HTML riêng. `body` là đúng các khối này nối
   * lại, không sai khác một byte (đo trên cả 40 bài, 390 khối).
   *
   * Tồn tại để chèn được component React vào GIỮA thân bài — khối thẻ tín dụng
   * dưới đoạn đầu tiên nhắc tới thẻ đó. Cắt chuỗi HTML đã render bằng regex là
   * cách kia, và nó vỡ ngay khi đoạn văn chứa `</p>` lồng trong blockquote hay
   * list. Cắt từ chính cây rich text thì không có ca nào vỡ được.
   */
  bodyBlocks: string[];
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
  /**
   * Nước phát hành của hệ điểm nguồn. Điểm Amex® Canada và Amex® Mỹ là hai hệ
   * riêng, cùng một cái tên — bonus của bên này không dùng được cho bên kia.
   * `ca`: entry `transferBonus` trong Contentful. `us`: Daily Drop, qua
   * `us-transfer-bonuses.ts`.
   */
  region: "ca" | "us";
  fromProgram: string;
  toProgram: string;
  bonusPercent: number;
  expiresAt: string;
  /** Trang điều khoản chính chủ. Bonus Mỹ không có — nguồn chỉ là bảng tổng của Daily Drop. */
  url?: string;
  note?: string;
  /**
   * Ô của bảng Transfer Partners cùng nước mà bonus này rơi vào: cột hệ điểm
   * (`chase`, `capital-one`…) và tên các hàng chương trình, để lấy logo, tỷ lệ
   * thường và gắn nhãn vào ô. Nhiều hàng khi một đợt áp cho cả nhóm (Avios®:
   * British Airways®, Iberia®, Aer Lingus®); rỗng khi chương trình nhận chưa có
   * hàng trong bảng. Cả khối vắng (bonus Canada): tự khớp theo tên lúc hiển
   * thị (`describeBonus`).
   */
  partner?: { issuer: string; programs: string[] };
}

export interface AuthorProfile {
  name: string;
  photo: string;
  bio: string;
}
