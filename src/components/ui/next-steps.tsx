import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";

/**
 * Khối "đi tiếp từ đây" dùng chung.
 *
 * Bản đầu tiên nằm riêng trong `card-next-steps.tsx`, dựng cho trang chi tiết
 * thẻ. Rà lại toàn site ngày 30/08/2026 thì bảy trang khác cũng cụt y hệt —
 * calculator, award finder, transfer partners, transfer bonuses, contact và
 * hai trang so sánh — nên phần vỏ được tách ra đây để tám chỗ dùng chung một
 * hình dạng, thay vì tám lần chép lại cùng một `<li><Link>`.
 *
 * Luật của bản gốc giữ nguyên và áp cho mọi chỗ dùng: mọi đường đều suy ra từ
 * dữ liệu đang có, và đường nào không có thật thì KHÔNG hiện. Thà ít hơn là
 * dẫn người đọc tới một trang không nói gì về thứ họ đang xem.
 */
export function StepLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary"
      >
        <span>
          <span className="block font-semibold text-foreground">{label}</span>
          {description && (
            <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
          )}
        </span>
        <ArrowRight size={18} className="shrink-0 text-primary" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * `headingLevel` và `compact` là HAI thứ khác nhau, cố ý tách rời.
 *
 * Bản đầu buộc cỡ chữ vào cấp heading, nên chỗ nào muốn tiêu đề nhỏ là phải
 * khai h3 — và trên `/calculator` điều đó tạo ra outline h1 → h3, nhảy cóc
 * một cấp ngay trên trang vừa sửa cho hết cụt (trang đó không có h2 nào khác:
 * `PageHeader` cho h1, còn hộp calculator không có tiêu đề). Người dùng screen
 * reader nhảy theo cấp heading sẽ hụt đúng khối điều hướng này.
 *
 * Giờ cấp heading đi theo cấu trúc thật của trang, còn `compact` chỉ đổi cỡ
 * chữ. Mặc định h2 là đúng cho mọi chỗ đang dùng: ở đâu khối này cũng là một
 * mục ngang hàng nằm thẳng dưới h1 của trang.
 */
export function NextSteps({
  title,
  headingLevel = "h2",
  compact = false,
  className = "",
  children,
}: {
  title: string;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Heading = headingLevel;

  return (
    <section className={className}>
      <Heading
        className={`font-display font-bold text-foreground ${compact ? "text-base" : "text-xl"}`}
      >
        {title}
      </Heading>
      <ul className="mt-3 space-y-2">{children}</ul>
    </section>
  );
}
