import Link from "next/link";
import Image from "next/image";
import { t as translate } from "@/lib/t";
import { getPosts } from "@/lib/content";
import { formatDate } from "@/lib/format-date";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { getYouTubeThumbnailUrl } from "@/lib/video-embed";

const t = translate("posts");
const tCommon = translate("common");

export async function PostsSection() {
  const allPosts = await getPosts();
  const posts = allPosts.slice(0, 3);

  return (
    <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              {t("title")}
            </h2>
          </div>
          <Link href="/blog" className="cursor-pointer text-sm font-semibold text-primary hover:underline">
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {posts.map((post) => {
            const thumbnail =
              post.coverPhoto ?? (post.type === "video" ? getYouTubeThumbnailUrl(post.videoUrl ?? "") : null);
            return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
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
                      {t("videoBadge")}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  <span aria-hidden>&middot;</span>
                  <span>
                    {post.minutesRead} {tCommon("minRead")}
                  </span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
