import type { CreditCardOffer } from "./content/types";
import {
  assertNoSlugClash as assertNoClash,
  compareHref,
  compareHrefWithParams,
  pickBySlugs,
} from "./compare";

export { MAX_COMPARE, MIN_COMPARE } from "./compare";

/** Trang so sánh thẻ. Là route tĩnh nằm cạnh `/credit-cards/[slug]`, nên
 *  "so-sanh" không được phép trùng slug của một thẻ nào — Next ưu tiên đoạn
 *  tĩnh, và thẻ mang slug đó sẽ không vào được nữa. */
export const COMPARE_PATH = "/credit-cards/so-sanh";

/** Tên tham số trên URL. Tiếng Anh cho khớp với `?type=` và `?points=` đang
 *  dùng ở `/credit-cards`. */
export const COMPARE_PARAM = "cards";

/** Đoạn đường dẫn mà không thẻ nào được phép mang làm slug. */
export const RESERVED_SLUG = COMPARE_PATH.slice("/credit-cards/".length);

export function parseCompareSlugs(
  raw: string | string[] | undefined,
  offers: CreditCardOffer[],
): CreditCardOffer[] {
  return pickBySlugs(raw, offers);
}

export function comparePath(slugs: string[]): string {
  return compareHref(COMPARE_PATH, COMPARE_PARAM, slugs);
}

/** `comparePath` giữ nguyên các tham số khác đang có trên URL — xem
 *  `compareHrefWithParams`. */
export function comparePathWithParams(
  slugs: string[],
  current: Record<string, string | string[] | undefined>,
): string {
  return compareHrefWithParams(COMPARE_PATH, COMPARE_PARAM, slugs, current);
}

export function slugClashMessage(): string {
  return (
    `Có thẻ mang slug "${RESERVED_SLUG}", trùng đoạn tĩnh của trang so sánh — ` +
    `Next phục vụ trang so sánh và trang chi tiết của thẻ đó không vào được. Đổi slug trong Contentful.`
  );
}

/**
 * Cửa canh lúc build. Chỉ bắt được thẻ đã có trong Contentful lúc đó; thẻ
 * publish SAU khi deploy thì webhook chỉ revalidate chứ không chạy lại
 * `generateStaticParams`, nên `check-rebates` canh thêm lượt nữa, hai lượt
 * mỗi ngày.
 */
export function assertNoSlugClash(offers: CreditCardOffer[]): void {
  assertNoClash(offers, RESERVED_SLUG, slugClashMessage());
}
