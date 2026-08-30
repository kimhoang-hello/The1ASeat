import Link from "next/link";
import type { Metadata } from "next";
import { getPosts } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { CategoryLinks } from "@/components/blog/category-links";
import { getCategories } from "@/lib/blog-categories";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const posts_t = t("posts");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("blogTitle"),
  description: seo("blogDescription"),
  path: "/blog",
});

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
  const categories = getCategories(allPosts);

  // The ?type= views are filtered slices of this same list and all canonicalise
  // back to /blog, so the ItemList only ever describes the unfiltered archive.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbBlog"), path: "/blog" }]),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/blog")}#collection`,
        name: seo("blogTitle"),
        description: seo("blogDescription"),
        url: absoluteUrl("/blog"),
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: allPosts.length,
          itemListElement: allPosts.map((post, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(`/blog/${post.slug}`),
            name: post.title,
          })),
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={posts_t("eyebrow")} title={posts_t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page">
          <div className="mb-6 flex gap-2">
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

          <CategoryLinks categories={categories} className="mb-8" />

          {/* Trước đây chỉ có `posts.map(...)`, không có nhánh nào cho danh
              sách rỗng: tab `?type=video` mà cạn bài là người đọc nhận một
              vùng lưới trắng, không biết là chưa có bài hay trang hỏng — và
              không có đường nào đi tiếp. Cùng bài học đã ghi ở
              /transfer-bonuses. */}
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">{posts_t("emptyTab")}</p>
              <Link
                href="/blog"
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                {posts_t("emptyCta")} &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
