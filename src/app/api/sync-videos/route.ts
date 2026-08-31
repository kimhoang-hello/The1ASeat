import { NextRequest, NextResponse } from "next/server";
import { jobSecretValid } from "@/lib/job-auth";

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

// POST only, cùng lý do với hai job kia: đây là route tạo entry trong
// Contentful, không phải thứ để mở bằng browser.
export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  if (!jobSecretValid(request, process.env.SYNC_VIDEOS_SECRET)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const cmaBase = `https://api.contentful.com/spaces/${spaceId}/environments/master`;
  const authHeaders = { Authorization: `Bearer ${managementToken}` };

  // fetchLatestVideos / fetchExistingVideoUrls ném khi nguồn của chúng hỏng.
  // Bắt ở đây để trả 500 kèm lý do đọc được trong runtime log, thay vì để
  // Next dựng trang lỗi chung chung.
  let videos: VideoEntry[];
  let existing: { published: Set<string>; unpublished: Set<string> };
  try {
    videos = await fetchLatestVideos();
    existing = await fetchVideoUrlsByState(cmaBase, authHeaders);
  } catch (err) {
    // Log trước khi trả: workflow gọi bằng `curl -f` nên body bị nuốt, và Next
    // không log body mình tự trả. Không log ở đây thì người trực chỉ thấy đúng
    // một dòng 500 trống trong runtime log.
    console.error("[sync-videos] nguồn dữ liệu hỏng:", err);
    return NextResponse.json(
      {
        checked: 0,
        created: [],
        errors: [],
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const created: string[] = [];
  const errors: { videoUrl: string; message: string }[] = [];

  for (const video of videos) {
    if (existing.published.has(video.videoUrl)) continue;

    // Entry có nhưng chưa publish: lượt trước tạo được rồi publish hỏng, hoặc
    // có người unpublish tay. Cả hai đều cần người nhìn, và cả hai đều phải
    // giữ job đỏ ở những lượt sau — nếu không, `--retry` trong workflow chỉ
    // cần chạy lại một lượt là biến lỗi thật thành xanh. Job cố ý KHÔNG tự
    // publish: publish một entry là publish cả bản nháp trong đó.
    if (existing.unpublished.has(video.videoUrl)) {
      errors.push({
        videoUrl: video.videoUrl,
        message:
          "entry đã có trong Contentful nhưng chưa publish — publish hoặc xoá tay, job không tự publish bản nháp",
      });
      continue;
    }

    try {
      await createVideoPost(video, cmaBase, authHeaders);
      created.push(video.videoUrl);
    } catch (err) {
      errors.push({ videoUrl: video.videoUrl, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // 200 chỉ khi thật sự không có lỗi nào: workflow gọi route này bằng
  // `curl -sfS`, nó chỉ đọc HTTP status. Trả 200 kèm errors[] là job xanh
  // trong khi video mới ngừng lên site — đúng lỗi đã sửa ở check-rebates.
  const status = errors.length > 0 ? 500 : 200;
  if (errors.length > 0) console.error("[sync-videos] lỗi:", errors);
  return NextResponse.json({ checked: videos.length, created, errors }, { status });
}

async function fetchLatestVideos(): Promise<VideoEntry[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`, {
    cache: "no-store",
  });
  // Feed hỏng phải nổ, không được đọc thành "không có video mới". Trang lỗi
  // của Google là HTML không chứa <entry> nào, nên nếu không chặn ở đây thì
  // một feed 404 sẽ đi tiếp thành `{checked: 0}` và job vẫn xanh.
  if (!res.ok) {
    throw new Error(`youtube feed failed: ${res.status} ${await res.text()}`);
  }
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

// Tách theo trạng thái publish, không gộp làm một. `createVideoPost` tạo entry
// xong mới publish; nếu nửa sau hỏng thì entry vẫn nằm trong CMA dưới dạng
// draft. Coi draft đó là "đã có" thì lượt chạy sau bỏ qua nó và trả 200 —
// video không bao giờ lên site mà job vẫn xanh. (CMA trả draft chứ không phải
// bản đang phục vụ — xem AGENTS.md.)
async function fetchVideoUrlsByState(
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<{ published: Set<string>; unpublished: Set<string> }> {
  const published = new Set<string>();
  const unpublished = new Set<string>();
  let skip = 0;
  const limit = 100;

  for (;;) {
    const res = await fetch(
      `${cmaBase}/entries?content_type=blogPost&fields.type=video&skip=${skip}&limit=${limit}`,
      { headers: authHeaders, cache: "no-store" },
    );
    // Lượt gọi này hỏng mà nuốt đi thì set trả về rỗng, và `data.total ?? 0`
    // cho 0 nên vòng lặp thoát ngay: mọi video thành "chưa có" và route đi
    // tạo lại tất cả.
    if (!res.ok) {
      throw new Error(`contentful list failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      const url = item.fields?.videoUrl?.[LOCALE];
      if (!url) continue;
      if (item.sys?.publishedVersion) published.add(url);
      else unpublished.add(url);
    }
    skip += limit;
    if (skip >= (data.total ?? 0)) break;
  }

  return { published, unpublished };
}

/**
 * Contentful giới hạn `sys.id` ở 64 ký tự, và id ở đây là `post-` + slug.
 * Slug cũ cắt ở 80 nên `post-` + 80 = 85: một video có tiêu đề dài là
 * Contentful trả 422 và job đỏ cho video đó MÃI MÃI — không lượt chạy lại nào
 * làm tiêu đề ngắn đi. Bài dài nhất đang có trên site là `post-…` 62 ký tự,
 * tức là chỗ trống chỉ còn 2 — không phải một ca lý thuyết.
 */
const MAX_ENTRY_ID = 64;
const ENTRY_ID_PREFIX = "post-";
const MAX_SLUG = MAX_ENTRY_ID - ENTRY_ID_PREFIX.length;

function slugify(title: string, maxLength = MAX_SLUG): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/**
 * Id đó đã có ai đó dùng chưa.
 *
 * Vòng lọc trùng ở trên so theo `videoUrl`, nên nó KHÔNG thấy những entry
 * không có trường đó — tức là mọi bài viết chữ. Một video tên "Know Your
 * Minimum" trùng slug với bài viết cùng tên là đủ để `PUT` trả 409 và video
 * ấy không bao giờ lên được site, dù job có chạy lại bao nhiêu lần. Hỏi trước
 * một lượt (chỉ tốn thêm một request, và chỉ khi thật sự sắp tạo entry mới)
 * rồi đổi sang id mang videoId thì lượt sau tự đi tiếp.
 */
async function entryExists(
  entryId: string,
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<boolean> {
  const res = await fetch(`${cmaBase}/entries/${entryId}`, { headers: authHeaders });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`check entry failed: ${res.status} ${await res.text()}`);
  return true;
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

/** Slug của video, đã tránh id đang có. Chỉ thêm videoId khi thật sự trùng —
 *  URL công khai của bài nên đọc được, đuôi 11 ký tự chỉ là cái giá của ca
 *  hiếm. Cắt phần chữ ngắn lại đúng bằng chỗ cái đuôi chiếm, để id vẫn nằm
 *  trong 64 ký tự. */
async function uniqueSlug(
  video: VideoEntry,
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<string> {
  const base = slugify(video.title);
  if (!(await entryExists(`${ENTRY_ID_PREFIX}${base}`, cmaBase, authHeaders))) return base;

  const suffix = `-${video.videoId}`;
  const stem = base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/g, "");
  const fallback = `${stem}${suffix}`;
  // Phải hỏi cả id dự phòng, không chỉ id gốc. `videoId` là duy nhất theo
  // video nên id này gần như chắc chắn trống — nhưng "gần như" mà không kiểm
  // thì lượt PUT vẫn 409 và job đỏ mãi, đúng cái vòng lặp mà hàm này sinh ra
  // để cắt. Nếu nó cũng bận thì không còn tên nào tự nghĩ ra được: ném kèm
  // đúng hai id đã thử, để người trực biết phải xoá hoặc đổi cái nào.
  if (await entryExists(`${ENTRY_ID_PREFIX}${fallback}`, cmaBase, authHeaders)) {
    throw new Error(
      `cả hai id đều đã có trong Contentful: "${ENTRY_ID_PREFIX}${base}" và ` +
        `"${ENTRY_ID_PREFIX}${fallback}" — xoá hoặc đổi slug entry đang chiếm chỗ`,
    );
  }
  return fallback;
}

async function createVideoPost(
  video: VideoEntry,
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<void> {
  const slug = await uniqueSlug(video, cmaBase, authHeaders);
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

  const entryId = `${ENTRY_ID_PREFIX}${slug}`;
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
