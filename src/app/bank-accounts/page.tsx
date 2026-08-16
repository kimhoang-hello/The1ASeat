import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BankAccountFinder } from "@/components/bank-accounts/bank-account-finder";
import { JsonLd } from "@/components/seo/json-ld";
import { BANK_ACCOUNTS, bankById } from "@/lib/bank-accounts";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const bank_t = t("bankAccounts");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("bankAccountsTitle"),
  description: seo("bankAccountsDescription"),
  path: "/bank-accounts",
});

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
      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={bank_t("eyebrow")} title={bank_t("title")} subtitle={bank_t("subtitle")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <BankAccountFinder />
      </section>
    </>
  );
}
