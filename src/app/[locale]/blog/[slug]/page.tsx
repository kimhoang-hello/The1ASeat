import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getPostBySlug, getPosts } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { formatDate } from "@/lib/format-date";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return { title: pickLocale(post.title, locale), description: pickLocale(post.excerpt, locale) };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale: routeLocale } = await params;
  setRequestLocale(routeLocale);

  const [common, t, locale, post] = await Promise.all([
    getTranslations("common"),
    getTranslations("posts"),
    getLocale(),
    getPostBySlug(slug),
  ]);

  if (!post) notFound();

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
        &larr; {common("backHome")}
      </Link>

      <MediaPlaceholder
        icon={post.coverImage as PlaceholderIcon}
        tone="navy"
        className="mt-6 h-56 w-full rounded-2xl"
        isVideo={post.type === "video"}
      />

      <div className="mt-6 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {pickLocale(post.category, locale)}
        </span>
        {post.type === "video" && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
            {t("videoBadge")}
          </span>
        )}
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">
        {pickLocale(post.title, locale)}
      </h1>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{post.author}</span>
        <span aria-hidden>&middot;</span>
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
        <span aria-hidden>&middot;</span>
        <span>
          {post.minutesRead} {common("minRead")}
        </span>
      </div>

      <div
        className="prose prose-neutral mt-8 max-w-none prose-headings:font-display prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: pickLocale(post.body, locale) }}
      />
    </article>
  );
}
