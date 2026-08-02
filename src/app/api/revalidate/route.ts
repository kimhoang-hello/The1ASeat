import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Called by a Contentful webhook on publish/unpublish/delete so the site
// updates immediately instead of waiting for the next code deploy or a
// manual "Clear cache" click in the Hostinger dashboard.
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  revalidatePath("/", "layout");

  const hostingerCachePurged = await purgeHostingerCache();

  return NextResponse.json({ revalidated: true, hostingerCachePurged });
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
