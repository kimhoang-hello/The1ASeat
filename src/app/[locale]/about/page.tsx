import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getAuthor } from "@/lib/content";
import { pickLocale } from "@/lib/pick-locale";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "author" });
  return { title: t("eyebrow") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: routeLocale } = await params;
  setRequestLocale(routeLocale);

  const [t, site, locale, author] = await Promise.all([
    getTranslations("author"),
    getTranslations("site"),
    getLocale(),
    getAuthor(),
  ]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
        {t("title", { name: author.name })}
      </h1>

      <MediaPlaceholder icon="avatar" tone="navy" className="mt-8 h-56 w-56 rounded-2xl" />

      <p className="mt-8 text-lg leading-relaxed text-foreground/90">
        {pickLocale(author.bio, locale)}
      </p>

      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        {site("name")} — {site("tagline")}
      </p>
    </section>
  );
}
