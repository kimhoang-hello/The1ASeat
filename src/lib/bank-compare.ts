import { BANK_ACCOUNTS, type BankAccount } from "./bank-accounts";
import { BANK_COMPARE_PATH, BANK_COMPARE_PARAM, BANK_RESERVED_SLUG } from "./bank-compare-path";
import {
  assertNoSlugClash as assertNoClash,
  compareHref,
  compareHrefWithParams,
  pickBySlugs,
} from "./compare";

export { MAX_COMPARE, MIN_COMPARE } from "./compare";

// Ba hằng số này sống ở `bank-compare-path.ts`, một module KHÔNG import gì —
// xem chú thích ở đó. Chúng vẫn được re-export ở đây để mọi nơi đang đọc
// chúng từ `bank-compare` không phải đổi; chỗ nào chỉ cần đường dẫn (menu,
// sitemap) thì import thẳng module kia để khỏi kéo theo `BANK_ACCOUNTS`.
export {
  BANK_COMPARE_PATH,
  BANK_COMPARE_PARAM,
  BANK_RESERVED_SLUG,
} from "./bank-compare-path";

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
