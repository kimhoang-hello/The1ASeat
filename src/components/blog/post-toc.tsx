import { CaretDown } from "@phosphor-icons/react/ssr";
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
      <p className="text-sm font-semibold text-foreground">{posts_t("tocTitle")}</p>
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

/**
 * Cùng mục lục đó cho DƯỚI `xl`: một khối thu gọn ở ĐẦU bài (thêm 03/10/2026).
 *
 * Trước đây dưới `xl` không có mục lục nào, nên đúng nhóm đọc chính — điện
 * thoại (PRODUCT.md) — phải cuộn cả bài "Everything about Aeroplan" để tìm phần
 * redeem. Đặt TRƯỚC thân bài (mục lục nằm sau nội dung thì không còn là mục
 * lục), đóng sẵn để không đẩy chữ đầu bài xuống thêm một màn hình. Hai bản
 * không bao giờ cùng hiện (`xl:hidden` / `hidden xl:block`), nên hai `nav` cùng
 * nhãn không chồng nhau trong cây truy cập.
 */
export function PostTocMobile({ items, className = "" }: { items: TocItem[]; className?: string }) {
  if (items.length < 2) return null;

  return (
    <details className={`group rounded-2xl border border-border bg-card ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>
          {posts_t("tocTitle")}{" "}
          <span className="font-normal text-muted-foreground">({items.length})</span>
        </span>
        <CaretDown size={16} aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <nav aria-label={posts_t("tocTitle")} className="border-t border-border px-4 pb-3 pt-1">
        <ol>
          {items.map((item) => (
            <li key={item.id}>
              {/* Cao 44px THẬT (`min-h-11`): các dòng đứng sát nhau, `py-2.5` với
                  chữ 14px chỉ ra 39px — chạm hụt là nhảy sang mục kế bên
                  (Codex bắt, 03/10/2026). */}
              <a
                href={`#${item.id}`}
                className="flex min-h-11 items-center py-2.5 text-sm leading-snug text-primary hover:underline"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
