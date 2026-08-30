/**
 * Phần dùng chung của hai trang so sánh (thẻ tín dụng và tài khoản ngân hàng).
 *
 * Chỉ giữ ở đây những thứ THẬT SỰ giống nhau: trần số cột, cách đọc danh sách
 * slug từ URL, cách dựng lại URL. Đường dẫn, tên tham số và bảng so sánh thì
 * mỗi bên một kiểu và nằm ở module của bên đó — gộp nốt chúng vào đây chỉ tạo
 * ra một hàm nhận năm tham số để tránh viết hai dòng.
 */

/**
 * Ba là trần cứng, không phải con số cho đẹp. Bảng so sánh trên điện thoại
 * cuộn ngang: mỗi cột cần ~220px để đọc được tên và con số lớn, nên cột thứ tư
 * đẩy tổng chiều rộng qua mức mà người ta còn chịu vuốt. Đo tại chỗ: ba cột là
 * bảng 790px trong khung cuộn 341px.
 */
export const MAX_COMPARE = 3;

/** Hai là mức tối thiểu — một cái thì đã có trang riêng của nó rồi. */
export const MIN_COMPARE = 2;

/**
 * Đọc `?param=slug-a,slug-b` thành danh sách mục THẬT, giữ nguyên thứ tự người
 * đọc viết ra.
 *
 * Bỏ qua trong im lặng: slug không tồn tại, slug trùng, và phần dư quá
 * `MAX_COMPARE`. Lý do không báo lỗi: URL này được chia sẻ và được sửa tay,
 * còn một thẻ bị gỡ khỏi Contentful thì link cũ vẫn nên mở ra bảng so sánh của
 * những cái còn lại thay vì một trang lỗi.
 */
export function pickBySlugs<T extends { slug: string }>(
  raw: string | string[] | undefined,
  items: T[],
): T[] {
  const value = Array.isArray(raw) ? raw.join(",") : raw;
  if (!value) return [];

  const bySlug = new Map(items.map((item) => [item.slug, item]));
  const picked: T[] = [];
  const seen = new Set<string>();

  for (const slug of value.split(",")) {
    const key = slug.trim();
    if (!key || seen.has(key)) continue;
    const item = bySlug.get(key);
    if (!item) continue;
    seen.add(key);
    picked.push(item);
    if (picked.length === MAX_COMPARE) break;
  }

  return picked;
}

/** URL của một trang so sánh cho đúng những slug này. */
export function compareHref(path: string, param: string, slugs: string[]): string {
  if (slugs.length === 0) return path;
  return `${path}?${param}=${slugs.slice(0, MAX_COMPARE).join(",")}`;
}

/**
 * Như `compareHref`, nhưng GIỮ LẠI các tham số khác đang có trên URL.
 *
 * Dùng cho link dựng ở server (cặp gợi ý ở trạng thái chưa chọn gì), nơi không
 * có `window.location` để đọc. Cùng một luật với `ComparePicker` và
 * `bank-account-finder`: `utm_*` của chiến dịch dẫn người đọc tới đây phải sống
 * sót qua cú bấm, nếu không thì mọi lượt truy cập từ quảng cáo sẽ mất nguồn
 * ngay ở bước đầu tiên trên trang.
 *
 * Tham số so sánh cũ bị ghi đè chứ không cộng dồn — người đọc đang chọn một cặp
 * MỚI, không phải thêm vào cặp cũ.
 */
export function compareHrefWithParams(
  path: string,
  param: string,
  slugs: string[],
  current: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    if (key === param || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  if (slugs.length > 0) params.set(param, slugs.slice(0, MAX_COMPARE).join(","));

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Ném nếu có mục nào mang slug trùng đoạn đường dẫn tĩnh của trang so sánh.
 *
 * Gọi từ `generateStaticParams` của trang chi tiết, tức là chạy lúc
 * `next build` — KHÔNG gọi từ chính trang so sánh: trang đó `await
 * searchParams` nên là route động, thân nó không chạy lúc build và một `throw`
 * ở đó không bao giờ làm deploy đỏ.
 */
export function assertNoSlugClash(items: { slug: string }[], reserved: string, message: string): void {
  if (items.some((item) => item.slug === reserved)) throw new Error(message);
}
