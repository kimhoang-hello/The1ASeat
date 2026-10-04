import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "@/lib/content";
import { formatDate } from "@/lib/format-date";
import { postDuration } from "@/lib/post-duration";
import { getYouTubeThumbnailFallbackUrl, getYouTubeThumbnailUrl } from "@/lib/video-embed";
import { VideoThumbnail } from "@/components/blog/video-thumbnail";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { t } from "@/lib/t";

const posts_t = t("posts");
const common = t("common");

/**
 * Shared card used by /blog, the category archives and the related-posts block.
 * `headingLevel` exists so a card nested under a section heading can drop to h3
 * instead of stacking a second h2 into the outline.
 *
 * `preload` chỉ cho thẻ ĐẦU TIÊN của một lưới nằm ngay màn hình đầu (/blog,
 * trang chuyên mục). Ảnh của thẻ đó là LCP của cả trang, mà `next/image` mặc
 * định `loading="lazy"`: đo Lighthouse 29/09/2026, ảnh LCP của /blog chờ
 * 1.7 s mới bắt đầu tải chỉ vì bị lazy. Thẻ thứ hai trở đi cùng cỡ nên không
 * thay được LCP — preload thêm chỉ tranh băng thông với ảnh thật sự cần.
 *
 * `listOnMobile` (04/10/2026, audit UX/UI): dưới `sm` thẻ thành một DÒNG — ảnh
 * nhỏ bên trái, chuyên mục, tiêu đề, ngày — như khối review ở trang chủ. Thẻ
 * dọc ảnh 176px cao ~400px một bài, nên `/blog` dài 22,967px ở 375px (gần 28
 * màn hình), trang dài nhất site. Bỏ tóm tắt trên điện thoại; giữ chuyên mục,
 * nhãn Video và thời lượng — thứ người đọc dùng để chọn bài. Từ `sm` vẫn là
 * thẻ dọc ảnh lớn. Không bật cho carousel trang chủ: ở đó thẻ dọc nằm trong
 * một hàng cuộn ngang.
 */
export function PostCard({
  post,
  headingLevel = "h2",
  className = "",
  preload = false,
  listOnMobile = false,
}: {
  post: BlogPost;
  headingLevel?: "h2" | "h3";
  className?: string;
  preload?: boolean;
  listOnMobile?: boolean;
}) {
  const Heading = headingLevel;
  const duration = postDuration(post);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex cursor-pointer rounded-2xl border border-border bg-card transition-shadow hover:shadow-md ${
        listOnMobile
          ? "items-start gap-3 p-3 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0"
          : "flex-col overflow-hidden"
      } ${className}`}
    >
      {/* `alt=""`: tiêu đề bài nằm ngay dưới ảnh trong CÙNG link — có alt thì
          trình đọc màn hình đọc tên bài hai lần liền nhau (04/10/2026). */}
      <PostThumbnail
        post={post}
        preload={preload}
        alt=""
        className={
          listOnMobile
            ? "aspect-video w-28 shrink-0 rounded-lg sm:aspect-auto sm:h-44 sm:w-full sm:rounded-none"
            : "h-44 w-full"
        }
        sizes={listOnMobile ? "(min-width: 640px) 384px, 112px" : undefined}
      />
      <div className={`flex flex-1 flex-col ${listOnMobile ? "min-w-0 sm:p-5" : "p-5"}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {post.category}
          </span>
          {post.type === "video" && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
              {posts_t("videoBadge")}
            </span>
          )}
        </div>
        <Heading className="mt-2 text-pretty font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
          {post.title}
        </Heading>
        <p
          className={`mt-2 line-clamp-2 text-sm text-muted-foreground ${listOnMobile ? "hidden sm:block" : ""}`}
        >
          {post.excerpt}
        </p>
        <div
          className={`mt-auto flex items-center gap-2 text-xs text-muted-foreground ${
            listOnMobile ? "pt-2 sm:pt-4" : "pt-4"
          }`}
        >
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          {duration && (
            <>
              <span aria-hidden>&middot;</span>
              <span>
                {duration.minutes} {common(duration.kind === "watch" ? "minWatch" : "minRead")}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Ảnh của một bài: ảnh tác giả tải lên, ảnh YouTube cho bài video (có đường
 * lùi riêng khi `maxresdefault` không tồn tại), hoặc ô giữ chỗ theo biểu tượng
 * chọn trong Contentful. Tách khỏi `PostCard` để khối review ở trang chủ dùng
 * đúng cách chọn ảnh đó ở cỡ nhỏ.
 *
 * `alt` để trống khi tiêu đề bài đã nằm ngay cạnh ảnh trong cùng một link —
 * nếu không, trình đọc màn hình đọc tiêu đề hai lần liên tiếp.
 */
export function PostThumbnail({
  post,
  className = "",
  sizes = "384px",
  preload = false,
  alt = post.title,
}: {
  post: BlogPost;
  className?: string;
  sizes?: string;
  preload?: boolean;
  alt?: string;
}) {
  const videoThumbnail =
    post.coverPhoto || post.type !== "video" ? null : getYouTubeThumbnailUrl(post.videoUrl ?? "");
  const thumbnail = post.coverPhoto ?? videoThumbnail;

  if (!thumbnail) {
    return (
      <MediaPlaceholder
        icon={post.coverImage as PlaceholderIcon}
        tone="navy"
        className={className}
        isVideo={post.type === "video"}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden bg-primary ${className}`}>
      {videoThumbnail ? (
        <VideoThumbnail
          src={videoThumbnail}
          fallbackSrc={getYouTubeThumbnailFallbackUrl(post.videoUrl ?? "")}
          alt={alt}
          sizes={sizes}
          preload={preload}
          className="object-cover"
        />
      ) : (
        <Image src={thumbnail} alt={alt} fill sizes={sizes} preload={preload} className="object-cover" />
      )}
    </div>
  );
}
