import type { Metadata } from "next";
import { getAuthor } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { boldOccurrences } from "@/lib/bold-occurrences";
import { JsonLd } from "@/components/seo/json-ld";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl } from "@/lib/seo";

const author = t("author");
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
      sameAs: ["https://youtube.com/@hoangleca"],
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

      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        {site("name")} — {site("tagline")}
      </p>
    </section>
  );
}
