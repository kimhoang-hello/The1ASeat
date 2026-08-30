import { NextResponse } from "next/server";
import { getCreditCardOffers, getPosts } from "@/lib/content";
import {
  BANK_ACCOUNTS,
  bankAccountPath,
  bankById,
  type AccountKind,
  type AccountTag,
} from "@/lib/bank-accounts";
import { t } from "@/lib/t";
import type { SearchItem } from "@/lib/search";
import { BANK_ACCOUNTS_PUBLISHED, START_HERE_PUBLISHED } from "@/lib/feature-flags";
import { COMPARE_PATH } from "@/lib/card-compare";

// The whole site is a few dozen cards and posts, so search ships the index
// rather than a query endpoint: the header fetches this once, the first time
// someone opens the search box, and filters it in the browser from then on.
// Keeping it out of the page HTML means the ~50 titles are only paid for by
// the readers who actually search.
export const revalidate = 60;

const nav = t("nav");
const footer = t("footer");
const offers = t("offers");
const startHere = t("startHere");

/**
 * `keywords` là các chữ tiếng Việt người đọc gõ nhưng không có trong tên trang.
 * Bốn công cụ cố ý giữ tên tiếng Anh theo đúng quy ước jargon của site
 * ("Points Calculator", "Transfer Bonus", "Transfer Partners", "Award Flight
 * Finder"), nên trước đây gõ "tính điểm" hay "chuyển điểm" không ra gì cả.
 * Chuỗi này chỉ để khớp, không hiện ra ở kết quả — xem `SearchItem.keywords`.
 *
 * Viết cả có dấu lẫn không dấu là thừa: `slugifyVi` bỏ dấu ở cả hai vế trước
 * khi so, nên "tính điểm" ở đây đã tự khớp với "tinh diem" người ta gõ.
 */
const PAGES: SearchItem[] = [
  ...(START_HERE_PUBLISHED
    ? [
        {
          title: startHere("title"),
          href: "/bat-dau",
          kind: "page" as const,
          keywords: "bắt đầu người mới nhập môn cơ bản mới sang canada hướng dẫn",
        },
      ]
    : []),
  {
    title: nav("creditCards"),
    href: "/credit-cards",
    kind: "page",
    keywords: "credit card mở thẻ apply thẻ",
  },
  ...(BANK_ACCOUNTS_PUBLISHED
    ? [
        {
          title: nav("bankAccounts"),
          href: "/bank-accounts",
          kind: "page" as const,
          keywords: "tài khoản chequing savings tiết kiệm chi tiêu bank account",
        },
      ]
    : []),
  { title: nav("blog"), href: "/blog", kind: "page", keywords: "bài viết review video" },
  {
    title: nav("awardCharts"),
    href: "/award-flight-finder",
    kind: "page",
    keywords: "tìm chuyến bay đổi điểm vé thưởng bao nhiêu miles award chart",
  },
  {
    title: nav("calculator"),
    href: "/calculator",
    kind: "page",
    keywords: "tính điểm giá trị mỗi điểm quy đổi",
  },
  {
    title: nav("transferBonuses"),
    href: "/transfer-bonuses",
    kind: "page",
    keywords: "chuyển điểm khuyến mãi thưởng đang chạy",
  },
  {
    title: nav("transferPartners"),
    href: "/transfer-partners",
    kind: "page",
    keywords: "chuyển điểm tỷ lệ đối tác hãng bay khách sạn",
  },
  {
    // Công cụ thứ năm của site. Bốn cái kia đều nằm trong ô tìm kiếm, nên
    // thiếu cái này là gõ đúng tên nó cũng không ra gì.
    title: offers("compare"),
    href: COMPARE_PATH,
    kind: "page",
    keywords: "so sánh đối chiếu cạnh nhau compare vs thẻ nào tốt hơn",
  },
  { title: nav("about"), href: "/about", kind: "page", keywords: "về chúng tôi tác giả" },
  {
    title: footer("contact"),
    href: "/contact",
    kind: "page",
    keywords: "email hợp tác quảng cáo góp ý",
  },
];

/**
 * Từng tài khoản ngân hàng, không phải chỉ trang danh sách. Trang danh sách đã
 * nằm trong `PAGES` từ trước, nhưng nó chỉ tìm được bằng chữ "Ngân hàng" — gõ
 * "KOHO", "Simplii" hay "RBC Advantage" thì không ra gì, dù cả 29 trang đều đã
 * prerender và đã có trong sitemap.
 *
 * Cùng cái cờ với mục trang danh sách bên dưới: trang nháp thì không lộ ra ở
 * bất cứ chỗ nào người đọc tình cờ bấm được, và ô tìm kiếm là một trong số đó
 * (xem `feature-flags.ts`).
 */
/**
 * Tên tài khoản toàn tiếng Anh ("Tangerine® Savings Account"), và hàng chip
 * trên trang cũng giữ "Chequing"/"Savings"/"Student" theo quy ước jargon — nên
 * gõ "tiết kiệm" hay "sinh viên" không ra gì. Hai bảng dưới là bản tiếng Việt
 * của đúng hai trường `kind` và `tags` đã có sẵn, không phải chú thích viết tay
 * cho từng tài khoản: thêm một tài khoản mới không phải nhớ thêm gì.
 */
const KIND_KEYWORDS: Record<AccountKind, string> = {
  chequing: "chi tiêu thanh toán",
  savings: "tiết kiệm lãi suất",
};

const TAG_KEYWORDS: Record<AccountTag, string> = {
  newcomer: "người mới định cư nhập cư",
  student: "sinh viên du học sinh",
};

const BANK_ACCOUNT_ITEMS: SearchItem[] = BANK_ACCOUNTS_PUBLISHED
  ? BANK_ACCOUNTS.map((account) => ({
      title: account.name,
      href: bankAccountPath(account.slug),
      kind: "account" as const,
      meta: bankById(account.bank).name,
      keywords: [
        "tài khoản ngân hàng",
        KIND_KEYWORDS[account.kind],
        ...account.tags.map((tag) => TAG_KEYWORDS[tag]),
      ].join(" "),
    }))
  : [];

export async function GET() {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  // PAGES đứng đầu vì `searchItems` xếp hạng theo tiêu đề, và sort của JS ổn
  // định — nên thứ tự mảng này quyết định ai đứng trước khi cùng hạng. Gõ "tài
  // khoản" hay "tiết kiệm" chỉ khớp `keywords`, tức cả 29 trang con lẫn trang
  // danh sách đều cùng hạng cuối; để PAGES sau thì trang danh sách rơi khỏi 8
  // kết quả hiển thị, dù nó mới là chỗ người đọc muốn tới.
  const items: SearchItem[] = [
    ...PAGES,
    ...offers.map((offer) => ({
      title: offer.name,
      href: `/credit-cards/${offer.slug}`,
      kind: "card" as const,
      meta: `${offer.issuer} ${offer.cardType}`,
    })),
    ...BANK_ACCOUNT_ITEMS,
    ...posts.map((post) => ({
      title: post.title,
      href: `/blog/${post.slug}`,
      kind: "post" as const,
      meta: post.category,
    })),
  ];

  return NextResponse.json({ items });
}
