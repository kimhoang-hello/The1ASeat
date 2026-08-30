import type { Metadata } from "next";
import { BANK_ACCOUNTS } from "@/lib/bank-accounts";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";
import {
  BANK_COMPARE_PARAM,
  BANK_COMPARE_PATH,
  MAX_COMPARE,
  MIN_COMPARE,
  parseBankCompareSlugs,
} from "@/lib/bank-compare";
import { PageHeader } from "@/components/layout/page-header";
import { ComparePicker } from "@/components/ui/compare-picker";
import { BankCompareTable } from "@/components/bank-accounts/bank-compare-table";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const t = translate("bankCompare");
const bank_t = translate("bankAccounts");
const seo = translate("seo");

// Dữ liệu tài khoản nằm trong repo chứ không trong Contentful, nên trang này
// chỉ đổi khi có deploy. Vẫn đặt `revalidate` cho khớp phần còn lại của mục
// Ngân hàng, và để CDN Hostinger không giữ HTML tới một năm.
export const revalidate = 60;

export const metadata: Metadata = {
  ...pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Canonical về trang trần: mọi tổ hợp `?accounts=` là cùng một công cụ.
    path: BANK_COMPARE_PATH,
  }),
  // Mục Ngân hàng còn là bản nháp thì trang so sánh của nó cũng vậy — hai thứ
  // này không được phép lệch nhau, một trang so sánh index được trong khi
  // trang nó trỏ tới thì không là chuyện vô lý với cả Google lẫn người đọc.
  ...(BANK_ACCOUNTS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

export default async function CompareBankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ [BANK_COMPARE_PARAM]?: string | string[] }>;
}) {
  const params = await searchParams;
  const selected = parseBankCompareSlugs(params[BANK_COMPARE_PARAM]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbBankAccounts"), path: "/bank-accounts" },
        { name: seo("breadcrumbBankCompare"), path: BANK_COMPARE_PATH },
      ]),
    ],
  };

  return (
    <>
      {!BANK_ACCOUNTS_PUBLISHED && (
        <p className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 sm:px-6 lg:px-8">
          {bank_t("draftNotice")}
        </p>
      )}

      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page space-y-6">
          <ComparePicker
            path={BANK_COMPARE_PATH}
            param={BANK_COMPARE_PARAM}
            items={BANK_ACCOUNTS.map((account) => ({
              slug: account.slug,
              name: account.name,
            }))}
            selected={selected.map((account) => account.slug)}
            labels={{
              title: t("pickerTitle"),
              slots: Array.from({ length: MAX_COMPARE }, (_, i) =>
                t("pickerSlot", { index: i + 1 }),
              ),
              empty: t("pickerEmpty"),
            }}
          />

          {selected.length >= MIN_COMPARE ? (
            <>
              <BankCompareTable accounts={selected} />
              {/* Bảng có nút apply ở hàng cuối, nên công bố affiliate phải đứng
                  cùng trang — cùng luật với trang danh sách và trang chi tiết. */}
              <div className="rounded-xl border border-border bg-secondary p-4">
                <p className="text-sm font-semibold text-foreground">
                  {bank_t("disclaimerHeading")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {bank_t("disclaimer")}
                </p>
              </div>
              <OfferDisclosure />
            </>
          ) : (
            <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              {t("needMore")}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
