import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { StartHereBand } from "@/components/home/start-here-band";
import { OffersSection } from "@/components/home/offers-section";
import { PostsSection } from "@/components/home/posts-section";
import { TransferBonusesSection } from "@/components/home/transfer-bonuses-section";
import { AuthorSection } from "@/components/home/author-section";
import { NewsletterCta } from "@/components/home/newsletter-cta";
import { pageMetadata } from "@/lib/seo";
import { t } from "@/lib/t";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";

const site = t("site");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: `${site("name")} — ${seo("homeTitle")}`,
  description: seo("homeDescription"),
  path: "/",
  absoluteTitle: true,
});

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      {START_HERE_PUBLISHED && <StartHereBand />}
      <OffersSection />
      <PostsSection />
      <TransferBonusesSection />
      <AuthorSection />
      <NewsletterCta />
    </>
  );
}
