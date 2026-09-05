import { NextRequest, NextResponse } from "next/server";
import { jobAuthResponse } from "@/lib/job-auth";

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

/** Một entry video chưa publish, nhận diện theo `sys.id` chứ không theo URL —
 *  xem lý do ở `fetchVideoUrlsByState`. */
interface UnpublishedEntry {
  id: string;
  videoUrl?: string;
}

interface VideoEntryState {
  /** URL đã có bài trên site — dùng để bỏ qua khi duyệt feed. */
  published: Set<string>;
  /** URL đã có entry nhưng chưa publish — dùng để KHÔNG tạo trùng. */
  unpublished: Set<string>;
  /** Mọi entry chưa publish, kể cả entry chưa điền `videoUrl`. Đây là thứ
   *  vòng báo lỗi ở `handleSync` duyệt. */
  unpublishedEntries: UnpublishedEntry[];
}

// POST only, cùng lý do với hai job kia: đây là route tạo entry trong
// Contentful, không phải thứ để mở bằng browser.
export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const denied = jobAuthResponse(request, process.env.SYNC_VIDEOS_SECRET, "SYNC_VIDEOS_SECRET");
  if (denied) return denied;

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
  let existing: VideoEntryState;
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

  /**
   * Draft video CHƯA ĐIỀN `videoUrl` thì khoá luôn vòng tạo entry.
   *
   * Draft như vậy không đối chiếu được với video nào trong feed — nó không có
   * URL để so. Cứ tạo tiếp thì có đường ra một entry TRÙNG: draft đang chiếm
   * id `post-<slug-theo-tiêu-đề>`, `uniqueSlug` thấy id đó bận nên lùi sang
   * `post-<slug>-<videoId>`, rồi tạo và publish một bài thứ hai cho đúng video
   * mà draft kia định nói tới. Báo lỗi ở vòng dưới KHÔNG cứu được, vì lúc đó
   * entry trùng đã nằm trong Contentful rồi — thứ tự thực thi quyết định, chứ
   * không phải thứ tự trong báo cáo.
   *
   * Giá phải trả: một draft bỏ quên làm video mới ngừng tự lên site cho tới
   * khi có người dọn. Chấp nhận, vì đúng luật đã ghi trong AGENTS.md — mọi
   * entry video chưa publish đều là trạng thái cần người nhìn, và job vốn đã
   * đỏ trong trạng thái đó. Bài trùng đã publish thì phải gỡ tay ở cả
   * Contentful lẫn site; một hôm không có video mới thì chỉ là chậm một hôm.
   */
  const draftsWithoutUrl = existing.unpublishedEntries.filter((draft) => !draft.videoUrl);

  if (draftsWithoutUrl.length === 0) {
    for (const video of videos) {
      if (existing.published.has(video.videoUrl)) continue;

      // Entry đã có dưới dạng draft: đừng tạo lại. Việc BÁO nằm ở vòng riêng
      // bên dưới — xem lý do ở đó.
      if (existing.unpublished.has(video.videoUrl)) continue;

      try {
        await createVideoPost(video, cmaBase, authHeaders);
        created.push(video.videoUrl);
      } catch (err) {
        errors.push({ videoUrl: video.videoUrl, message: err instanceof Error ? err.message : String(err) });
      }
    }
  } else {
    errors.push({
      videoUrl: "(không tạo entry nào ở lượt này)",
      message:
        `có ${draftsWithoutUrl.length} entry video chưa publish và chưa điền videoUrl` +
        " — không đối chiếu được với feed nên job dừng tạo entry để khỏi sinh bài trùng;" +
        " xử lý những entry bên dưới rồi chạy lại",
    });
  }

  // MỌI entry video chưa publish, không chỉ những cái còn nằm trong feed.
  //
  // Trạng thái này sinh ra từ một lượt tạo được entry rồi publish hỏng, hoặc
  // từ việc có người unpublish tay. AGENTS.md ghi rằng cả hai đều cần người
  // nhìn nên job phải đỏ cho tới khi ai đó publish hoặc xoá — nhưng lời hứa đó
  // trước 31/08/2026 chỉ đúng một nửa: phần báo lỗi nằm TRONG vòng lặp duyệt
  // feed, mà feed YouTube chỉ trả 15 entry gần nhất. Một entry cũ bị unpublish
  // tay, hoặc một entry publish hỏng rồi video trôi khỏi cửa sổ 15 cái đó, thì
  // không lượt chạy nào duyệt tới nữa: `errors` rỗng, job trả 200, và video ấy
  // vĩnh viễn không lên site mà không ai được báo. Đúng kiểu lỗi tự rửa mình
  // mà `--retry` của workflow biến thành xanh.
  //
  // Duyệt thẳng `existing.unpublished` thì điều kiện không còn phụ thuộc vào
  // feed, nên nó còn nguyên ở mọi lượt sau — đúng nguyên tắc "lỗi phải tự nhận
  // ra được ở lượt chạy sau".
  //
  // Entry vừa tạo trong lượt này không bị đếm hai lần: `existing` được chụp
  // TRƯỚC vòng lặp, còn một lượt `createVideoPost` publish hỏng thì đã tự đẩy
  // lỗi của nó vào `errors` ở `catch` bên trên.
  for (const draft of existing.unpublishedEntries) {
    errors.push({
      videoUrl: draft.videoUrl ?? "(entry chưa điền videoUrl)",
      message:
        `entry ${draft.id} đã có trong Contentful nhưng chưa publish` +
        " — publish hoặc xoá tay, job không tự publish bản nháp",
    });
  }

  // 200 chỉ khi thật sự không có lỗi nào: workflow gọi route này bằng
  // `curl -sfS`, nó chỉ đọc HTTP status. Trả 200 kèm errors[] là job xanh
  // trong khi video mới ngừng lên site — đúng lỗi đã sửa ở check-rebates.
  const status = errors.length > 0 ? 500 : 200;
  if (errors.length > 0) console.error("[sync-videos] lỗi:", errors);
  return NextResponse.json({ checked: videos.length, created, errors }, { status });
}

/**
 * Một lượt GET có hạn giờ và có thử lại — cho nguồn NGOÀI tầm kiểm soát.
 *
 * VÌ SAO: job này đỏ ngắt quãng suốt 28–31/08/2026 (6 lượt fail xen giữa các
 * lượt xanh, xem Actions). Đối chiếu feed với site thì cả 12 video thường
 * trong feed đều đã publish — tức KHÔNG phải trạng thái "draft kẹt" mà route
 * cố ý giữ đỏ, mà là một cú nấc thoáng qua của nguồn. Hai chữ ký khác nhau:
 * 4 lượt fail nhanh (~0.5s, HTTP lỗi) và 3 lượt fail sau 19–21 phút (treo tới
 * hết `--max-time 300` của curl, bốn lần).
 *
 * Hai chữ ký ứng với hai lỗ hổng ở đây, và cả hai đều được vá bằng một hàm:
 * `fetch` của Node KHÔNG có timeout mặc định — một kết nối treo thì treo mãi
 * — và route thì ném ngay ở lần hỏng đầu tiên, không thử lại lần nào. So với
 * `purgeHostingerCache` trong `api/revalidate` (thử 3 lần) thì đây là chỗ
 * đáng thử lại HƠN, vì nó gọi ra Google chứ không gọi vào hạ tầng của mình.
 *
 * KHÔNG che lỗi thật: hết lượt thử vẫn ném, kèm lý do của lượt cuối. Một
 * nguồn hỏng dai vẫn làm job đỏ đúng như trước — chỉ khác là một cú nấc lẻ
 * thì không.
 *
 * Ngân sách: 3 lượt × 10s + backoff 0.5s + 1s ≈ 31.5s tối đa, thừa chỗ trong
 * `--max-time 300` của workflow.
 */
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_ATTEMPTS = 3;

async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));

    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      // 4xx là câu trả lời dứt khoát của máy chủ về chính request này — thử
      // lại y hệt thì cũng chừng ấy. Chỉ 429 và 5xx mới đáng thử lại.
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      lastError = new Error(`${label}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? new Error(`${label} hỏng sau ${FETCH_ATTEMPTS} lượt: ${lastError.message}`)
    : new Error(`${label} hỏng sau ${FETCH_ATTEMPTS} lượt: ${String(lastError)}`);
}

async function fetchLatestVideos(): Promise<VideoEntry[]> {
  const res = await fetchWithRetry(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`,
    { cache: "no-store" },
    "youtube feed",
  );
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

/**
 * MỘT lượt gọi, KHÔNG phân trang — và ném thẳng nếu một trang không đủ chứa.
 *
 * Bản trước phân trang bằng `skip`, và `skip` không khoá được vị trí khi tập
 * dữ liệu đổi giữa hai lượt gọi: xoá một entry ở trang đầu là mọi entry sau
 * dồn lên một chỗ, và cái nằm ngay ranh giới trang không bao giờ được đọc.
 * Với vòng báo "mọi draft chưa publish" ở `handleSync`, một entry bị sót nghĩa
 * là job trả 200 trong khi vẫn còn draft kẹt — đúng cái im lặng mà vòng ấy
 * sinh ra để chấm dứt. Tệ hơn: nếu entry bị sót thuộc một video CÒN trong
 * feed, route tưởng video chưa có entry và tạo thêm một bản trùng trong
 * Contentful.
 *
 * ĐÃ THỬ VÀ ĐÃ BỎ một cửa kiểm đếm số (`seen !== total` thì ném). Nó không
 * đủ, vì đếm không kiểm được DANH TÍNH: xoá `A1` rồi thêm `B` giữa hai trang
 * thì tổng vẫn khớp trong khi `A101` chưa từng được đọc. Đếm phần tử phân
 * biệt cũng không cứu — con số vẫn khớp. Mọi cửa kiểm dựa trên số lượng đều
 * có tính chất này.
 *
 * Nên bỏ hẳn phân trang. Một trang 100 entry là ngưỡng ĐÃ KIỂM của CMA, và
 * hiện có 25 entry video, nên lượt gọi này là một ảnh chụp nguyên tử — không
 * còn khe hở nào giữa hai trang để mất entry. Ngày nào vượt 100 thì nó NÉM
 * kèm hướng dẫn, chứ không âm thầm đọc thiếu: thà job đỏ và có người chuyển
 * sang con trỏ mờ, còn hơn tự tin sai. (Chưa chuyển sẵn vì token quản trị
 * trong `.env.local` đang hỏng nên không kiểm chứng được API con trỏ của CMA —
 * đừng đoán mò một API mà không chạy thử được.)
 */
const LIST_LIMIT = 100;

// Tách theo trạng thái publish, không gộp làm một. `createVideoPost` tạo entry
// xong mới publish; nếu nửa sau hỏng thì entry vẫn nằm trong CMA dưới dạng
// draft. Coi draft đó là "đã có" thì lượt chạy sau bỏ qua nó và trả 200 —
// video không bao giờ lên site mà job vẫn xanh. (CMA trả draft chứ không phải
// bản đang phục vụ — xem AGENTS.md.)
async function fetchVideoUrlsByState(
  cmaBase: string,
  authHeaders: Record<string, string>,
): Promise<VideoEntryState> {
  const published = new Set<string>();
  const unpublished = new Set<string>();
  const unpublishedEntries: UnpublishedEntry[] = [];

  // Cùng lý do với feed YouTube: đây là lượt gọi ra ngoài thứ hai của job, và
  // một cú 429/503 của Contentful cũng làm cả lượt chạy đỏ y như vậy.
  const res = await fetchWithRetry(
    `${cmaBase}/entries?content_type=blogPost&fields.type=video&limit=${LIST_LIMIT}`,
    { headers: authHeaders, cache: "no-store" },
    "contentful list",
  );
  // Lượt gọi này hỏng mà nuốt đi thì set trả về rỗng, và mọi video thành
  // "chưa có" — route đi tạo lại tất cả.
  if (!res.ok) {
    throw new Error(`contentful list failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const total: number = data.total ?? 0;
  if (total > LIST_LIMIT) {
    throw new Error(
      `contentful list: có ${total} entry video nhưng một lượt gọi chỉ lấy được ${LIST_LIMIT}` +
        ` — phân trang bằng skip làm mất entry trong im lặng, phải chuyển sang con trỏ mờ của CMA`,
    );
  }

  for (const item of data.items ?? []) {
    const url: string | undefined = item.fields?.videoUrl?.[LOCALE];

    // Chưa publish thì ghi lại theo `sys.id`, KHÔNG theo URL — và ghi cả khi
    // chưa có `videoUrl`. `videoUrl` là trường TUỲ CHỌN trong content model
    // (xem CONTENTFUL.md), nên một entry `type: video` còn dở, chưa điền link,
    // là trạng thái hoàn toàn hợp lệ. Lọc theo URL như trước thì đúng những
    // entry đó biến mất khỏi danh sách, `errors` rỗng và job trả 200 — trong
    // khi vòng báo ở `handleSync` hứa là báo MỌI draft. Khoá theo `sys.id`
    // cũng chữa luôn ca hai draft trùng `videoUrl`: `Set` gộp chúng làm một,
    // còn danh sách theo id thì giữ đủ cả hai.
    if (!item.sys?.publishedVersion) {
      unpublishedEntries.push({ id: item.sys?.id ?? "(không có id)", videoUrl: url });
    }

    // Hai `Set` theo URL chỉ để đối chiếu với feed YouTube, nên entry không có
    // URL thì không có gì để đối chiếu.
    if (!url) continue;
    if (item.sys?.publishedVersion) published.add(url);
    else unpublished.add(url);
  }

  return { published, unpublished, unpublishedEntries };
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
  // `fetchWithRetry` chứ không phải `fetch` trần, VÌ ĐÂY LÀ GET. Nó không ghi
  // gì nên chạy lại là vô hại, và ba lượt thử vốn đã có sẵn đúng cho loại lỗi
  // thoáng qua: một cái 429/503 hoặc một lượt hết giờ đủ làm cả job đỏ trong
  // khi lượt sau đã trả 200. Khác hẳn hai lượt PUT ở `createEntry` — xem chú
  // thích ở đó, chúng CỐ Ý chỉ chạy một lượt.
  const res = await fetchWithRetry(`${cmaBase}/entries/${entryId}`, { headers: authHeaders }, "check entry");
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
  // Có `signal` nhưng KHÔNG dùng `fetchWithRetry`. Hai lượt PUT dưới đây là
  // ghi, và thử lại một lượt ghi không giống thử lại một lượt đọc: publish
  // mang `X-Contentful-Version`, nên lượt sau một lần publish thành công mà
  // hỏng ở đường trả lời sẽ nhận 409 — mà 409 thì `fetchWithRetry` không thử
  // lại nữa và ném ra, đúng ý (cần người nhìn). Thêm timeout chỉ bịt đường
  // treo, không đổi cách job xử lý lỗi.
  const createRes = await fetch(`${cmaBase}/entries/${entryId}`, {
    method: "PUT",
    headers: {
      ...authHeaders,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      "X-Contentful-Content-Type": "blogPost",
    },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!createRes.ok) throw new Error(`create entry failed: ${await createRes.text()}`);
  const created = await createRes.json();

  const publishRes = await fetch(`${cmaBase}/entries/${entryId}/published`, {
    method: "PUT",
    headers: { ...authHeaders, "X-Contentful-Version": String(created.sys.version) },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!publishRes.ok) throw new Error(`publish entry failed: ${await publishRes.text()}`);
}
