import { Hero } from "@/components/home/hero";
import { OffersSection } from "@/components/home/offers-section";
import { PostsSection } from "@/components/home/posts-section";
import { TransferBonusesSection } from "@/components/home/transfer-bonuses-section";
import { AuthorSection } from "@/components/home/author-section";
import { NewsletterCta } from "@/components/home/newsletter-cta";

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
