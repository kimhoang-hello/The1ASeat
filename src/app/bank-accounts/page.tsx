import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BankAccountFinder } from "@/components/bank-accounts/bank-account-finder";
import { JsonLd } from "@/components/seo/json-ld";
import { BANK_ACCOUNTS, bankAccountPath } from "@/lib/bank-accounts";
import { bankAccountJsonLd } from "@/lib/bank-account-schema";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const bank_t = t("bankAccounts");
const seo = t("seo");

export const metadata: Metadata = {
  ...pageMetadata({
    title: seo("bankAccountsTitle"),
    description: seo("bankAccountsDescription"),
    path: "/bank-accounts",
  }),
  // Chưa công bố thì cũng không cho Google index — một bản nháp lọt lên kết
  // quả tìm kiếm rồi mới sửa còn khó gỡ hơn là không bao giờ lên.
  ...(BANK_ACCOUNTS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

// Không có dòng này thì Next trả `s-maxage=31536000` và CDN của Hostinger giữ
// bản cũ tới một năm — đã bắt được đúng lỗi đó: sau khi thêm 4 tài khoản BMO®,
// trang vẫn phục vụ bản HTML cũ chỉ có 6 tài khoản.
export const revalidate = 60;

export default function BankAccountsPage() {
  // Các bộ lọc chỉ đổi query string và đều canonical về /bank-accounts, nên
  // ItemList mô tả toàn bộ danh sách chứ không phải lát cắt đang hiển thị —
  // cùng cách trang thẻ tín dụng đang làm.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbBankAccounts"), path: "/bank-accounts" }]),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/bank-accounts")}#collection`,
        name: seo("bankAccountsTitle"),
        description: seo("bankAccountsDescription"),
        url: absoluteUrl("/bank-accounts"),
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: BANK_ACCOUNTS.length,
          itemListElement: BANK_ACCOUNTS.map((account, index) => ({
            "@type": "ListItem",
            position: index + 1,
            // Trang của tài khoản trên site này, không phải trang ngân hàng —
            // một ItemList trỏ ra ngoài thì không mô tả trang này nữa.
            url: absoluteUrl(bankAccountPath(account.slug)),
            item: bankAccountJsonLd(account),
          })),
        },
      },
    ],
  };

  return (
    <>
      {/* Trang chưa công bố vẫn vào được bằng URL trực tiếp, nên nó phải tự
          nói ra điều đó — không ai đọc nhầm bản nháp thành nội dung chính
          thức. Dải này biến mất cùng lúc với việc bật cờ. */}
      {!BANK_ACCOUNTS_PUBLISHED && (
        <p className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 sm:px-6 lg:px-8">
          {bank_t("draftNotice")}
        </p>
      )}

      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={bank_t("eyebrow")} title={bank_t("title")} subtitle={bank_t("subtitle")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <BankAccountFinder />
      </section>
    </>
  );
}
