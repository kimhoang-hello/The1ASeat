import { getCreditCardOffers, getPosts } from "@/lib/content";
import { BANK_ACCOUNTS, bankAccountPath } from "@/lib/bank-accounts";
import { BEST_CARDS_BASE, BEST_CARDS_CATEGORIES, bestCardsPath } from "@/lib/best-cards";
import { VIETNAM_ROUTES, VIETNAM_ROUTES_BASE, routeLabel, vietnamRoutePath } from "@/lib/award-routes";
import { BANK_ACCOUNTS_PUBLISHED, VIETNAM_ROUTES_PUBLISHED } from "@/lib/feature-flags";
import { absoluteUrl } from "@/lib/seo";
import { t } from "@/lib/t";

const site = t("site");
const seo = t("seo");

export const revalidate = 60;

/** Một dòng Markdown chỉ được một dòng: headline/excerpt từ Contentful có thể
 *  mang xuống dòng, và một dòng gãy làm vỡ cả danh sách. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function link(name: string, path: string, note?: string): string {
  // `[`/`]` trong tên (tiêu đề YouTube hay có) sẽ đóng nhãn link giữa chừng.
  const label = oneLine(name).replace(/\[/g, "(").replace(/\]/g, ")");
  return `- [${label}](${absoluteUrl(path)})${note ? `: ${oneLine(note)}` : ""}`;
}

/**
 * `/llms.txt` theo đề xuất llmstxt.org: bản đồ Markdown của site cho trợ lý
 * AI, cùng vai với sitemap cho crawler. Sitemap chỉ liệt kê URL; ở đây mỗi
 * mục mang tên và một câu nói trang đó trả lời câu hỏi gì, để một model đọc
 * một file là biết nên mở trang nào.
 *
 * Dựng từ CÙNG nguồn với sitemap và cùng cờ công bố — một mục chưa công bố
 * không được lộ ra ở đây trước khi nó có trên site.
 */
export async function GET() {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);
  const caOffers = offers.filter((offer) => offer.country !== "US");

  const sections: string[] = [
    `# ${site("name")}`,
    `> ${seo("homeDescription")}`,
    "Nội dung viết bằng tiếng Việt cho người Việt sống ở Canada. Số tiền viết `$` là CAD. Welcome offer và transfer bonus đổi thường xuyên — số trên từng trang thẻ đọc thẳng từ dữ liệu đang phục vụ, nên trang thẻ là nguồn đúng nhất.",
    [
      "## Công cụ và trang tổng hợp",
      link(seo("creditCardsTitle"), "/credit-cards", seo("creditCardsDescription")),
      link(seo("bestCardsTitle"), BEST_CARDS_BASE, seo("bestCardsDescription")),
      link(seo("transferPartnersTitle"), "/transfer-partners", seo("transferPartnersDescription")),
      link(seo("transferBonusesTitle"), "/transfer-bonuses", seo("transferBonusesDescription")),
      link(seo("awardChartsTitle"), "/award-flight-finder", seo("awardChartsDescription")),
      link(seo("calculatorTitle"), "/calculator", seo("calculatorDescription")),
      ...(BANK_ACCOUNTS_PUBLISHED
        ? [link(seo("bankAccountsTitle"), "/bank-accounts", seo("bankAccountsDescription"))]
        : []),
      ...(VIETNAM_ROUTES_PUBLISHED
        ? [link(seo("vietnamRoutesTitle"), VIETNAM_ROUTES_BASE, seo("vietnamRoutesDescription"))]
        : []),
    ].join("\n"),
    [
      "## Các thẻ tốt nhất theo mục đích",
      ...BEST_CARDS_CATEGORIES.map((category) =>
        link(category.titleVi, bestCardsPath(category.slug), category.metaDescriptionVi),
      ),
    ].join("\n"),
    [
      "## Thẻ tín dụng Canada",
      ...caOffers.map((offer) => link(offer.name, `/credit-cards/${offer.slug}`, offer.headline)),
    ].join("\n"),
    ...(VIETNAM_ROUTES_PUBLISHED
      ? [
          [
            "## Bay từ Canada về Việt Nam bằng điểm",
            ...VIETNAM_ROUTES.map((route) => link(routeLabel(route), vietnamRoutePath(route.slug))),
          ].join("\n"),
        ]
      : []),
    ...(BANK_ACCOUNTS_PUBLISHED
      ? [
          [
            "## Tài khoản ngân hàng Canada",
            ...BANK_ACCOUNTS.map((account) => link(account.name, bankAccountPath(account.slug))),
          ].join("\n"),
        ]
      : []),
    [
      "## Bài viết",
      // Tiêu đề tìm kiếm tiếng Việt khi có: bài video mang tên gốc tiếng Anh
      // của YouTube, còn `seoTitle` mới nói bằng tiếng Việt bài đó về gì.
      ...posts.map((post) =>
        link(post.seoTitle || post.title, `/blog/${post.slug}`, post.seoDescription || post.excerpt),
      ),
    ].join("\n"),
    ["## Khác", link(seo("aboutTitle"), "/about", seo("aboutDescription"))].join("\n"),
  ];

  return new Response(`${sections.join("\n\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
