/**
 * Chờ một promise tối đa `timeoutMs`, không bao giờ ném.
 *
 * Dùng cho dữ liệu PHỤ của một trang (xem `getPostsWithin` trong
 * `lib/content`): quá hạn hay lỗi thì trang bỏ phần đó và render tiếp.
 *
 * KHÔNG huỷ được lượt gọi thua cuộc — `Promise.race` không huỷ gì cả (AGENTS.md
 * đã ghi cái giá đó ở `api/revalidate`). Vì vậy chỉ dùng cho lượt gọi tự có
 * giới hạn thời gian riêng (SDK Contentful), và promise được gắn `catch` rỗng
 * TRƯỚC khi đua: thua rồi mới reject thì không còn ai chờ, và một rejection
 * không ai bắt là đủ làm Node dừng cả tiến trình.
 *
 * File thuần, không import gì, để `node --test` chạy trực tiếp.
 */
export type Settled<T> = { ok: true; value: T } | { ok: false; reason: "timeout" } | { ok: false; reason: "error"; error: unknown };

export async function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<Settled<T>> {
  promise.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<"__timeout__">((resolve) => {
    timer = setTimeout(() => resolve("__timeout__"), Math.max(0, timeoutMs));
  });
  try {
    const value = await Promise.race([promise, expired]);
    if (value === "__timeout__") return { ok: false, reason: "timeout" };
    return { ok: true, value: value as T };
  } catch (error) {
    return { ok: false, reason: "error", error };
  } finally {
    clearTimeout(timer);
  }
}
