import { NextRequest, NextResponse } from "next/server";

// Called on a schedule (see .github/workflows/expire-offers.yml) to
// unpublish (never delete) creditCardOffer/transferBonus entries whose
// expiresAt has passed, so an elevated offer that comes back later can just
// be republished instead of recreated from scratch.
const LOCALE = "en-US";
const EXPIRABLE_CONTENT_TYPES = ["creditCardOffer", "transferBonus"] as const;

export async function POST(request: NextRequest) {
  return handleExpire(request);
}

export async function GET(request: NextRequest) {
  return handleExpire(request);
}

async function handleExpire(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.EXPIRE_OFFERS_SECRET || secret !== process.env.EXPIRE_OFFERS_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const cmaBase = `https://api.contentful.com/spaces/${spaceId}/environments/master`;
  const authHeaders = { Authorization: `Bearer ${managementToken}` };
  const nowIso = new Date().toISOString();

  const unpublished: string[] = [];
  const errors: { slug: string; message: string }[] = [];
  let checked = 0;

  for (const contentType of EXPIRABLE_CONTENT_TYPES) {
    const expired = await fetchExpiredEntries(contentType, nowIso, cmaBase, authHeaders);
    checked += expired.length;

    for (const entry of expired) {
      const slug = String(entry.fields?.slug?.[LOCALE] ?? entry.sys.id);
      try {
        const res = await fetch(`${cmaBase}/entries/${entry.sys.id}/published`, {
          method: "DELETE",
          headers: authHeaders,
        });
        // Already unpublished (e.g. by a previous run) — not an error.
        if (res.status === 404 || res.status === 400) continue;
        if (!res.ok) throw new Error(await res.text());
        unpublished.push(slug);
      } catch (err) {
        errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return NextResponse.json({ checked, unpublished, errors });
}

interface ContentfulCmaEntry {
  sys: { id: string; publishedVersion?: number };
  fields: Record<string, Record<string, unknown>>;
}

async function fetchExpiredEntries(
  contentType: string,
  nowIso: string,
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<ContentfulCmaEntry[]> {
  const expired: ContentfulCmaEntry[] = [];
  let skip = 0;
  const limit = 100;

  for (;;) {
    const res = await fetch(
      `${cmaBase}/entries?content_type=${contentType}&fields.expiresAt[lte]=${encodeURIComponent(nowIso)}&skip=${skip}&limit=${limit}`,
      { headers: authHeaders, cache: "no-store" },
    );
    // Without this a failed listing reads as an empty page, and the run
    // reports "checked 0, nothing expired" as though it had succeeded.
    if (!res.ok) throw new Error(`Listing ${contentType} failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    for (const item of (data.items ?? []) as ContentfulCmaEntry[]) {
      // Only entries that currently have a live published version need unpublishing.
      if (item.sys.publishedVersion) expired.push(item);
    }
    skip += limit;
    if (skip >= (data.total ?? 0)) break;
  }

  return expired;
}
