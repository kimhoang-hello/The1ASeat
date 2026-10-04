import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";

/**
 * Dải tiêu đề của một trang. Bề ngang LUÔN là `max-w-page`, không có prop nào
 * đổi được.
 *
 * Đã thử cho mỗi trang tự khai bề ngang để dải này khớp mép trái với thân
 * trang bên dưới, và đã bỏ ngày 08/09/2026: thân trang hẹp thì canh giữa, nên
 * dải tiêu đề khớp theo cũng thành canh giữa — tên trang ở mục Miles & Points
 * nhảy vào giữa màn hình trong khi mọi trang khác vẫn nằm sát trái. Hai mép
 * trái lệch nhau trong một trang là chuyện nhỏ; tên trang mỗi trang một chỗ
 * khi bấm qua lại giữa các mục là chuyện lớn hơn.
 *
 * Từ 03/10/2026 (audit UX/UI): không còn dải nền beige và không còn eyebrow
 * viết hoa. Trang sâu truyền `breadcrumbs` (các bậc phía trên trang này); trang
 * cấp một thì không có gì phía trên H1. Nhãn Beta đứng ngay sau H1.
 */
export function PageHeader({
  breadcrumbs = [],
  badge,
  title,
  subtitle,
}: {
  breadcrumbs?: Crumb[];
  /** Nhãn đứng sau tiêu đề — hôm nay chỉ có `<BetaBadge />`. */
  badge?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border px-4 pb-8 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <Breadcrumbs items={breadcrumbs} className="mb-1" />
        {/* text-balance để tiêu đề hai dòng không bỏ lại một chữ đơn độc. */}
        <h1 className="text-balance font-display text-3xl font-bold text-foreground sm:text-4xl">
          {title}
          {badge && <span className="ml-3 inline-block align-middle">{badge}</span>}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
