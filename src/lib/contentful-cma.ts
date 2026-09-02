/**
 * The little slice of the Contentful Management API the scheduled jobs share.
 * Both /api/expire-offers and /api/check-rebates read every entry of a content
 * type and write a field back, and each had grown its own copy of the fetch
 * plumbing.
 */

export const LOCALE = "en-US";

export interface CmaEntry {
  sys: { id: string; version: number; publishedVersion?: number; contentType?: { sys: { id: string } } };
  fields: Record<string, Record<string, unknown>>;
}

export interface CmaClient {
  base: string;
  headers: Record<string, string>;
}

export function cmaClient(spaceId: string, managementToken: string): CmaClient {
  return {
    base: `https://api.contentful.com/spaces/${spaceId}/environments/master`,
    headers: { Authorization: `Bearer ${managementToken}` },
  };
}

/** One locale's value off an entry field. */
export function field<T>(entry: CmaEntry, name: string): T | undefined {
  return entry.fields[name]?.[LOCALE] as T | undefined;
}

/**
 * Hạn giờ cho một lượt gọi CMA.
 *
 * `fetch` của Node không tự bỏ cuộc khi máy chủ mở kết nối rồi im: nó chờ tới
 * mặc định của undici. Ba job đều gọi bằng `curl --max-time 300 --retry 3
 * --retry-all-errors`, nên một lượt treo không đỏ ngay — curl cắt rồi chạy
 * lại, và 15 phút trôi qua mà không thẻ nào sau cái bị treo được xử lý. Cùng
 * lý do `api/revalidate` và `api/sync-videos` đã có `AbortSignal`; hai file
 * dùng chung này bị bỏ sót ở lượt đó.
 */
const CMA_TIMEOUT_MS = 20_000;

/**
 * Bọc MỌI lượt gọi CMA, kể cả những lượt nằm ngoài file này — `unpublish` của
 * `expire-offers` là một, và bỏ sót đúng một lượt là đủ để job treo tới lúc
 * `curl --max-time 300` cắt, đúng cái nó sinh ra để chặn.
 */
export function cmaInit(init: RequestInit & { headers: Record<string, string> }): RequestInit {
  return { ...init, cache: "no-store", signal: AbortSignal.timeout(CMA_TIMEOUT_MS) };
}

/**
 * Every entry of a content type, following Contentful's pagination.
 *
 * CON TRỎ MỜ (`cursor=true` → `pages.next`), KHÔNG phải `skip`. Cùng lý do
 * `lib/content/contentful.ts` đã bỏ `skip` ở phía CDA: một entry rơi khỏi tập
 * kết quả giữa hai lượt lấy làm những entry sau dồn lên, và vài cái còn lại bị
 * nhảy qua trong im lặng. Ở đây hậu quả nặng hơn phía CDA — entry bị nhảy qua
 * là một offer hết hạn không được gỡ, hoặc một thẻ không được đối chiếu rebate,
 * mà job vẫn trả 200 nên không có gì để ai nhìn thấy.
 *
 * Chưa loại nội dung nào chạm 100 entry, nên đây là vá trước khi cháy chứ
 * không phải sau. Đã đo trên chính space này với `limit=2` và đúng filter
 * `fields.expiresAt[lte]` mà `expire-offers` dùng: cursor giữ nguyên filter
 * qua từng trang và trả ra đúng tập kết quả như `skip`.
 *
 * Ở chế độ cursor Contentful KHÔNG trả `total`, nên điều kiện dừng là
 * `pages.next` vắng mặt — đừng thay lại bằng phép đếm.
 */
export async function listEntries(
  client: CmaClient,
  contentType: string,
  query = "",
): Promise<CmaEntry[]> {
  const entries: CmaEntry[] = [];
  let url = `${client.base}/entries?content_type=${contentType}&limit=100&cursor=true${query}`;

  for (;;) {
    const res = await fetch(url, cmaInit({ headers: client.headers }));
    // Without this a failed listing reads as an empty page, and the run
    // reports "checked 0, nothing to do" as though it had succeeded.
    if (!res.ok) throw new Error(`Listing ${contentType} failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    entries.push(...((data.items ?? []) as CmaEntry[]));

    // `pages.next` là một ĐƯỜNG DẪN tương đối trên api.contentful.com và đã
    // mang sẵn cả `content_type`, `limit` lẫn `query` ban đầu — nối thêm
    // `query` lần nữa là gửi trùng tham số.
    const next = data.pages?.next;
    if (typeof next !== "string" || !next) return entries;
    url = new URL(next, "https://api.contentful.com").toString();
  }
}

/**
 * Write changed fields back and, when the entry was already live, publish the
 * new version so the change actually reaches the site. An entry sitting in
 * draft stays in draft — a job should not put something live that a human
 * deliberately held back.
 */
export async function updateEntry(
  client: CmaClient,
  entry: CmaEntry,
  contentType: string,
  changes: Record<string, unknown>,
): Promise<void> {
  const fields = { ...entry.fields };
  for (const [name, value] of Object.entries(changes)) {
    if (value === undefined) delete fields[name];
    else fields[name] = { [LOCALE]: value };
  }

  const res = await fetch(
    `${client.base}/entries/${entry.sys.id}`,
    cmaInit({
      method: "PUT",
      headers: {
        ...client.headers,
        "X-Contentful-Version": String(entry.sys.version),
        "Content-Type": "application/vnd.contentful.management.v1+json",
      },
      body: JSON.stringify({ fields }),
    }),
  );
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);

  if (!entry.sys.publishedVersion) return;

  const updated = (await res.json()) as CmaEntry;
  const published = await fetch(
    `${client.base}/entries/${entry.sys.id}/published`,
    cmaInit({
      method: "PUT",
      headers: {
        ...client.headers,
        "X-Contentful-Version": String(updated.sys.version),
        "X-Contentful-Content-Type": contentType,
      },
    }),
  );
  if (!published.ok) throw new Error(`Publish failed: ${published.status} ${await published.text()}`);
}
