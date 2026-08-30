import { BANK_ACCOUNTS, type BankAccount } from "./bank-accounts";
import {
  assertNoSlugClash as assertNoClash,
  compareHref,
  compareHrefWithParams,
  pickBySlugs,
} from "./compare";

export { MAX_COMPARE, MIN_COMPARE } from "./compare";

/** Trang so sánh tài khoản. Route tĩnh nằm cạnh `/bank-accounts/[slug]`. */
export const BANK_COMPARE_PATH = "/bank-accounts/so-sanh";

/** Tên tham số trên URL, khớp với `?bank=`/`?filter=`/`?sort=` của trang danh
 *  sách: tiếng Anh, số nhiều. */
export const BANK_COMPARE_PARAM = "accounts";

/** Đoạn đường dẫn mà không tài khoản nào được phép mang làm slug. */
export const BANK_RESERVED_SLUG = BANK_COMPARE_PATH.slice("/bank-accounts/".length);

export function parseBankCompareSlugs(raw: string | string[] | undefined): BankAccount[] {
  return pickBySlugs(raw, BANK_ACCOUNTS);
}

export function bankComparePath(slugs: string[]): string {
  return compareHref(BANK_COMPARE_PATH, BANK_COMPARE_PARAM, slugs);
}

/** `bankComparePath` giữ nguyên các tham số khác đang có trên URL. */
export function bankComparePathWithParams(
  slugs: string[],
  current: Record<string, string | string[] | undefined>,
): string {
  return compareHrefWithParams(BANK_COMPARE_PATH, BANK_COMPARE_PARAM, slugs, current);
}

/**
 * Khác thẻ tín dụng ở một chỗ quan trọng: tài khoản ngân hàng nằm trong
 * `src/lib/bank-accounts.ts` chứ không nằm trong Contentful, nên slug chỉ đổi
 * được bằng một lần sửa file và deploy. Cửa canh lúc build vì thế là ĐỦ — không
 * có đường nào thêm một tài khoản vào site mà không đi qua `next build`, nên
 * không cần lượt canh hằng ngày như bên thẻ.
 */
export function bankSlugClashMessage(): string {
  return (
    `Có tài khoản mang slug "${BANK_RESERVED_SLUG}", trùng đoạn tĩnh của trang so sánh — ` +
    `Next phục vụ trang so sánh và trang chi tiết của tài khoản đó không vào được. ` +
    `Đổi slug trong src/lib/bank-accounts.ts.`
  );
}

export function assertNoBankSlugClash(): void {
  assertNoClash(BANK_ACCOUNTS, BANK_RESERVED_SLUG, bankSlugClashMessage());
}
