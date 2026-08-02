import { NextRequest, NextResponse } from "next/server";

// Called on a schedule (see .github/workflows/sync-videos.yml) to auto-post
// new @HoangLeCA videos as `blogPost` (type: "video") entries — no manual
// Contentful entry needed when a new video goes up.
const YOUTUBE_CHANNEL_ID = "UCmTc2_5Xeba9CPpAm87TnoQ";
const LOCALE = "en-US";

interface VideoEntry {
  videoId: string;
  videoUrl: string;
  title: string;
  publishedAt: string;
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.SYNC_VIDEOS_SECRET || secret !== process.env.SYNC_VIDEOS_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const cmaBase = `https://api.contentful.com/spaces/${spaceId}/environments/master`;
  const authHeaders = { Authorization: `Bearer ${managementToken}` };

  const videos = await fetchLatestVideos();
  const existingUrls = await fetchExistingVideoUrls(cmaBase, authHeaders);

  const created: string[] = [];
  const errors: { videoUrl: string; message: string }[] = [];

  for (const video of videos) {
    if (existingUrls.has(video.videoUrl)) continue;
    try {
      await createVideoPost(video, cmaBase, authHeaders);
      created.push(video.videoUrl);
    } catch (err) {
      errors.push({ videoUrl: video.videoUrl, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ checked: videos.length, created, errors });
}

async function fetchLatestVideos(): Promise<VideoEntry[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`, {
    cache: "no-store",
  });
  const xml = await res.text();
  const entries: VideoEntry[] = [];

  for (const block of xml.split("<entry>").slice(1)) {
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>([^<]*)<\/title>/)?.[1];
    const publishedAt = block.match(/<published>([^<]+)<\/published>/)?.[1];
    const isShort = block.includes("/shorts/");
    if (!videoId || !title || !publishedAt || isShort) continue;

    entries.push({
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: decodeXmlEntities(title),
      publishedAt,
    });
  }

  return entries;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchExistingVideoUrls(
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<Set<string>> {
  const urls = new Set<string>();
  let skip = 0;
  const limit = 100;

  for (;;) {
    const res = await fetch(
      `${cmaBase}/entries?content_type=blogPost&fields.type=video&skip=${skip}&limit=${limit}`,
      { headers: authHeaders, cache: "no-store" },
    );
    const data = await res.json();
    for (const item of data.items ?? []) {
      const url = item.fields?.videoUrl?.[LOCALE];
      if (url) urls.add(url);
    }
    skip += limit;
    if (skip >= (data.total ?? 0)) break;
  }

  return urls;
}

function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

const HOTEL_KEYWORDS = [
  "hotel",
  "resort",
  "suite",
  "hyatt",
  "marriott",
  "andaz",
  "regency",
  "kimpton",
  "moxy",
  "element",
  "courtyard",
  "bonvoy",
  "caption",
];

function categorize(title: string): { categoryVi: string; categoryEn: string; icon: "airplane" | "building" } {
  const lower = title.toLowerCase();
  if (HOTEL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { categoryVi: "Khách sạn", categoryEn: "Hotel", icon: "building" };
  }
  return { categoryVi: "Đánh giá", categoryEn: "Review", icon: "airplane" };
}

async function createVideoPost(
  video: VideoEntry,
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<void> {
  const slug = slugify(video.title);
  const { categoryVi, categoryEn, icon } = categorize(video.title);
  const excerpt = `Video mới từ Ghế 1A: ${video.title}.`;
  const body = {
    nodeType: "document",
    data: {},
    content: [
      { nodeType: "paragraph", data: {}, content: [{ nodeType: "text", value: excerpt, marks: [], data: {} }] },
    ],
  };

  const fields = {
    slug: { [LOCALE]: slug },
    type: { [LOCALE]: "video" },
    categoryVi: { [LOCALE]: categoryVi },
    categoryEn: { [LOCALE]: categoryEn },
    titleVi: { [LOCALE]: video.title },
    titleEn: { [LOCALE]: video.title },
    excerptVi: { [LOCALE]: excerpt },
    excerptEn: { [LOCALE]: excerpt },
    bodyVi: { [LOCALE]: body },
    bodyEn: { [LOCALE]: body },
    coverImage: { [LOCALE]: icon },
    videoUrl: { [LOCALE]: video.videoUrl },
    publishedAt: { [LOCALE]: video.publishedAt },
    minutesRead: { [LOCALE]: 10 },
    author: { [LOCALE]: "Hoàng" },
  };

  const entryId = `post-${slug}`;
  const createRes = await fetch(`${cmaBase}/entries/${entryId}`, {
    method: "PUT",
    headers: {
      ...authHeaders,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      "X-Contentful-Content-Type": "blogPost",
    },
    body: JSON.stringify({ fields }),
  });
  if (!createRes.ok) throw new Error(`create entry failed: ${await createRes.text()}`);
  const created = await createRes.json();

  const publishRes = await fetch(`${cmaBase}/entries/${entryId}/published`, {
    method: "PUT",
    headers: { ...authHeaders, "X-Contentful-Version": String(created.sys.version) },
  });
  if (!publishRes.ok) throw new Error(`publish entry failed: ${await publishRes.text()}`);
}
