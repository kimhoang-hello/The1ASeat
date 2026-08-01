import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getPosts } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { formatDate } from "@/lib/format-date";
import { PageHeader } from "@/components/layout/page-header";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "posts" });
  return { title: t("title") };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: routeLocale } = await params;
  setRequestLocale(routeLocale);

  const [t, common, locale, posts] = await Promise.all([
    getTranslations("posts"),
    getTranslations("common"),
    getLocale(),
    getPosts(),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                <h2 className="mt-2 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                  {pickLocale(post.title, locale)}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {pickLocale(post.excerpt, locale)}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                  <span aria-hidden>&middot;</span>
                  <span>
                    {post.minutesRead} {common("minRead")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
