import type { Metadata } from "next";
import { EDITORIAL_REL } from "@/lib/affiliate-links";
import { YoutubeLogo } from "@phosphor-icons/react/ssr";
import { FacebookIcon } from "@/components/ui/brand-icons";
import { getAuthor } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { boldOccurrences } from "@/lib/bold-occurrences";
import { JsonLd } from "@/components/seo/json-ld";
import { t } from "@/lib/t";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import { SOCIAL_LINKS, PERSON_SAME_AS } from "@/lib/social-links";

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
