import {
  fetchContentfulAuthor,
  fetchContentfulCreditCardOffers,
  fetchContentfulPosts,
  fetchContentfulTransferBonuses,
  isContentfulConfigured,
} from "./contentful";
import {
  getSampleAuthor,
  getSampleCreditCardOffers,
  getSamplePosts,
  getSampleTransferBonuses,
} from "./sample";
import type { AuthorProfile, BlogPost, CreditCardOffer, TransferBonus } from "./types";

export async function getPosts(): Promise<BlogPost[]> {
  if (isContentfulConfigured) return fetchContentfulPosts();
  return getSamplePosts();
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug);
}

export async function getCreditCardOffers(): Promise<CreditCardOffer[]> {
  if (isContentfulConfigured) return fetchContentfulCreditCardOffers();
  return getSampleCreditCardOffers();
}

export async function getCreditCardOfferBySlug(slug: string): Promise<CreditCardOffer | undefined> {
  const offers = await getCreditCardOffers();
  return offers.find((offer) => offer.slug === slug);
}

export async function getTransferBonuses(): Promise<TransferBonus[]> {
  if (isContentfulConfigured) return fetchContentfulTransferBonuses();
  return getSampleTransferBonuses();
}

export async function getAuthor(): Promise<AuthorProfile> {
  if (isContentfulConfigured) {
    const author = await fetchContentfulAuthor();
    if (author) return author;
  }
  return getSampleAuthor();
}

export * from "./types";
