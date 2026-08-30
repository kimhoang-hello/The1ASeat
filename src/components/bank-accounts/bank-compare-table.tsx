import Link from "next/link";
import {
  bankAccountPath,
  bankById,
  formatIsoDate,
  formatMoney,
  formatRate,
  hasLiveBonus,
  type BankAccount,
} from "@/lib/bank-accounts";
import { ApplyButton } from "@/components/ui/apply-button";
import { t as translate } from "@/lib/t";

const t = translate("bankCompare");
const bank_t = translate("bankAccounts");
const offers_t = translate("offers");

/** Ô trống. Dấu gạch một mình không nói gì với screen reader. */
function Empty() {
  return (
    <>
      <span aria-hidden>{offers_t("noValue")}</span>
      <span className="sr-only">{offers_t("noValueLabel")}</span>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-border align-top">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card px-4 py-4 text-left text-sm font-semibold text-foreground/80"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

/**
 * Cùng khuôn với bảng so sánh thẻ tín dụng: cột hạng mục dính bên trái, phần
 * còn lại cuộn ngang, `th scope="row"` để người dùng screen reader biết con số
 * đang nghe thuộc hàng nào.
 *
 * Khác ở chỗ con số nào là con số đáng nhìn. Thẻ tín dụng bán welcome bonus;
 * tài khoản ngân hàng thì tuỳ loại — tài khoản chi tiêu bán bonus, tài khoản
 * tiết kiệm bán lãi suất, còn lại bán monthly fee. Nên bảng này in cả ba, và ô
 * nào không có thì nói thẳng là không có thay vì để trống.
 */
export function BankCompareTable({ accounts }: { accounts: BankAccount[] }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground lg:hidden">{t("swipeHint")}</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {/* `table-fixed` và bề rộng tối thiểu đặt ở cấp bảng — cùng lý do như
            bảng so sánh thẻ: cột nào có dòng quyền lợi dài hơn sẽ tự giành
            phần rộng hơn nếu để bảng co theo nội dung. */}
        <table
          className={`w-full table-fixed border-collapse text-sm ${
            accounts.length > 2 ? "min-w-[790px]" : "min-w-[570px]"
          }`}
        >
          <caption className="sr-only">{accounts.map((a) => a.name).join(" · ")}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-[130px] min-w-[130px] bg-card px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("rowAttribute")}
              </th>
              {accounts.map((account) => (
                <th key={account.slug} scope="col" className="px-4 py-4 text-left align-top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bankById(account.bank).logo}
                    alt=""
                    className="h-10 w-28 rounded-lg border border-border bg-white object-contain p-1.5"
                  />
                  <Link
                    href={bankAccountPath(account.slug)}
                    className="mt-3 block font-display text-base font-bold leading-snug text-primary hover:underline"
                  >
                    {account.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <Row label={bank_t("welcomeBonus")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4">
                  {hasLiveBonus(account) && account.bonusLabelVi ? (
                    <>
                      <span className="font-display text-lg font-extrabold leading-tight text-primary">
                        {account.bonusLabelVi}
                      </span>
                      {account.bonusExpiresOn && (
                        <span className="mt-1 block text-xs text-amber-700">
                          {offers_t("expiresOn")} {formatIsoDate(account.bonusExpiresOn)}
                        </span>
                      )}
                    </>
                  ) : (
                    <Empty />
                  )}
                </td>
              ))}
            </Row>

            <Row label={bank_t("monthlyFee")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4 text-foreground/90">
                  {account.monthlyFee === 0 ? bank_t("free") : formatMoney(account.monthlyFee)}
                </td>
              ))}
            </Row>

            <Row label={t("rowFeeWaiver")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4 text-foreground/90">
                  {account.feeWaiverVi ?? <Empty />}
                </td>
              ))}
            </Row>

            <Row label={bank_t("interestRate")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4 text-foreground/90">
                  {account.interestRate !== undefined ? (
                    <>
                      <span className="font-display text-lg font-extrabold leading-tight text-primary">
                        {formatRate(account.interestRate)}
                      </span>
                      {account.regularRate !== undefined && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {bank_t("regularRate", { rate: formatRate(account.regularRate) })}
                        </span>
                      )}
                    </>
                  ) : (
                    // "Không công bố" chứ không phải ô trống: ngân hàng không
                    // đưa con số là một thông tin, không phải chỗ thiếu dữ liệu.
                    <span className="text-muted-foreground">{bank_t("noRate")}</span>
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowPromo")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4 text-foreground/90">
                  {account.promoNoteVi ?? account.noRateNoteVi ?? <Empty />}
                </td>
              ))}
            </Row>

            <Row label={offers_t("rebate")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4">
                  {account.rebate ? (
                    <span className="font-semibold text-emerald-700">{account.rebate}</span>
                  ) : (
                    <Empty />
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowKind")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4 text-foreground/90">
                  {bank_t(account.kind === "chequing" ? "kindChequing" : "kindSavings")}
                </td>
              ))}
            </Row>

            <Row label={t("rowBenefits")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4">
                  {account.keyBenefitsVi.length > 0 ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-foreground/90">
                      {account.keyBenefitsVi.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty />
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowApply")}>
              {accounts.map((account) => (
                <td key={account.slug} className="px-4 py-4">
                  <ApplyButton
                    href={account.affiliateUrl ?? account.url}
                    affiliate={Boolean(account.affiliateUrl)}
                    className="w-full text-center"
                  />
                  <Link
                    href={bankAccountPath(account.slug)}
                    className="mt-2 block text-center text-sm font-semibold text-primary hover:underline"
                  >
                    {t("viewAccount")}
                  </Link>
                </td>
              ))}
            </Row>
          </tbody>
        </table>
      </div>
    </div>
  );
}
