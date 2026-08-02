import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostBySlug, getPosts } from "@/lib/content";
import { formatDate } from "@/lib/format-date";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { t } from "@/lib/t";

const common = t("common");
const posts_t = t("posts");

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

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
          {post.category}
        </span>
        {post.type === "video" && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
            {posts_t("videoBadge")}
          </span>
        )}
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground">{post.title}</h1>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{post.author}</span>
        <span aria-hidden>&middot;</span>
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        <span aria-hidden>&middot;</span>
        <span>
          {post.minutesRead} {common("minRead")}
        </span>
      </div>

      <div
        className="prose prose-neutral mt-8 max-w-none prose-headings:font-display prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: post.body }}
      />
    </article>
  );
}
