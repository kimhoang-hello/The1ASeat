import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "@/lib/content";
import { formatDate } from "@/lib/format-date";
import { getYouTubeThumbnailUrl } from "@/lib/video-embed";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { t } from "@/lib/t";

const posts_t = t("posts");
const common = t("common");

/**
 * Shared card used by /blog, the category archives and the related-posts block.
 * `headingLevel` exists so a card nested under a section heading can drop to h3
 * instead of stacking a second h2 into the outline.
 */
export function PostCard({
  post,
  headingLevel = "h2",
  className = "",
}: {
  post: BlogPost;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const Heading = headingLevel;
  const thumbnail =
    post.coverPhoto ?? (post.type === "video" ? getYouTubeThumbnailUrl(post.videoUrl ?? "") : null);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md ${className}`}
    >
      {thumbnail ? (
        <div className="relative h-44 w-full overflow-hidden bg-primary">
          <Image src={thumbnail} alt={post.title} fill sizes="384px" className="object-cover" />
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
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
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
          <span aria-hidden>&middot;</span>
          <span>
            {post.minutesRead} {common("minRead")}
          </span>
        </div>
      </div>
    </Link>
  );
}
