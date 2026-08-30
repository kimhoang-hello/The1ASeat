import type { Metadata } from "next";
import Link from "next/link";
import { EDITORIAL_REL } from "@/lib/affiliate-links";
import { ArrowRight, YoutubeLogo } from "@phosphor-icons/react/ssr";
import { FacebookIcon } from "@/components/ui/brand-icons";
import { getAuthor } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { boldOccurrences } from "@/lib/bold-occurrences";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import { SOCIAL_LINKS, PERSON_SAME_AS } from "@/lib/social-links";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";

const author = t("author");
const next = t("nextSteps");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("aboutTitle"),
  description: seo("aboutDescription"),
  path: "/about",
});

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export default async function AboutPage() {
  const site = t("site");
  const authorProfile = await getAuthor();

  // ProfilePage + Person gives the author an entity Google can tie every
  // BlogPosting's `author` back to, which is what E-E-A-T signals hang off for
  // a finance-adjacent site.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${absoluteUrl("/about")}#profile`,
    url: absoluteUrl("/about"),
    inLanguage: "vi-VN",
    isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
    mainEntity: {
      "@type": "Person",
      "@id": `${absoluteUrl("/about")}#person`,
      name: authorProfile.name,
      description: authorProfile.bio.split("\n\n")[0],
      url: absoluteUrl("/about"),
      ...(authorProfile.photo && { image: authorProfile.photo }),
      sameAs: PERSON_SAME_AS,
      worksFor: { "@id": `${absoluteUrl("/")}/#organization` },
    },
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />
      <p className="text-xs font-semibold tracking-wide text-primary">{author("eyebrow")}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
        {author("title", { name: authorProfile.name })}
      </h1>

      <AuthorPhoto
        photo={authorProfile.photo}
        name={authorProfile.name}
        className="mt-8 h-56 w-56"
        rounded="rounded-full"
      />

      <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/90">
        {authorProfile.bio.split("\n\n").map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{boldOccurrences(paragraph, "Ghế 1A")}</p>
        ))}
      </div>

      {/* Bio khép lại bằng "Hẹn gặp bạn ở ghế 1A" — một lời mời, nhưng không
          nói đi đâu. Nút này là chỗ duy nhất trên trang trả lời câu đó, nên nó
          đứng ngay sau bio chứ không xuống dưới khối mạng xã hội: người đọc
          xong phần giới thiệu mà thấy hợp thì bước tiếp luôn, còn ai muốn theo
          dõi thì vẫn gặp link kênh ở ngay dưới.

          Cùng nhãn với nút trong email chào mừng (api/subscribe/route.ts), vì
          hai chỗ này nối vào cùng một trang từ cùng một đoạn văn — người đã
          đọc email rồi ghé trang này nên thấy đúng một lối, không phải hai tên
          gọi khác nhau cho cùng một thứ.

          Gác sau cờ như mọi lối vào /bat-dau khác (trang chủ, sitemap, search):
          tắt cờ thì trang này cũng thôi mời, không dẫn vào trang nháp. */}
      {START_HERE_PUBLISHED && (
        <Link
          href="/bat-dau"
          className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover max-[359px]:text-sm"
        >
          {author("startHereCta")}
          <ArrowRight size={18} weight="bold" />
        </Link>
      )}

      {/* Trang này trước đây chỉ có đúng MỘT link nội bộ (nút /bat-dau ở trên),
          và nút đó lại nằm sau cờ — tắt cờ là trang không còn đường nào dẫn
          vào phần nội dung của site. Hai đường dưới đây là thứ người vừa đọc
          xong phần giới thiệu muốn xem tiếp: bài anh viết, và thẻ anh theo
          dõi. */}
      <NextSteps title={author("exploreTitle")} className="mt-12">
        <StepLink
          href="/blog"
          label={next("blogLabel")}
          description={next("blogDescription")}
        />
        <StepLink
          href="/credit-cards"
          label={next("cardsLabel")}
          description={next("cardsDescription")}
        />
      </NextSteps>

      {/* The channel and the group are where readers actually follow along, so
          they get named links here rather than bare icons — this page is the
          one place someone lands specifically to find out who's behind Ghế 1A. */}
      <div className="mt-10 border-t border-border pt-6">
        <p className="text-sm font-semibold text-foreground">{author("connect")}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {SOCIAL_LINKS.map(({ name, url }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel={EDITORIAL_REL}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {name === "YouTube" ? (
                <YoutubeLogo size={20} weight="fill" />
              ) : (
                <FacebookIcon size={18} />
              )}
              {name}
            </a>
          ))}
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        {site("name")} — {site("tagline")}
      </p>
    </section>
  );
}
