// File riêng, không import gì: `us-credit-cards.ts` cần hàm này mà vẫn phải
// import được trần trong `node --test`, còn `card-next-steps.ts` kéo theo cả
// dữ liệu ngân hàng và Contentful.

/**
 * `limit` phần tử đứng ngay sau `self` trong `items`, vòng lại đầu khi hết —
 * và không bao giờ trả về chính `self`.
 *
 * Dùng chung cho thẻ và cho tài khoản ngân hàng (`bank-next-steps.ts` gọi lại
 * hàm này). Tính chất cần ở cả hai chỗ: với `n` phần tử và `limit >= 1`, mỗi
 * phần tử được đúng `min(limit, n - 1)` phần tử khác trỏ vào — không có phần
 * tử nào bị bỏ lại, đó chính là điều mà cách "lấy `limit` phần tử đầu danh
 * sách" không bảo đảm được.
 */
export function ringAfter<T>(items: T[], isSelf: (item: T) => boolean, limit: number): T[] {
  const index = items.findIndex(isSelf);
  if (index < 0) return items.slice(0, limit);

  const out: T[] = [];
  for (let step = 1; step < items.length && out.length < limit; step++) {
    out.push(items[(index + step) % items.length]);
  }
  return out;
}
