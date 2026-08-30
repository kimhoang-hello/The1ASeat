import type { Metadata } from "next";
import Link from "next/link";
import { BANK_ACCOUNTS } from "@/lib/bank-accounts";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";
import {
  BANK_COMPARE_PARAM,
  BANK_COMPARE_PATH,
  MAX_COMPARE,
  MIN_COMPARE,
  bankComparePathWithParams,
  parseBankCompareSlugs,
} from "@/lib/bank-compare";
import { PageHeader } from "@/components/layout/page-header";
import { ComparePicker } from "@/components/ui/compare-picker";
import { BankCompareTable } from "@/components/bank-accounts/bank-compare-table";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const t = translate("bankCompare");
const bank_t = translate("bankAccounts");
const next = translate("nextSteps");
const seo = translate("seo");

/**
 * Cặp gợi ý sẵn cho trạng thái chưa chọn gì.
 *
 * Lấy một tài khoản đầu tiên của MỖI ngân hàng rồi mới ghép cặp, chứ không cắt
 * thẳng `slice(0, 2)`: `BANK_ACCOUNTS` xếp theo ngân hàng, nên cắt thẳng ra hai
 * tài khoản Scotiabank® đặt cạnh nhau — đúng cú pháp nhưng là một so sánh gần
 * như vô nghĩa, và đó lại là thứ đầu tiên người đọc nhìn thấy trên trang.
 *
 * Suy từ dữ liệu nên thêm hoặc bớt một ngân hàng là gợi ý tự đổi theo, không
 * có slug nào chép tay để mà chết lặng.
 */
const ONE_PER_BANK = BANK_ACCOUNTS.filter(
  (account, i, all) => all.findIndex((other) => other.bank === account.bank) === i,
);

const SUGGESTED_PAIRS = [ONE_PER_BANK.slice(0, 2), ONE_PER_BANK.slice(2, 4)].filter(
  (pair) => pair.length === MIN_COMPARE,
);

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
  // Cùng lý do với trang so sánh thẻ: cặp gợi ý dựng lại URL nên phải thấy
  // mọi tham số đang có, không riêng `accounts`.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

              <NextSteps title={next("title")} className="pt-4">
                <StepLink
                  href="/bank-accounts"
                  label={next("bankAccountsLabel")}
                  description={next("bankAccountsDescription")}
                />
                <StepLink
                  href="/credit-cards"
                  label={next("cardsLabel")}
                  description={next("cardsDescription")}
                />
              </NextSteps>
            </>
          ) : (
            /* Cùng lý do với trang so sánh thẻ: picker là form client-side chứ
               không phải link, nên trạng thái mặc định của trang này không có
               một đường nội bộ nào cho người đọc lẫn crawler. */
            <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("needMore")}</p>

              {SUGGESTED_PAIRS.length > 0 && (
                <>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("suggestTitle")}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_PAIRS.map((pair) => (
                      <Link
                        key={pair.map((account) => account.slug).join("-")}
                        href={bankComparePathWithParams(
                          pair.map((account) => account.slug),
                          params,
                        )}
                        className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {pair.map((account) => account.name).join(" vs ")}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-6">
                <Link
                  href="/bank-accounts"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  &larr; {t("needMoreCta")}
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
