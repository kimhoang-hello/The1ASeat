import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCreditCardOffers, getPostBySlug, getPosts, getTransferBonuses } from "@/lib/content";
import type { BlogPost } from "@/lib/content";
import { formatDate, hasExpired } from "@/lib/format-date";
import { MediaPlaceholder, type PlaceholderIcon } from "@/components/ui/media-placeholder";
import { getVideoEmbedUrl, getYouTubeThumbnailUrl, getYouTubeWatchUrl } from "@/lib/video-embed";
import { CommentSection } from "@/components/blog/comment-section";
import { PostCard } from "@/components/blog/post-card";
import { AffiliateClickTracker } from "@/components/blog/affiliate-click-tracker";
import { PostBody } from "@/components/blog/post-body";
import { PostToc } from "@/components/blog/post-toc";
import { PostNextSteps } from "@/components/blog/post-next-steps";
import { OfferStatusNotice } from "@/components/blog/offer-status-notice";
import { JsonLd } from "@/components/seo/json-ld";
import { categoryPath, getRelatedPosts, lastModified, slugifyVi } from "@/lib/blog-categories";
import { postOfferStatus } from "@/lib/post-offer-status";
import { withHeadingAnchors } from "@/lib/post-toc";
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
  const [allPosts, offers, transferBonuses] = await Promise.all([
    getPosts(),
    getCreditCardOffers(),
    getTransferBonuses(),
  ]);
  const post = allPosts.find((item) => item.slug === slug);

  if (!post) notFound();

  const embedUrl = post.type === "video" ? getVideoEmbedUrl(post.videoUrl ?? "") : null;
  const image = postImage(post);
  const url = absoluteUrl(`/blog/${post.slug}`);
  const related = getRelatedPosts(allPosts, post);
  const categoryHref = categoryPath(slugifyVi(post.category));
  const offerStatus = postOfferStatus(post);
  // Cùng phép lọc mà chính trang /transfer-bonuses dùng — nút "đi tiếp" không
  // được hứa một danh sách mà trang kia đã lọc sạch.
  const hasLiveTransferBonus = transferBonuses.some((bonus) => !hasExpired(bonus.expiresAt));

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

  // Mục lục dựng từ thân bài, và thân bài được gắn `id` vào từng `h2` để
  // link của mục lục có chỗ mà nhảy tới. Truyền bản ĐÃ GẮN cho `PostBody`;
  // những chỗ khác vẫn dùng `post` gốc vì chúng chỉ đọc slug/tiêu đề.
  const { blocks: anchoredBlocks, toc } = withHeadingAnchors(post.bodyBlocks);
  const anchoredPost = { ...post, bodyBlocks: anchoredBlocks, body: anchoredBlocks.join("") };
  const hasToc = toc.length >= 2;

  return (
    /* Từ `xl` khung bài rộng 68rem chứ không còn 42rem, nhưng CỘT CHỮ vẫn
       42rem — xem chú thích trong `PostToc`. Phần rộng thêm dành cho ảnh
       cover, tiêu đề, mục lục và các khối cuối bài, không dành cho câu văn.
       DƯỚI `xl` giữ nguyên 42rem như trước: chỉ nới khung mà không có cột
       phải thì tiêu đề nằm sát mép trái còn thân bài thụt vào giữa, hai lề
       trái lệch nhau không vì lý do gì.

       CÙNG LÝ DO ĐÓ, bài không đủ đầu mục để có mục lục thì không nới khung ở
       bất kỳ bề ngang nào. Không có cột phải thì không có gì lấp chỗ trống,
       và một khung 68rem đựng một cột chữ 42rem canh giữa chỉ đẩy tiêu đề ra
       xa thân bài của chính nó. 30/40 bài hiện nay rơi vào nhóm này — review
       khách sạn và video, thân bài không có `h2` nào. */
    <article
      className={`mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8${hasToc ? " xl:max-w-[68rem]" : ""}`}
    >
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
        <div className="relative mt-6 h-56 w-full overflow-hidden rounded-2xl bg-primary sm:h-80 xl:h-[26rem]">
          {/* `sizes` phải tả BỀ RỘNG ẢNH ĐƯỢC VẼ, không phải bề rộng tối đa
              của bài. Khung là `max-w-2xl` (672px) TRỪ padding: 100vw−2rem
              trên điện thoại, 608px từ `lg` trở lên. Bốn mốc là bốn khoảng
              padding thật: `px-4` dưới 640, `px-6` từ 640, khung chạm trần
              672px ở đúng 672px màn hình (100vw−48 = 624 từ đó trở đi), rồi
              `px-8` từ 1024 (608px), rồi khung nhảy lên 68rem ở `xl` → 1024px
              từ 1280 trở đi. Khai 1024px cho mọi mốc thì máy 375px ở DPR 2 đi
              lấy biến thể cho 2048px thay vì cho 686px — vài trăm KB cho một
              tấm ảnh cao 224px.
              `preload` vì đây là thứ lớn nhất trong màn hình đầu của một bài
              viết chữ; trang thẻ đã làm đúng như vậy với ảnh thẻ. */}
          <Image
            src={post.coverPhoto}
            alt={post.title}
            fill
            sizes="(min-width: 1280px) 1024px, (min-width: 1024px) 608px, (min-width: 672px) 624px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)"
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

      {/* Bài viết về một ưu đãi có hạn nói trạng thái của ưu đãi đó NGAY ĐẦU
          BÀI. Trước đây hạn chót chỉ nằm trong một câu giữa thân bài, nên qua
          ngày đó trang vẫn nguyên như hôm đăng — người đọc tới từ Google đọc
          hết bài rồi mới biết ưu đãi đã đóng, và không có đường nào sang thứ
          đang chạy. */}
      {offerStatus && (
        <OfferStatusNotice status={offerStatus} hasLiveTransferBonus={hasLiveTransferBonus} />
      )}

      {/* A link inside a heading would otherwise drop to the typography plugin's
          font-weight:500 and read thinner than the words around it, so headings
          keep their own weight and the underline does the work of saying "link". */}
      {/* Thân bài GIỮ NGUYÊN là Server Component; `AffiliateClickTracker` đứng
          riêng và chỉ nhận chuỗi slug. Lý do là ranh giới client, KHÔNG phải
          số byte — xem chú thích trong chính component đó, chỗ đo được rằng
          chuỗi thân bài nằm hai lần trong trang dù đi đường nào. */}
      {/* Hai cột từ `xl`: chữ trái, mục lục phải. Bài không đủ đầu mục thì
          không có cột phải, và cột chữ tự canh giữa khung — nếu không nó sẽ
          nằm lệch trái với một mảng trống 18rem không giải thích được. */}
      <div
        className={
          hasToc
            ? "mt-8 grid gap-14 xl:grid-cols-[minmax(0,42rem)_18rem]"
            : "mt-8"
        }
      >
        {/* Bài không có mục lục thì không có lưới, nên cột chữ phải TỰ chặn ở
            42rem — bỏ ra là nó chạy hết 64rem của khung từ `xl`, 119 ký tự
            một dòng, đúng thứ khung rộng ra sinh ra để tránh. */}
        <div className={hasToc ? "min-w-0" : "mx-auto w-full max-w-[42rem]"}>
          <PostBody post={anchoredPost} offers={offers} />
          <AffiliateClickTracker scope="post-body" slug={post.slug} />
        </div>

        {/* `aside` KHÔNG dính, `nav` bên trong mới dính. Cột lưới phải cao
            bằng cả thân bài thì phần tử `sticky` mới có quãng đường mà đi —
            đặt `sticky` thẳng lên cột (và để nó co bằng nội dung) là nó đứng
            yên rồi trôi mất cùng đoạn đầu tiên. */}
        {hasToc && (
          <aside className="hidden xl:block">
            <PostToc items={toc} className="sticky top-24" />
          </aside>
        )}
      </div>

      {/* Ba khối cuối bài chạy hết bề ngang khung (1024px), bằng đúng ảnh
          cover ở đầu — chúng không còn là chữ để đọc mà là chỗ đi tiếp, và để
          chúng hẹp bằng cột chữ thì mỗi đường kẻ ngang lại dài một kiểu. */}
      <PostNextSteps
        post={post}
        posts={allPosts}
        offers={offers}
        className="mt-12 border-t border-border pt-8"
      />

      {related.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-display text-xl font-bold text-foreground">{seo("relatedTitle")}</h2>
          {/* Cột thứ ba CHỈ khi khung đã nới ra. Bài không có mục lục vẫn
              rộng 38rem, nhét ba thẻ vào đó là tiêu đề nào cũng gãy bốn dòng. */}
          <div className={`mt-5 grid gap-5 sm:grid-cols-2${hasToc ? " xl:grid-cols-3" : ""}`}>
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
