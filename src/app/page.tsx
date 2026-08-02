import { Hero } from "@/components/home/hero";
import { OffersSection } from "@/components/home/offers-section";
import { PostsSection } from "@/components/home/posts-section";
import { TransferBonusesSection } from "@/components/home/transfer-bonuses-section";
import { AuthorSection } from "@/components/home/author-section";
import { NewsletterCta } from "@/components/home/newsletter-cta";

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      <OffersSection />
      <PostsSection />
      <TransferBonusesSection />
      <AuthorSection />
      <NewsletterCta />
    </>
  );
}
