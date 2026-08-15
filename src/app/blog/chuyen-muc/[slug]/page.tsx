import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosts } from "@/lib/content";
import { PageHeader } from "@/components/layout/page-header";
import { PostCard } from "@/components/blog/post-card";
import { CategoryLinks } from "@/components/blog/category-links";
import { JsonLd } from "@/components/seo/json-ld";
import {
  categoryDescription,
  categoryPath,
  findCategory,
  getCategories,
  postsInCategory,
} from "@/lib/blog-categories";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const seo = t("seo");
const posts_t = t("posts");

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  const categories = getCategories(await getPosts());
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = findCategory(await getPosts(), slug);
  if (!category) return {};

  return pageMetadata({
    title: category.name,
    description: categoryDescription(category),
    path: categoryPath(category.slug),
  });
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allPosts = await getPosts();
  const categories = getCategories(allPosts);
  const category = categories.find((item) => item.slug === slug);

  if (!category) notFound();

  const posts = postsInCategory(allPosts, category);
  const path = categoryPath(category.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbBlog"), path: "/blog" },
        { name: category.name, path },
      ]),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl(path)}#collection`,
        name: category.name,
        description: categoryDescription(category),
        url: absoluteUrl(path),
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: posts.length,
          itemListElement: posts.map((post, index) => ({
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
      <PageHeader
        eyebrow={seo("categoriesLabel")}
        title={category.name}
        subtitle={categoryDescription(category)}
      />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page">
          <CategoryLinks categories={categories} activeSlug={category.slug} className="mb-8" />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          <p className="mt-10 text-sm">
            <Link href="/blog" className="font-semibold text-primary hover:underline">
              &larr; {posts_t("viewAll")}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
