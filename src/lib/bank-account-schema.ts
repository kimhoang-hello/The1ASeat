import {
  bankAccountPath,
  bankById,
  formatMoney,
  formatRate,
  type BankAccount,
} from "./bank-accounts";
import { absoluteUrl } from "./seo";
import { SITE_URL } from "./subscriber-email";
import { t } from "./t";

const seo = t("seo");

/**
 * Mô tả cho thẻ meta và cho JSON-LD, ghép từ chính số liệu của tài khoản.
 * Viết tay 29 đoạn mô tả thì đoạn thứ ba mươi sẽ bị quên, và một mô tả chép
 * lại của nhau còn tệ hơn là không có.
 */
export function bankAccountDescription(account: BankAccount): string {
  const parts = [account.name + ":"];
  if (account.bonusLabelVi) parts.push(seo("bankAccountBonus", { bonus: account.bonusLabelVi }));
  if (account.interestRate !== undefined) {
    parts.push(seo("bankAccountRate", { rate: formatRate(account.interestRate) }));
  }
  // "Monthly fee miễn phí" đọc như một lỗi ghép chuỗi; không phí thì nói
  // thẳng là không mất phí.
  parts.push(
    account.monthlyFee === 0
      ? seo("bankAccountNoFee")
      : seo("bankAccountFee", { fee: formatMoney(account.monthlyFee) }),
  );
  parts.push(seo("bankAccountTail"));
  return parts.join(" ");
}

/**
 * schema.org/BankAccount cho một tài khoản. Dùng chung giữa trang danh sách
 * (lồng trong ItemList) và trang riêng của tài khoản, cùng lý do như
 * `credit-card-schema.ts`: hai chỗ mô tả một thứ thì phải mô tả giống nhau,
 * và cách chắc chắn nhất là chỉ viết một lần.
 *
 * `url` trỏ về trang trên site này chứ không phải trang ngân hàng — `url` của
 * một entity là trang mô tả nó, và trang mô tả tài khoản này là trang của
 * mình. Link ra ngân hàng nằm ở `offers.url`, đúng chỗ mà trang thẻ tín dụng
 * đặt link apply.
 */
export function bankAccountJsonLd(account: BankAccount) {
  const url = absoluteUrl(bankAccountPath(account.slug));
  const bank = bankById(account.bank);
  const seller = { "@type": "BankOrCreditUnion", name: bank.name };

  return {
    "@type": "BankAccount",
    "@id": `${url}#product`,
    name: account.name,
    description: bankAccountDescription(account),
    url,
    provider: seller,
    ...(account.feeWaiverVi && { feesAndCommissionsSpecification: account.feeWaiverVi }),
    ...(account.interestRate !== undefined && { interestRate: account.interestRate }),
    offers: {
      "@type": "Offer",
      url: account.affiliateUrl ?? account.url,
      availability: "https://schema.org/InStock",
      seller,
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
