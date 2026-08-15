import { NextResponse } from "next/server";
import { getCreditCardOffers, getPosts } from "@/lib/content";
import { t } from "@/lib/t";
import type { SearchItem } from "@/lib/search";

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
  { title: nav("blog"), href: "/blog", kind: "page" },
  { title: nav("awardCharts"), href: "/award-flight-finder", kind: "page" },
  { title: nav("calculator"), href: "/calculator", kind: "page" },
  { title: nav("transferBonuses"), href: "/transfer-bonuses", kind: "page" },
  { title: nav("transferPartners"), href: "/transfer-partners", kind: "page" },
  { title: nav("about"), href: "/about", kind: "page" },
  { title: footer("contact"), href: "/contact", kind: "page" },
];

export async function GET() {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  const items: SearchItem[] = [
    ...offers.map((offer) => ({
      title: offer.name,
      href: `/credit-cards/${offer.slug}`,
      kind: "card" as const,
      meta: `${offer.issuer} ${offer.cardType}`,
    })),
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
