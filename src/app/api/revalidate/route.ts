import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const SITE_URL = "https://ghe1a.com";
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
    contentType?: { sys?: { id?: string } };
    publishedCounter?: number;
  };
  fields?: {
    type?: Record<string, string>;
    titleVi?: Record<string, string>;
    excerptVi?: Record<string, string>;
    slug?: Record<string, string>;
  };
}

// Sends a Kit newsletter broadcast the first time a "post"-type blogPost
// entry is published. Skips video posts entirely, and skips edits/
// republishes of an already-published post via sys.publishedCounter (only
// fires when this is the entry's very first publish).
async function maybeNotifyNewPost(payload: unknown): Promise<boolean | string> {
  const entry = payload as ContentfulEntryPayload;

  if (entry?.sys?.contentType?.sys?.id !== "blogPost") return "not_blog_post";
  if (entry.sys?.publishedCounter !== 1) return "not_first_publish";
  if (entry.fields?.type?.[LOCALE] !== "post") return "video_post";

  const apiKey = process.env.KIT_V4_API_KEY;
  if (!apiKey) return "not-configured";

  const title = entry.fields?.titleVi?.[LOCALE];
  const excerpt = entry.fields?.excerptVi?.[LOCALE];
  const slug = entry.fields?.slug?.[LOCALE];
  if (!title || !slug) return "missing_fields";

  const postUrl = `${SITE_URL}/blog/${slug}`;
  const now = new Date();

  const res = await fetch("https://api.kit.com/v4/broadcasts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kit-Api-Key": apiKey },
    body: JSON.stringify({
      subject: title,
      preview_text: excerpt ?? title,
      description: `Auto-sent for new post: ${slug}`,
      content: `<p>${excerpt ?? ""}</p><p><a href="${postUrl}">Đọc bài viết đầy đủ tại Ghế 1A →</a></p>`,
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
