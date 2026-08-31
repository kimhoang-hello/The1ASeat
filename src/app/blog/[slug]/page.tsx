import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCreditCardOffers, getPostBySlug, getPosts } from "@/lib/content";
import type { BlogPost } from "@/lib/content";
import { formatDate } from "@/lib/format-date";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { getVideoEmbedUrl, getYouTubeThumbnailUrl, getYouTubeWatchUrl } from "@/lib/video-embed";
import { CommentSection } from "@/components/blog/comment-section";
import { PostCard } from "@/components/blog/post-card";
import { AffiliateClickTracker } from "@/components/blog/affiliate-click-tracker";
import { PostNextSteps } from "@/components/blog/post-next-steps";
import { JsonLd } from "@/components/seo/json-ld";
import { categoryPath, getRelatedPosts, lastModified, slugifyVi } from "@/lib/blog-categories";
import { SITE_URL } from "@/lib/subscriber-email";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const common = t("common");
const posts_t = t("posts");
const seo = t("seo");

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

// post.coverImage is a MediaPlaceholder icon name (e.g. "airplane"), not a real
// image — the actual photo lives in post.coverPhoto (text posts) or is derived
// from the YouTube video (video posts).
function postImage(post: BlogPost): string | null {
  return post.coverPhoto || getYouTubeThumbnailUrl(post.videoUrl ?? "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  // 24 of the posts are YouTube uploads whose displayed title is the original
  // English one. seoTitle/seoDescription let a Vietnamese search title be set
  // in Contentful without changing what readers see on the page.
  return pageMetadata({
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    path: `/blog/${post.slug}`,
    image: postImage(post) ?? undefined,
    article: {
      publishedTime: post.publishedAt,
      modifiedTime: lastModified(post),
      section: post.category,
    },
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [allPosts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);
  const post = allPosts.find((item) => item.slug === slug);

  if (!post) notFound();

  const embedUrl = post.type === "video" ? getVideoEmbedUrl(post.videoUrl ?? "") : null;
  const image = postImage(post);
  const url = absoluteUrl(`/blog/${post.slug}`);
  const related = getRelatedPosts(allPosts, post);
  const categoryHref = categoryPath(slugifyVi(post.category));

  // Video posts get a nested VideoObject so they can qualify for video results
  // as well as article results — without it these pages are just an iframe and
  // a paragraph as far as a crawler is concerned.
  const video =
    post.type === "video" && post.videoUrl
      ? {
          "@type": "VideoObject",
          name: post.title,
          description: post.excerpt,
          uploadDate: post.publishedAt,
          ...(image && { thumbnailUrl: [image] }),
          ...(embedUrl && { embedUrl }),
          ...(getYouTubeWatchUrl(post.videoUrl) && { contentUrl: getYouTubeWatchUrl(post.videoUrl) }),
        }
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbBlog"), path: "/blog" },
        { name: post.category, path: categoryHref },
        { name: post.title, path: `/blog/${post.slug}` },
      ]),
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.excerpt,
        datePublished: post.publishedAt,
        // publishedAt is set by hand in Contentful and can post-date the last
        // edit; a dateModified earlier than datePublished is invalid markup.
        // Compared as Dates because the two fields arrive in different ISO
        // shapes ("...T00:00-04:00" vs "...T16:55:43.826Z").
        dateModified: lastModified(post),
        inLanguage: "vi-VN",
        articleSection: post.category,
        mainEntityOfPage: url,
        url,
        author: { "@type": "Person", name: post.author, url: absoluteUrl("/about") },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        ...(image && { image: [image] }),
        ...(video && { video }),
      },
    ],
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />
      <Link href="/" className="text-sm font-semibold text-primary hover:underline">
        &larr; {common("backHome")}
      </Link>

      {embedUrl ? (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-primary">
          <iframe
            src={embedUrl}
            title={post.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : post.coverPhoto ? (
        <div className="relative mt-6 h-56 w-full overflow-hidden rounded-2xl bg-primary sm:h-80">
          {/* `sizes` phải tả BỀ RỘNG ẢNH ĐƯỢC VẼ, không phải bề rộng tối đa
              của bài. Khung là `max-w-2xl` (672px) TRỪ padding: 100vw−2rem
              trên điện thoại, 608px từ `lg` trở lên. Bốn mốc là bốn khoảng
              padding thật: `px-4` dưới 640, `px-6` từ 640, khung chạm trần
              672px ở đúng 672px màn hình (100vw−48 = 624 từ đó trở đi), rồi
              `px-8` từ 1024. Khai 672px trần thì máy 375px ở DPR 2 đi lấy
              biến thể cho 1344px thay vì cho 686px — vài trăm KB cho một tấm
              ảnh cao 224px.
              `preload` vì đây là thứ lớn nhất trong màn hình đầu của một bài
              viết chữ; trang thẻ đã làm đúng như vậy với ảnh thẻ. */}
          <Image
            src={post.coverPhoto}
            alt={post.title}
            fill
            sizes="(min-width: 1024px) 608px, (min-width: 672px) 624px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)"
            preload
            className="object-cover"
          />
        </div>
      ) : (
        <MediaPlaceholder
          icon={post.coverImage as PlaceholderIcon}
          tone="navy"
          className="mt-6 h-56 w-full rounded-2xl"
          isVideo={post.type === "video"}
        />
      )}

      <div className="mt-6 flex items-center gap-2">
        <Link
          href={categoryHref}
          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          {post.category}
        </Link>
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

      {/* A link inside a heading would otherwise drop to the typography plugin's
          font-weight:500 and read thinner than the words around it, so headings
          keep their own weight and the underline does the work of saying "link". */}
      {/* Thân bài GIỮ NGUYÊN là Server Component; `AffiliateClickTracker` đứng
          riêng và chỉ nhận chuỗi slug. Lý do là ranh giới client, KHÔNG phải
          số byte — xem chú thích trong chính component đó, chỗ đo được rằng
          chuỗi thân bài nằm hai lần trong trang dù đi đường nào. */}
      <div
        data-affiliate-scope="post-body"
        className="prose prose-neutral mt-8 max-w-none prose-headings:font-display prose-a:text-primary [&_:is(h1,h2,h3,h4)_a]:[font-weight:inherit]"
        dangerouslySetInnerHTML={{ __html: post.body }}
      />
      <AffiliateClickTracker scope="post-body" slug={post.slug} />

      <PostNextSteps
        post={post}
        posts={allPosts}
        offers={offers}
        className="mt-12 border-t border-border pt-8"
      />

      {related.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-display text-xl font-bold text-foreground">{seo("relatedTitle")}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {related.map((item) => (
              <PostCard key={item.slug} post={item} headingLevel="h3" />
            ))}
          </div>
        </section>
      )}

      <CommentSection pageId={post.slug} url={url} title={post.title} />
    </article>
  );
}
