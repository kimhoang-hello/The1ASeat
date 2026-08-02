import Link from "next/link";
import type { Metadata } from "next";
import { getPosts } from "@/lib/content";
import { formatDate } from "@/lib/format-date";
import { PageHeader } from "@/components/layout/page-header";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { t } from "@/lib/t";

const posts_t = t("posts");
const common = t("common");

export const metadata: Metadata = { title: posts_t("title") };

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

const TABS = [
  { value: "all", labelKey: "tabAll" },
  { value: "post", labelKey: "tabPosts" },
  { value: "video", labelKey: "tabVideos" },
] as const;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [allPosts, { type }] = await Promise.all([getPosts(), searchParams]);

  const activeTab = type === "post" || type === "video" ? type : "all";
  const posts = allPosts.filter((post) => activeTab === "all" || post.type === activeTab);

  return (
    <>
      <PageHeader eyebrow={posts_t("eyebrow")} title={posts_t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex gap-2">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value === "all" ? "/blog" : `/blog?type=${tab.value}`}
                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground/70 hover:text-foreground"
                }`}
              >
                {posts_t(tab.labelKey)}
              </Link>
            ))}
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
                  isVideo={post.type === "video"}
                />
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
                  <h2 className="mt-2 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                    <span aria-hidden>&middot;</span>
                    <span>
                      {post.minutesRead} {common("minRead")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
