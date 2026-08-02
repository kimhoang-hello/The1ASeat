import Link from "next/link";
import { t as translate } from "@/lib/t";
import { getAuthor } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { boldOccurrences } from "@/lib/bold-occurrences";

const t = translate("author");

export async function AuthorSection() {
  const author = await getAuthor();

  const [firstParagraph] = author.bio.split("\n\n");

  return (
    <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {t("title", { name: author.name })}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {boldOccurrences(firstParagraph, "Ghế 1A")}
          </p>
          <Link
            href="/about"
            className="mt-5 inline-block cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
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
      </div>
    </section>
  );
}
