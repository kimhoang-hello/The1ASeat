import Link from "next/link";
import { t as translate, BRAND_NO_BREAK, keepBrandTogether } from "@/lib/t";
import { getAuthor } from "@/lib/content";
import { AuthorPhoto } from "@/components/ui/author-photo";
import { boldOccurrences } from "@/lib/bold-occurrences";

const t = translate("author");

export async function AuthorSection() {
  const author = await getAuthor();

  const [firstParagraph] = author.bio.split("\n\n");

  return (
    <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-page gap-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary sm:text-sm">{t("eyebrow")}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl xl:text-4xl">
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
      </div>
    </section>
  );
}
