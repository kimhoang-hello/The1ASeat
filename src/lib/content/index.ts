import { unstable_cache } from "next/cache";
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
import { isElevatedLive } from "../credit-card-state";
import type { AuthorProfile, BlogPost, CreditCardOffer, TransferBonus } from "./types";

/**
 * Mọi thứ đọc từ Contentful đi qua một lớp cache chung.
 *
 * VÌ SAO PHẢI TỰ CACHE: SDK Contentful gọi API bằng **axios**, không phải
 * `fetch`. Next chỉ cache được `fetch`, nên không một cơ chế nào có sẵn của
 * nó — kể cả `export const revalidate` ở đầu mỗi trang — nhìn thấy request
 * này. Trang `/credit-cards` là chỗ hậu quả rõ nhất: hai bộ lọc `?type=` và
 * `?points=` làm nó thành route động, và động cộng với không cache nghĩa là
 * mỗi lượt truy cập là một lần gọi Contentful thật, đo được 120ms so với 2ms
 * của các trang tĩnh. Lúc build cũng vậy: 22 trang thẻ, mỗi trang gọi lại
 * `getCreditCardOffers` một lần cho cùng một danh sách.
 *
 * 60 giây khớp với `revalidate = 60` của các trang, và không phải chờ hết 60
 * giây mới thấy nội dung mới: webhook publish của Contentful gọi
 * `revalidateTag(CONTENTFUL_TAG)` (xem `app/api/revalidate/route.ts`), nên
 * bấm Publish là trang đổi ngay.
 *
 * `unstable_cache` là API mà Next 16 ghi "đã được thay bằng `use cache`".
 * Bản mới đòi bật `cacheComponents: true` cho toàn site, phải rà lại
 * `revalidate` của từng route — không đáng làm chỉ vì chỗ này. Ngày nào
 * chuyển sang Cache Components thì bốn chỗ dưới đây đổi thành `'use cache'`.
 */
export const CONTENTFUL_TAG = "contentful";

function cached<T>(fetcher: () => Promise<T>, key: string) {
  return unstable_cache(fetcher, [key], { tags: [CONTENTFUL_TAG], revalidate: 60 });
}

const getCachedPosts = cached(fetchContentfulPosts, "contentful-posts");
const getCachedCreditCardOffers = cached(
  fetchContentfulCreditCardOffers,
  "contentful-credit-card-offers",
);
const getCachedTransferBonuses = cached(fetchContentfulTransferBonuses, "contentful-transfer-bonuses");
const getCachedAuthor = cached(fetchContentfulAuthor, "contentful-author");

export async function getPosts(): Promise<BlogPost[]> {
  if (isContentfulConfigured) return getCachedPosts();
  return getSamplePosts();
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug);
}

function creditCardPriority(offer: CreditCardOffer): number {
  if (isElevatedLive(offer)) return 0;
  if (offer.issuer.includes("American Express")) return 1;
  return 2;
}

export async function getCreditCardOffers(): Promise<CreditCardOffer[]> {
  // Sắp xếp nằm ngoài cache: thứ tự là quyết định của site, không phải dữ
  // liệu Contentful trả về, nên đổi nó không cần chờ cache hết hạn.
  const offers = isContentfulConfigured
    ? await getCachedCreditCardOffers()
    : await getSampleCreditCardOffers();
  return [...offers].sort((a, b) => creditCardPriority(a) - creditCardPriority(b));
}

export async function getCreditCardOfferBySlug(slug: string): Promise<CreditCardOffer | undefined> {
  const offers = await getCreditCardOffers();
  return offers.find((offer) => offer.slug === slug);
}

export async function getTransferBonuses(): Promise<TransferBonus[]> {
  if (isContentfulConfigured) return getCachedTransferBonuses();
  return getSampleTransferBonuses();
}

export async function getAuthor(): Promise<AuthorProfile> {
  if (isContentfulConfigured) {
    const author = await getCachedAuthor();
    if (author) return author;
  }
  return getSampleAuthor();
}

export * from "./types";
