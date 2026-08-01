import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPosts } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { formatDate } from "@/lib/format-date";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";

export async function PostsSection() {
  const [t, tCommon, locale, allPosts] = await Promise.all([
    getTranslations("posts"),
    getTranslations("common"),
    getLocale(),
    getPosts(),
  ]);
  const posts = allPosts.slice(0, 3);

  return (
    <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
            >
              <MediaPlaceholder
                icon={post.coverImage as PlaceholderIcon}
                tone="navy"
                className="h-44 w-full"
              />
              <div className="flex flex-1 flex-col p-5">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {pickLocale(post.category, locale)}
                </span>
                <h3 className="mt-2 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                  {pickLocale(post.title, locale)}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {pickLocale(post.excerpt, locale)}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                  <span aria-hidden>&middot;</span>
                  <span>
                    {post.minutesRead} {tCommon("minRead")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
