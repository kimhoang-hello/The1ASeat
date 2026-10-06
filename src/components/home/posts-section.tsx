import Link from "next/link";
import { t as translate } from "@/lib/t";
import { getPosts } from "@/lib/content";
import { PostCard } from "@/components/blog/post-card";
import { PostCarousel } from "./post-carousel";

const t = translate("posts");

export async function PostsSection() {
  const allPosts = await getPosts();
  // More than fit on screen at once — the strip scrolls, so the surplus is the
  // point: a reader can browse past the newest few without leaving for /blog.
  const posts = allPosts.slice(0, 12);

  return (
    <section className="border-t border-border bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl xl:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/blog"
            className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-primary hover:underline sm:items-end"
          >
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <PostCarousel>
          {/* The widths are exact fractions of the track minus the gaps it spans,
              so one, two, three or four cards sit flush across a row. On a phone a
              card stops short of the full width, letting the next one peek in —
              that overhang is what tells a reader there is more to swipe to. */}
          {posts.map((post) => (
            <div
              key={post.slug}
              className="flex w-[82%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)] 2xl:w-[calc((100%-4.5rem)/4)]"
            >
              <PostCard post={post} headingLevel="h3" className="w-full" />
            </div>
          ))}
        </PostCarousel>
      </div>
    </section>
  );
}
