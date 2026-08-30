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
 * `headingLevel` vì khối này xuất hiện ở những độ sâu khác nhau: trên trang chi
 * tiết thẻ nó là mục ngang hàng với "Quyền lợi chính" (h2), còn trong hộp kết
 * quả của calculator nó nằm dưới một h2 đã có nên phải là h3. Để cứng h2 sẽ
 * làm gãy thứ tự heading ở đúng những trang vừa được sửa cho hết cụt.
 */
export function NextSteps({
  title,
  headingLevel = "h2",
  className = "",
  children,
}: {
  title: string;
  headingLevel?: "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  const Heading = headingLevel;

  return (
    <section className={className}>
      <Heading
        className={`font-display font-bold text-foreground ${
          headingLevel === "h2" ? "text-xl" : "text-base"
        }`}
      >
        {title}
      </Heading>
      <ul className="mt-3 space-y-2">{children}</ul>
    </section>
  );
}
