/**
 * Bề ngang của dải tiêu đề PHẢI bằng bề ngang thân trang ngay dưới nó.
 *
 * Mặc định `page` khớp với `max-w-page` — đúng cho trang danh sách và trang
 * công cụ. Nhưng một trang đọc thì thân trang hẹp hơn thế nhiều, và khi hai
 * bên lệch nhau thì trên màn hình 1800px mép trái của tiêu đề cách mép trái
 * của đoạn văn đầu tiên vài trăm pixel — trông như hai trang chồng lên nhau
 * chứ không phải một trang. Đó là lý do có prop này thay vì một con số cứng.
 */
/** Tên khoá đặt theo ĐÚNG class chặn bề ngang của thân trang, để chỗ khai ở
 *  trang và chỗ khai ở đây không thể lệch nhau mà vẫn trông hợp lệ. */
const WIDTH = {
  /** Trang danh sách, trang lưới thẻ — `max-w-page`. */
  page: "max-w-page",
  /** Trang đọc có cột phải là mục lục — cùng 68rem với `/blog/[slug]`. */
  article: "max-w-[68rem]",
  "4xl": "max-w-4xl",
  "3xl": "max-w-3xl",
  "2xl": "max-w-2xl",
  xl: "max-w-xl",
} as const;

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  width = "page",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  width?: keyof typeof WIDTH;
}) {
  return (
    <div className="border-b border-border bg-secondary px-4 py-12 sm:px-6 lg:px-8">
      <div className={`mx-auto ${WIDTH[width]}`}>
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
