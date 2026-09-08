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
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border bg-secondary px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-wide text-primary">{eyebrow}</p>
        )}
        {/* text-balance so a title like "Thẻ Tín Dụng Đáng Chú Ý" does not
            wrap with its last character stranded alone on the second line. */}
        <h1 className="mt-1 text-balance font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
