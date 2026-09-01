import {
  bankAccountPath,
  bankById,
  formatMoney,
  formatRate,
  hasLiveBonus,
  type BankAccount,
} from "./bank-accounts";
import { absoluteUrl } from "./seo";
import { SITE_URL } from "./subscriber-email";
import { t } from "./t";

const seo = t("seo");
const bank_t = t("bankAccounts");

/**
 * Mô tả cho thẻ meta và cho JSON-LD, ghép từ chính số liệu của tài khoản.
 * Viết tay 29 đoạn mô tả thì đoạn thứ ba mươi sẽ bị quên, và một mô tả chép
 * lại của nhau còn tệ hơn là không có.
 */
export function bankAccountDescription(account: BankAccount): string {
  const parts = [account.name + ":"];
  // `hasLiveBonus` chứ không phải `bonusLabelVi` trần — cùng luật với `Headline`
  // trong `bank-account-finder`, hero của trang riêng và bảng so sánh.
  //
  // Chuỗi này đi thẳng vào `<meta name="description">` VÀ vào `description` của
  // JSON-LD BankAccount ngay bên dưới, tức là hai chỗ máy đọc. Chỉ kiểm nhãn
  // thôi thì sau ngày hết hạn, trang giấu con số đi đúng như phải làm nhưng
  // snippet trên Google và structured data vẫn hứa nó — chỗ duy nhất còn quảng
  // cáo một khoản tiền không lấy được nữa, và cũng là chỗ khó thấy nhất vì
  // không ai mở trang ra mà đọc thẻ meta. Cùng loại lỗi mà `isElevatedLive`
  // đã đóng bên thẻ tín dụng.
  //
  // Mốc gần nhất: Simplii hết hạn 30/09/2026, rồi 11 tài khoản nữa trong
  // tháng 10 và 11.
  if (hasLiveBonus(account) && account.bonusLabelVi) {
    parts.push(seo("bankAccountBonus", { bonus: account.bonusLabelVi }));
  }
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
/**
 * Trang hiện phí hàng tháng làm số lớn, còn `feeWaiverVi` chỉ là điều kiện
 * miễn bên dưới. Trước đây schema chỉ phát `feeWaiverVi`, nên tài khoản có phí
 * mà không có điều kiện miễn (KOHO Everything, $14.75/tháng) không nói gì về
 * phí cả, còn tài khoản có điều kiện miễn thì phát câu văn thay cho con số —
 * hai kiểu lệch khác nhau giữa dữ liệu máy đọc và dữ liệu người đọc. Ghép cả
 * hai, đúng thứ tự và đúng chữ mà trang đang hiện.
 */
function feesAndCommissions(account: BankAccount): string {
  const fee =
    account.monthlyFee === 0 ? bank_t("free") : formatMoney(account.monthlyFee);
  const monthly = `${bank_t("monthlyFee")}: ${fee}`;
  return account.feeWaiverVi ? `${monthly} — ${account.feeWaiverVi}` : monthly;
}

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
    feesAndCommissionsSpecification: feesAndCommissions(account),
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
