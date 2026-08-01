import postsData from "../../../content/sample/posts.json";
import creditCardsData from "../../../content/sample/credit-cards.json";
import transferBonusesData from "../../../content/sample/transfer-bonuses.json";
import authorData from "../../../content/sample/author.json";
import type { AuthorProfile, BlogPost, CreditCardOffer, TransferBonus } from "./types";

export function getSamplePosts(): BlogPost[] {
  return postsData as BlogPost[];
}

export function getSampleCreditCardOffers(): CreditCardOffer[] {
  return creditCardsData as CreditCardOffer[];
}

export function getSampleTransferBonuses(): TransferBonus[] {
  return transferBonusesData as TransferBonus[];
}

export function getSampleAuthor(): AuthorProfile {
  return authorData as AuthorProfile;
}
