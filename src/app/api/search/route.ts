import { NextResponse } from "next/server";
import { getCreditCardOffers, getPosts } from "@/lib/content";
import { BANK_ACCOUNTS, bankAccountPath, bankById } from "@/lib/bank-accounts";
import { t } from "@/lib/t";
import type { SearchItem } from "@/lib/search";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";

// The whole site is a few dozen cards and posts, so search ships the index
// rather than a query endpoint: the header fetches this once, the first time
// someone opens the search box, and filters it in the browser from then on.
// Keeping it out of the page HTML means the ~50 titles are only paid for by
// the readers who actually search.
export const revalidate = 60;

const nav = t("nav");
const footer = t("footer");

const PAGES: SearchItem[] = [
  { title: nav("creditCards"), href: "/credit-cards", kind: "page" },
  ...(BANK_ACCOUNTS_PUBLISHED
    ? [{ title: nav("bankAccounts"), href: "/bank-accounts", kind: "page" as const }]
    : []),
  { title: nav("blog"), href: "/blog", kind: "page" },
  { title: nav("awardCharts"), href: "/award-flight-finder", kind: "page" },
  { title: nav("calculator"), href: "/calculator", kind: "page" },
  { title: nav("transferBonuses"), href: "/transfer-bonuses", kind: "page" },
  { title: nav("transferPartners"), href: "/transfer-partners", kind: "page" },
  { title: nav("about"), href: "/about", kind: "page" },
  { title: footer("contact"), href: "/contact", kind: "page" },
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
const BANK_ACCOUNT_ITEMS: SearchItem[] = BANK_ACCOUNTS_PUBLISHED
  ? BANK_ACCOUNTS.map((account) => ({
      title: account.name,
      href: bankAccountPath(account.slug),
      kind: "account" as const,
      meta: bankById(account.bank).name,
    }))
  : [];

export async function GET() {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  const items: SearchItem[] = [
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
    ...PAGES,
  ];

  return NextResponse.json({ items });
}
