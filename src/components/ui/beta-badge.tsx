/**
 * Nhãn BETA — một viên pill, dùng ở MỌI chỗ nói một trang còn là bản thử.
 *
 * Một component chứ không phải chữ "(Beta)" rải trong từng câu: nhãn thì mắt
 * bắt được ngay khi quét trang, còn chữ trong câu thì đọc mới thấy — và bốn chỗ
 * viết tay là bốn cách viết khác nhau ("Beta", "(Beta)", "Bản Beta ·").
 *
 * `bg-secondary` là màu kem của site, cùng nền với dòng menu đang active, nên
 * nhãn đứng cạnh chữ mà không tranh chỗ với nút hay link.
 */
export function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-foreground/70 ${className}`}
    >
      Beta
    </span>
  );
}
