import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/home/hero";
import { StatsBar } from "@/components/home/stats-bar";
import { OffersSection } from "@/components/home/offers-section";
import { PostsSection } from "@/components/home/posts-section";
import { TransferBonusesSection } from "@/components/home/transfer-bonuses-section";
import { AuthorSection } from "@/components/home/author-section";
import { NewsletterCta } from "@/components/home/newsletter-cta";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <StatsBar />
      <OffersSection />
      <PostsSection />
      <TransferBonusesSection />
      <AuthorSection />
      <NewsletterCta />
    </>
  );
}
