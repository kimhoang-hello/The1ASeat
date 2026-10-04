import Link from "next/link";
import { t as translate, BRAND_NO_BREAK, keepBrandTogether } from "@/lib/t";
import { getAuthor, getPosts } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { PostThumbnail } from "@/components/blog/post-card";
import { boldOccurrences } from "@/lib/bold-occurrences";

const t = translate("author");

/**
 * Chuyên mục của những bài tác giả tự bay, tự ở, tự dùng — viết đúng chữ trong
 * Contentful. Đổi tên chuyên mục ở đó mà quên ở đây thì khối review chỉ lặng
 * lẽ biến mất (không có bài nào khớp), trang vẫn đứng.
 */
const REVIEW_CATEGORIES = new Set(["Đánh giá", "Khách sạn"]);

export async function AuthorSection() {
  const [author, posts] = await Promise.all([getAuthor(), getPosts()]);
  // `getPosts` đã sắp mới nhất trước — cùng thứ tự dải "Bài viết mới".
  const reviews = posts.filter((post) => REVIEW_CATEGORIES.has(post.category)).slice(0, 3);

  const [firstParagraph] = author.bio.split("\n\n");

  return (
    <section className="border-t border-border bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-page gap-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl xl:text-4xl">
            {t("title", { name: author.name })}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground xl:text-lg">
            {boldOccurrences(keepBrandTogether(firstParagraph), BRAND_NO_BREAK)}
          </p>
          <Link
            href="/about"
            className="mt-6 inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            {t("cta")} &rarr;
          </Link>
        </div>

        <AuthorPhoto
          photo={author.photo}
          name={author.name}
          className="h-48 w-48 justify-self-center"
          rounded="rounded-full"
        />

        {/* Ba review mới nhất (03/10/2026, audit UX/UI): hai câu chào thì blog
            nào cũng có, còn chuyến bay và khách sạn chính tác giả đã trải qua
            là bằng chứng tin cậy lớn nhất của site. Nhãn thường chứ không phải
            tiêu đề, và KHÔNG có số đếm kiểu "27 review" — con số chỉ là lời tự
            khen, ba bài thật nói nhiều hơn. */}
        {reviews.length > 0 && (
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-foreground">{t("reviewsLabel")}</p>
            <ul className="mt-3 grid gap-4 md:grid-cols-3 md:gap-5">
              {reviews.map((post) => (
                <li key={post.slug}>
                  <Link href={`/blog/${post.slug}`} className="group flex items-start gap-3 md:flex-col">
                    <PostThumbnail
                      post={post}
                      alt=""
                      sizes="(min-width: 768px) 384px, 112px"
                      className="aspect-video w-28 shrink-0 rounded-lg md:w-full"
                    />
                    <span className="text-pretty text-sm font-semibold leading-snug text-foreground group-hover:text-primary md:text-base">
                      {post.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
