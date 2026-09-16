/**
 * Đường dẫn của công cụ gợi ý, và đoạn tĩnh mà không thẻ nào được mang làm slug.
 *
 * Cùng luật với trang so sánh (`RESERVED_SLUG`) và trang Các thẻ tốt nhất: Next
 * ưu tiên đoạn TĨNH, nên một thẻ Contentful mang slug "goi-y" sẽ mất trang chi
 * tiết trong im lặng — danh sách, ô tìm kiếm và sitemap vẫn trỏ tới đúng URL
 * đó, chỉ là nó phục vụ công cụ gợi ý.
 *
 * Canh ở HAI chỗ, và cần cả hai (AGENTS.md): `generateStaticParams` của
 * `[slug]` chạy lúc build (bắt thẻ đã publish lúc deploy), còn `check-rebates`
 * đọc bản published hai lượt mỗi ngày (bắt thẻ publish SAU khi deploy).
 */

export const RECOMMENDER_PATH = "/credit-cards/goi-y";

export const RECOMMENDER_RESERVED_SLUG = RECOMMENDER_PATH.slice("/credit-cards/".length);

export function recommenderSlugClashMessage(): string {
  return (
    `Có thẻ mang slug "${RECOMMENDER_RESERVED_SLUG}", trùng đoạn tĩnh của công cụ gợi ý — ` +
    `Next phục vụ công cụ và trang chi tiết của thẻ này không vào được. Đổi slug trong Contentful.`
  );
}
