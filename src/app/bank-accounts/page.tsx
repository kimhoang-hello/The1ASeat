import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BankAccountFinder } from "@/components/bank-accounts/bank-account-finder";
import { JsonLd } from "@/components/seo/json-ld";
import { BANK_ACCOUNTS, bankById } from "@/lib/bank-accounts";
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
            item: {
              "@type": "BankAccount",
              name: account.name,
              url: account.url,
              provider: {
                "@type": "BankOrCreditUnion",
                name: bankById(account.bank).name,
              },
              feesAndCommissionsSpecification: account.feeWaiverVi,
              ...(account.interestRate !== undefined && { interestRate: account.interestRate }),
            },
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
