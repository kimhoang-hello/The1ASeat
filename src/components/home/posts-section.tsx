import Link from "next/link";
import { t as translate } from "@/lib/t";
import { getPosts } from "@/lib/content";
import { PostCarousel } from "./post-carousel";

const t = translate("posts");

export async function PostsSection() {
  const allPosts = await getPosts();
  // More than fit on screen at once — the strip scrolls, so the surplus is the
  // point: a reader can browse past the newest few without leaving for /blog.
  const posts = allPosts.slice(0, 12);

  return (
    <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary sm:text-sm">
              {t("eyebrow")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl xl:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/blog"
            className="cursor-pointer text-base font-semibold text-primary hover:underline"
          >
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <PostCarousel posts={posts} />
      </div>
    </section>
  );
}
