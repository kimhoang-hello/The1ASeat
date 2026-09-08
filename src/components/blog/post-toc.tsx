import type { TocItem } from "@/lib/post-toc";
import { t as translate } from "@/lib/t";

const posts_t = translate("posts");

/**
 * Mục lục dính bên phải thân bài, CHỈ từ `xl` trở lên.
 *
 * Đây là thứ lấp chỗ trống mà khung bài rộng ra để lại. Không phải để trang
 * trí: bề ngang dôi ra trên màn hình lớn không được dùng để kéo dài dòng chữ
 * — 608px ở 16px đã là 75 ký tự/dòng, kịch trần khoảng dễ đọc — nên nó phải
 * đựng thứ khác. Dưới `xl` cột này biến mất hẳn thay vì rơi xuống dưới thân
 * bài, vì một mục lục nằm SAU nội dung nó mục lục thì không còn là mục lục.
 */
export function PostToc({ items, className = "" }: { items: TocItem[]; className?: string }) {
  // Một mục thì không phải mục lục, nó là cái tiêu đề đọc hai lần.
  if (items.length < 2) return null;

  return (
    <nav aria-label={posts_t("tocTitle")} className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {posts_t("tocTitle")}
      </p>
      <ol className="mt-3 space-y-2 border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="-ml-px block border-l border-transparent py-0.5 pl-4 text-sm leading-snug text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
