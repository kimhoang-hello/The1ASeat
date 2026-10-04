import type { BlogPost } from "@/lib/content";

/**
 * Excerpt mẫu mà `api/sync-videos` gắn cho video nó tự tạo (xem route đó).
 * Chuỗi này phải khớp với template trong route.
 */
const AUTO_VIDEO_EXCERPT = "Video mới từ Ghế 1A:";

/** Số phút job từng ghi cứng cho mọi video tự tạo, trước 03/10/2026. */
const LEGACY_AUTO_MINUTES = 10;

export interface PostDuration {
  /** Bài viết: phút đọc. Video: phút xem. */
  kind: "read" | "watch";
  minutes: number;
}

/**
 * Nhãn thời lượng dưới tiêu đề bài, hoặc `null` khi không biết.
 *
 * `minutesRead` là MỘT trường Contentful dùng cho hai thứ: với bài viết là số
 * phút đọc, với video là thời lượng xem do tác giả điền. In "N phút đọc" cho
 * một video là nói sai loại thời gian.
 *
 * Video do `sync-videos` tự tạo không có thời lượng thật (RSS YouTube không
 * mang trường đó). Trước 03/10/2026 job ghi số cứng 10, nên mọi video như vậy
 * hiện "10 phút" bất kể dài bao nhiêu; từ ngày đó job ghi 0 = chưa biết. Các
 * entry cũ còn mang ĐÚNG số 10 cùng excerpt mẫu là số mặc định đó, không phải
 * thời lượng. Tác giả điền thời lượng thật (khác 10) thì nhãn hiện dù excerpt
 * vẫn là câu mẫu. Giới hạn đã biết: video thật sự dài đúng 10 phút mà vẫn giữ
 * excerpt mẫu sẽ không có nhãn, và tác giả sửa excerpt mà quên sửa số 10 cũ thì
 * số đó hiện lại.
 */
export function postDuration(post: Pick<BlogPost, "type" | "minutesRead" | "excerpt">): PostDuration | null {
  const minutes = post.minutesRead;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (post.type !== "video") return { kind: "read", minutes };
  // `toPost()` chạy `keepBrandTogether()` lên excerpt, nên "Ghế 1A" trong dữ
  // liệu thật là "Ghế\u00A01A" (khoảng trắng không ngắt dòng). So trên chuỗi đã
  // đổi về khoảng trắng thường, không thì phép nhận ra video tự tạo luôn trượt.
  const autoExcerpt = post.excerpt.replace(/\u00A0/g, " ").startsWith(AUTO_VIDEO_EXCERPT);
  if (autoExcerpt && minutes === LEGACY_AUTO_MINUTES) return null;
  return { kind: "watch", minutes };
}
