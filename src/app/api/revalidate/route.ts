import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Document } from "@contentful/rich-text-types";
import {
  SITE_URL,
  emailHeadlineStyle,
  emailParagraphStyle,
  escapeHtml,
  renderPostBodyForEmail,
  renderSubscriberEmailHtml,
} from "@/lib/subscriber-email";

const LOCALE = "en-US";

// Called by a Contentful webhook on publish/unpublish/delete so the site
// updates immediately instead of waiting for the next code deploy or a
// manual "Clear cache" click in the Hostinger dashboard. Also sends a Kit
// newsletter broadcast the first time a "post"-type blogPost is published
// (see maybeNotifyNewPost below).
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  revalidatePath("/", "layout");

  const hostingerCachePurged = await purgeHostingerCache();

  let newPostNotified: boolean | string = "no_payload";
  try {
    const payload: unknown = await request.json();
    newPostNotified = await maybeNotifyNewPost(payload);
  } catch {
    // No/invalid JSON body (e.g. a manual test ping) — nothing to notify about.
  }

  return NextResponse.json({ revalidated: true, hostingerCachePurged, newPostNotified });
}

async function purgeHostingerCache(): Promise<boolean | "not-configured"> {
  const token = process.env.HOSTINGER_API_TOKEN;
  const username = process.env.HOSTINGER_USERNAME;
  const domain = process.env.HOSTINGER_DOMAIN;
  if (!token || !username || !domain) return "not-configured";

  try {
    const res = await fetch(
      `https://developers.hostinger.com/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/cache/clear`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    return res.ok;
  } catch {
    return false;
  }
}

interface ContentfulEntryPayload {
  sys?: {
    id?: string;
    contentType?: { sys?: { id?: string } };
  };
  fields?: {
    type?: Record<string, string>;
    categoryVi?: Record<string, string>;
    titleVi?: Record<string, string>;
    excerptVi?: Record<string, string>;
    slug?: Record<string, string>;
  };
}

interface ManagementEntry {
  sys?: { publishedCounter?: number };
  fields?: { bodyVi?: Record<string, Document> };
}

// The webhook payload's `sys` is a trimmed snapshot that doesn't include
// `publishedCounter` (confirmed by inspecting a real delivery — Contentful
// only returns that field from a direct Content Management API fetch), so
// whether this is the entry's first-ever publish has to be looked up with a
// follow-up call instead of read off the webhook body directly. That same
// call also hands us the full `bodyVi` rich-text document — the webhook
// payload's `fields` are read straight off the trimmed request body above,
// but the body text is long enough that fetching it fresh here is simpler
// than trusting it survived the trimming too.
async function fetchManagementEntry(entryId: string): Promise<ManagementEntry | "not-configured" | null> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) return "not-configured";

  const res = await fetch(
    `https://api.contentful.com/spaces/${spaceId}/environments/master/entries/${entryId}`,
    { headers: { Authorization: `Bearer ${managementToken}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

// Sends a Kit newsletter broadcast the first time a "post"-type blogPost
// entry is published. Skips video posts and Deals posts (transfer bonus /
// points-buy promos age out fast and aren't worth a broadcast), and skips
// edits/republishes of an already-published post.
async function maybeNotifyNewPost(payload: unknown): Promise<boolean | string> {
  const entry = payload as ContentfulEntryPayload;

  if (entry?.sys?.contentType?.sys?.id !== "blogPost") return "not_blog_post";
  if (entry.fields?.type?.[LOCALE] !== "post") return "video_post";
  if (entry.fields?.categoryVi?.[LOCALE]?.trim().toLowerCase() === "deals") return "deals_post";

  const entryId = entry.sys?.id;
  if (!entryId) return "missing_entry_id";

  const managementEntry = await fetchManagementEntry(entryId);
  if (managementEntry === "not-configured") return "not-configured";
  if (!managementEntry) return "fetch_failed";
  if (managementEntry.sys?.publishedCounter !== 1) return "not_first_publish";

  const apiKey = process.env.KIT_V4_API_KEY;
  if (!apiKey) return "not-configured";

  const title = entry.fields?.titleVi?.[LOCALE];
  const excerpt = entry.fields?.excerptVi?.[LOCALE];
  const slug = entry.fields?.slug?.[LOCALE];
  if (!title || !slug) return "missing_fields";

  const bodyDocument = managementEntry.fields?.bodyVi?.[LOCALE];
  const now = new Date();

  const bodyHtml = `
    <p style="${emailParagraphStyle}" class="email-text">Có bài viết mới trên Ghế 1A:</p>
    <p style="${emailHeadlineStyle}" class="email-brand">${escapeHtml(title)}</p>
    ${bodyDocument ? renderPostBodyForEmail(bodyDocument) : ""}
  `;
  const html = renderSubscriberEmailHtml({
    title,
    preheader: excerpt ?? title,
    bodyHtml,
    ctaHref: `${SITE_URL}/blog`,
    ctaLabel: "Đọc các bài viết khác tại Ghế 1A →",
  });

  const res = await fetch("https://api.kit.com/v4/broadcasts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kit-Api-Key": apiKey },
    body: JSON.stringify({
      email_address: "info@ghe1a.com",
      subject: title,
      preview_text: excerpt ?? title,
      description: `Auto-sent for new post: ${slug}`,
      content: html,
      subscriber_filter: [],
      public: false,
      published_at: now.toISOString(),
      send_at: new Date(now.getTime() + 5000).toISOString(),
    }),
  });

  if (!res.ok) {
    console.error("Kit broadcast failed", res.status, await res.text());
    return false;
  }

  return true;
}
