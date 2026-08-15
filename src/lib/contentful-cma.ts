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

/** Every entry of a content type, following Contentful's pagination. */
export async function listEntries(
  client: CmaClient,
  contentType: string,
  query = "",
): Promise<CmaEntry[]> {
  const entries: CmaEntry[] = [];
  const limit = 100;
  let skip = 0;

  for (;;) {
    const res = await fetch(
      `${client.base}/entries?content_type=${contentType}&skip=${skip}&limit=${limit}${query}`,
      { headers: client.headers, cache: "no-store" },
    );
    // Without this a failed listing reads as an empty page, and the run
    // reports "checked 0, nothing to do" as though it had succeeded.
    if (!res.ok) throw new Error(`Listing ${contentType} failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    entries.push(...((data.items ?? []) as CmaEntry[]));
    skip += limit;
    if (skip >= (data.total ?? 0)) break;
  }

  return entries;
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

  const res = await fetch(`${client.base}/entries/${entry.sys.id}`, {
    method: "PUT",
    headers: {
      ...client.headers,
      "X-Contentful-Version": String(entry.sys.version),
      "Content-Type": "application/vnd.contentful.management.v1+json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);

  if (!entry.sys.publishedVersion) return;

  const updated = (await res.json()) as CmaEntry;
  const published = await fetch(`${client.base}/entries/${entry.sys.id}/published`, {
    method: "PUT",
    headers: {
      ...client.headers,
      "X-Contentful-Version": String(updated.sys.version),
      "X-Contentful-Content-Type": contentType,
    },
  });
  if (!published.ok) throw new Error(`Publish failed: ${published.status} ${await published.text()}`);
}
