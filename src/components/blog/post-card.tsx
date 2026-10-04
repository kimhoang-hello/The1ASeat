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
 */
export function PostCard({
  post,
  headingLevel = "h2",
  className = "",
  preload = false,
}: {
  post: BlogPost;
  headingLevel?: "h2" | "h3";
  className?: string;
  preload?: boolean;
}) {
  const Heading = headingLevel;
  const duration = postDuration(post);
  // Ảnh video có đường lùi riêng khi `maxresdefault` không tồn tại; ảnh do tác
  // giả tải lên thì không cần, nó luôn có thật.
  const videoThumbnail =
    post.coverPhoto || post.type !== "video" ? null : getYouTubeThumbnailUrl(post.videoUrl ?? "");
  const thumbnail = post.coverPhoto ?? videoThumbnail;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md ${className}`}
    >
      {thumbnail ? (
        <div className="relative h-44 w-full overflow-hidden bg-primary">
          {videoThumbnail ? (
            <VideoThumbnail
              src={videoThumbnail}
              fallbackSrc={getYouTubeThumbnailFallbackUrl(post.videoUrl ?? "")}
              alt={post.title}
              sizes="384px"
              preload={preload}
              className="object-cover"
            />
          ) : (
            <Image
              src={thumbnail}
              alt={post.title}
              fill
              sizes="384px"
              preload={preload}
              className="object-cover"
            />
          )}
        </div>
      ) : (
        <MediaPlaceholder
          icon={post.coverImage as PlaceholderIcon}
          tone="navy"
          className="h-44 w-full"
          isVideo={post.type === "video"}
        />
      )}
      <div className="flex flex-1 flex-col p-5">
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
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
        <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
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
