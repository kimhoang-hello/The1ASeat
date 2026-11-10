import { unstable_cache } from "next/cache";
import authorFallback from "./author-fallback.json";
import {
  fetchContentfulAuthor,
  fetchContentfulCreditCardOffers,
  fetchContentfulPosts,
  fetchContentfulTransferBonuses,
} from "./contentful";
import { isElevatedLive } from "../credit-card-state";
import { settleWithin } from "../deadline";
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
  return getCachedPosts();
}

/**
 * Danh sách bài cho trang chỉ dùng bài viết làm dữ liệu PHỤ — hôm nay là hai
 * trang khách sạn, nơi nội dung chính nằm trong repo và bài viết chỉ quyết định
 * link nào sang blog được hiện. Quá `timeoutMs` hoặc lỗi thì `[]` + log: trang
 * vẫn ra đủ phần chính, chỉ mất các link sang blog.
 *
 * VÌ SAO CẦN HẠN: SDK Contentful tự thử lại tới 6 lượt × 30 giây khi request
 * treo. Sau webhook (`revalidateTag(…, { expire: 0 })` + `revalidatePath("/",
 * "layout")`) lượt render kế tiếp phải gọi thật, và Codex đo được trang khách
 * sạn có thể chờ ~199 giây chỉ vì phần phụ (14/10/2026).
 *
 * Lượt gọi thua cuộc KHÔNG bị huỷ (SDK không nhận `AbortSignal`) — nó chạy nốt
 * trong nền và nạp cache khi xong, trong giới hạn thời gian của chính SDK. Phần
 * đua và chặn unhandled rejection nằm ở `settleWithin` (`lib/deadline.ts`, có
 * test riêng).
 */
export function getPostsWithin(timeoutMs: number, label: string): Promise<BlogPost[]> {
  return secondaryList(getPosts(), timeoutMs, label, "danh sách bài viết", "bỏ các link sang blog");
}

/**
 * Thẻ / transfer bonus làm dữ liệu PHỤ — cùng lý do và cùng cái giá với
 * `getPostsWithin` ngay trên. Bản 10/10/2026 của các trang này chỉ `.catch()`:
 * bắt được LỖI, không bắt được lượt gọi TREO (Codex 17/10/2026). `dropped` là
 * phần trang bỏ đi, để log nói đúng người đọc mất gì.
 */
export function getCreditCardOffersWithin(
  timeoutMs: number,
  label: string,
  dropped: string,
): Promise<CreditCardOffer[]> {
  return secondaryList(getCreditCardOffers(), timeoutMs, label, "danh sách thẻ", dropped);
}

export function getTransferBonusesWithin(
  timeoutMs: number,
  label: string,
  dropped: string,
): Promise<TransferBonus[]> {
  return secondaryList(getTransferBonuses(), timeoutMs, label, "transfer bonus", dropped);
}

/** Quá hạn hoặc lỗi thì `[]` + log. Bắt ở đây, KHÔNG trong hàm cache — không thì mảng rỗng bị cache như dữ liệu thật. */
async function secondaryList<T>(
  load: Promise<T[]>,
  timeoutMs: number,
  label: string,
  what: string,
  dropped: string,
): Promise<T[]> {
  const result = await settleWithin(load, timeoutMs);
  if (result.ok) return result.value;
  if (result.reason === "timeout") {
    console.error(`[${label}] ${what} quá ${timeoutMs}ms, ${dropped}`);
  } else {
    console.error(`[${label}] không tải được ${what}, ${dropped}`, result.error);
  }
  return [];
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
  const offers = await getCachedCreditCardOffers();
  return [...offers].sort((a, b) => creditCardPriority(a) - creditCardPriority(b));
}

export async function getCreditCardOfferBySlug(slug: string): Promise<CreditCardOffer | undefined> {
  const offers = await getCreditCardOffers();
  return offers.find((offer) => offer.slug === slug);
}

/**
 * Transfer bonus CANADA (Contentful). Bonus Mỹ: `getUsTransferBonuses()` trong
 * `us-transfer-bonuses-data.ts` — hai nguồn tách riêng có chủ ý, vì vài chỗ
 * (nút "đi tiếp" của bài deal Canada) chỉ được tính bonus Canada.
 */
export async function getTransferBonuses(): Promise<TransferBonus[]> {
  // Gắn lại `region` NGOÀI cache: bản cache dựng trước 06/11/2026 không có
  // trường này, và trang lọc theo nó — thiếu là bonus Canada biến mất tới
  // lúc cache hết hạn.
  const bonuses = await getCachedTransferBonuses();
  return bonuses.map((bonus) => ({ ...bonus, region: "ca" }));
}

/**
 * Entry `author` bị unpublish (CDA trả 0 dòng) thì dùng bản dự phòng trong
 * repo — bio thật của tác giả chép lúc dựng site, không phải nội dung giả.
 * Trang chủ và trang Giới thiệu nhờ vậy không gãy vì một cú bấm nhầm. Lỗi gọi
 * Contentful thì vẫn ném như mọi hàm khác ở đây.
 */
export async function getAuthor(): Promise<AuthorProfile> {
  return (await getCachedAuthor()) ?? (authorFallback as AuthorProfile);
}

export * from "./types";
