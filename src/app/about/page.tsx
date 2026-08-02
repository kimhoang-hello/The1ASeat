import type { Metadata } from "next";
import { getAuthor } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { boldOccurrences } from "@/lib/bold-occurrences";
import { t } from "@/lib/t";

const author = t("author");
const nav = t("nav");

export const metadata: Metadata = { title: nav("about") };

export default async function AboutPage() {
  const site = t("site");
  const authorProfile = await getAuthor();

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
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
