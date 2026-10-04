import Link from "next/link";

export interface Crumb {
  label: string;
  href: string;
}

/**
 * Đường dẫn "Mục › Trang con" trên đầu trang sâu.
 *
 * Thay cho nhãn viết hoa nhỏ (eyebrow) từng nằm trên mọi tiêu đề (03/10/2026):
 * eyebrow chỉ nhắc lại tên mục mà menu đã sáng, còn breadcrumb vừa nói người
 * đọc đang ở đâu vừa bấm được để lùi một bậc. Chỉ liệt kê các bậc PHÍA TRÊN
 * trang hiện tại — tên trang đã là H1 ngay bên dưới.
 *
 * Phải khớp `breadcrumbJsonLd` của chính trang đó: hai cách nói cùng một vị trí
 * mà lệch nhau là Google và người đọc thấy hai cây khác nhau.
 *
 * Vùng chạm: link cao THẬT 44px (`min-h-11`), không nới ảo bằng `::before`.
 * Bản đầu nới ảo 12px mỗi phía, và Codex bắt: chữ phóng to 200% trên màn 375px
 * làm "Thẻ tín dụng › Các thẻ tốt nhất" gãy hai hàng, vùng nới của hàng dưới
 * phủ lên hàng trên — bấm "Thẻ tín dụng" lại sang "Các thẻ tốt nhất". Cao thật
 * thì hai hàng không bao giờ chồng nhau.
 */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        {items.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden>›</span>}
            <Link
              href={crumb.href}
              className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
            >
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
