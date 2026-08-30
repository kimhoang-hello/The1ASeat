import type { CreditCardOffer } from "./content/types";

/** Trang so sánh. Là route tĩnh nằm cạnh `/credit-cards/[slug]`, nên "so-sanh"
 *  không được phép trùng slug của một thẻ nào — Next ưu tiên đoạn tĩnh, và thẻ
 *  mang slug đó sẽ không vào được nữa. `assertNoSlugClash` bên dưới canh việc
 *  đó thay vì trông chờ ai nhớ. */
export const COMPARE_PATH = "/credit-cards/so-sanh";

/** Tên tham số trên URL. Tiếng Anh cho khớp với `?type=` và `?points=` đang
 *  dùng ở `/credit-cards`. */
export const COMPARE_PARAM = "cards";

/**
 * Ba là trần cứng, không phải con số cho đẹp. Bảng so sánh trên điện thoại
 * cuộn ngang: mỗi cột cần ~220px để đọc được tên thẻ và con số bonus, nên cột
 * thứ tư đẩy tổng chiều rộng qua mức mà người ta còn chịu vuốt. Hai là mức tối
 * thiểu — một thẻ thì đã có trang riêng của nó rồi.
 */
export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

/**
 * Đọc `?cards=slug-a,slug-b` thành danh sách thẻ THẬT, giữ nguyên thứ tự người
 * đọc viết ra.
 *
 * Bỏ qua trong im lặng: slug không tồn tại, slug trùng, và phần dư quá
 * `MAX_COMPARE`. Lý do không báo lỗi: URL này được chia sẻ và được sửa tay,
 * còn một thẻ bị gỡ khỏi Contentful thì link cũ vẫn nên mở ra bảng so sánh của
 * những thẻ còn lại thay vì một trang lỗi.
 */
export function parseCompareSlugs(
  raw: string | string[] | undefined,
  offers: CreditCardOffer[],
): CreditCardOffer[] {
  const value = Array.isArray(raw) ? raw.join(",") : raw;
  if (!value) return [];

  const bySlug = new Map(offers.map((offer) => [offer.slug, offer]));
  const picked: CreditCardOffer[] = [];
  const seen = new Set<string>();

  for (const slug of value.split(",")) {
    const key = slug.trim();
    if (!key || seen.has(key)) continue;
    const offer = bySlug.get(key);
    if (!offer) continue;
    seen.add(key);
    picked.push(offer);
    if (picked.length === MAX_COMPARE) break;
  }

  return picked;
}

/** URL của trang so sánh cho đúng những thẻ này. */
export function comparePath(slugs: string[]): string {
  if (slugs.length === 0) return COMPARE_PATH;
  return `${COMPARE_PATH}?${COMPARE_PARAM}=${slugs.slice(0, MAX_COMPARE).join(",")}`;
}

/** Đoạn đường dẫn mà không thẻ nào được phép mang làm slug. */
export const RESERVED_SLUG = COMPARE_PATH.slice("/credit-cards/".length);

export function slugClashMessage(): string {
  return (
    `Có thẻ mang slug "${RESERVED_SLUG}", trùng đoạn tĩnh của trang so sánh — ` +
    `Next phục vụ trang so sánh và trang chi tiết của thẻ đó không vào được. Đổi slug trong Contentful.`
  );
}

/**
 * Ném nếu có thẻ nào chiếm mất đường dẫn của trang so sánh.
 *
 * Gọi từ `generateStaticParams` của `/credit-cards/[slug]`, tức là chạy lúc
 * `next build` — KHÔNG gọi từ trang so sánh: trang đó `await searchParams` nên
 * là route động, thân nó không chạy lúc build và một `throw` trong đó không
 * bao giờ làm deploy đỏ.
 *
 * Cửa này chỉ bắt được thẻ đã có trong Contentful lúc build. Thẻ publish SAU
 * đó thì webhook chỉ revalidate chứ không chạy lại `generateStaticParams`, nên
 * `check-rebates` chạy hằng ngày canh thêm lượt nữa — chậm nhất một ngày, và
 * đỏ dai cho tới khi có người đổi slug.
 */
export function assertNoSlugClash(offers: CreditCardOffer[]): void {
  if (offers.some((offer) => offer.slug === RESERVED_SLUG)) throw new Error(slugClashMessage());
}
