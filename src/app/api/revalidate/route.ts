import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { Document } from "@contentful/rich-text-types";
import { jobSecretValid } from "@/lib/job-auth";
import { CONTENTFUL_TAG } from "@/lib/content";
import {
  SITE_URL,
  emailHeadlineStyle,
  emailParagraphStyle,
  escapeHtml,
  renderPostBodyForEmail,
  renderSubscriberEmailHtml,
} from "@/lib/subscriber-email";

const LOCALE = "en-US";

/**
 * NGÂN SÁCH THỜI GIAN CHO CẢ ROUTE, không phải timeout cho từng lượt gọi.
 *
 * Contentful bỏ cuộc ở 30 giây, và một webhook bị TIMEOUT thì nó **không gọi
 * lại** — khác hẳn 5xx, thứ nó thử lại hai lần nữa. Chính vì thế route này cố
 * ý trả 502 khi purge hỏng: 502 thì được gọi lại, còn quá 30 giây thì không.
 *
 * Nhưng trước 31/08/2026 không lượt `fetch` nào ở đây có hạn giờ, mà `fetch`
 * của Node không có timeout mặc định — nên ba lượt purge tuần tự cộng lượt đọc
 * CMA cộng lượt gọi Kit có thể vượt 30 giây và cả webhook đó biến mất trong im
 * lặng. Hậu quả không hồi lại được: CDN giữ HTML cũ, VÀ bài đầu tiên không có
 * bản tin nào — `publishedCounter` sang 2 nên publish lại cũng không cứu, đúng
 * như phần chú thích ở `maybeNotifyNewPost` đã ghi.
 *
 * Hạn CỨNG tính từ lúc nhận request, không phải tổng các timeout con: cộng
 * timeout lại thì mỗi lần thêm một lượt gọi là phải ngồi tính lại tổng, và
 * ngày ai đó quên là quay về đúng chỗ này. Mỗi `fetch` nhận phần thời gian nhỏ
 * hơn giữa "hạn mức riêng của nó" và "còn lại bao nhiêu tới hạn chung".
 *
 * 25 giây chừa 5 giây cho phần Next tự làm và cho đường truyền về.
 *
 * CẮT NGANG LƯỢT GỌI KIT LÀ AN TOÀN: `fetch` bị abort thì ném, rơi vào
 * `catch` ở POST và thành `"notify_failed"` — nhánh GIỮ chỗ đã giành và trả
 * 200, tức là không có bản tin thứ hai. Đó đúng là cách route đối xử với mọi
 * lượt không chắc chắn.
 */
const WEBHOOK_BUDGET_MS = 25_000;
const PURGE_ATTEMPT_MS = 4_000;
const CMA_MS = 5_000;
const KIT_MS = 8_000;

/** Hạn giờ cho một lượt gọi: nhỏ hơn giữa hạn riêng và phần còn lại của ngân sách. */
function budgeted(deadline: number, want: number): AbortSignal {
  return AbortSignal.timeout(Math.max(0, Math.min(want, deadline - Date.now())));
}

// Called by a Contentful webhook on publish/unpublish/delete so the site
// updates immediately instead of waiting for the next code deploy or a
// manual "Clear cache" click in the Hostinger dashboard. Also sends a Kit
// newsletter broadcast the first time a "post"-type blogPost is published
// (see maybeNotifyNewPost below).
export async function POST(request: NextRequest) {
  // Đặt mốc TRƯỚC mọi việc có thể chậm. Xem `WEBHOOK_BUDGET_MS`.
  const deadline = Date.now() + WEBHOOK_BUDGET_MS;

  if (!jobSecretValid(request, process.env.REVALIDATE_SECRET)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  // Hai lớp, hai việc khác nhau. `revalidateTag` xoá bản Contentful đang được
  // giữ trong `lib/content` — thiếu nó thì trang render lại nhưng vẫn đọc
  // đúng dữ liệu cũ, tức là bấm Publish xong phải chờ tới một phút. Rồi
  // `revalidatePath` mới xoá HTML đã dựng sẵn của các trang.
  //
  // `{ expire: 0 }` chứ không phải `"max"` mà tài liệu Next 16 khuyên dùng, vì
  // hai cái làm hai chuyện khác nhau và đã đo tận nơi: sau `"max"`, lượt truy
  // cập kế tiếp mất 14–28ms — tức là vẫn ăn bản cache cũ, đúng nghĩa
  // stale-while-revalidate, nên người đầu tiên vào sau khi Publish (thường
  // chính là tác giả đang mở trang ra xem) lại thấy nội dung cũ. Sau
  // `{ expire: 0 }` thì lượt kế tiếp mất 135ms — nó thật sự gọi lại
  // Contentful. Đây cũng đúng là việc `updateTag` làm, nhưng `updateTag` chỉ
  // gọi được trong Server Action, không gọi được trong Route Handler như ở
  // đây.
  revalidateTag(CONTENTFUL_TAG, { expire: 0 });
  revalidatePath("/", "layout");

  const hostingerCachePurged = await purgeHostingerCache(deadline);

  // Kiểm tra purge TRƯỚC khi gọi Kit, không phải sau. Nếu để broadcast chạy
  // trước rồi mới phát hiện CDN bẩn thì route kẹt giữa hai đường: xin webhook
  // gọi lại thì gửi bản tin lần hai, không xin thì lỗi CDN chìm luôn. Thoát
  // sớm ở đây thì lần retry purge lại từ đầu, và broadcast chỉ được tạo khi
  // CDN đã sạch — đúng một lần.
  //
  // Giá phải trả: Hostinger chết đủ lâu để Contentful bỏ cuộc thì bài mới sẽ
  // không có bản tin nào. Đổi lại tác giả NHÌN THẤY webhook đỏ trong Contentful
  // và publish lại được — còn bản tin gửi trùng thì không rút lại được.
  if (hostingerCachePurged === false) {
    return NextResponse.json(
      { revalidated: true, hostingerCachePurged, newPostNotified: "skipped_cache_failed" },
      { status: 502 },
    );
  }

  let newPostNotified: boolean | string = "no_payload";
  /** Slug của bài, chỉ để đưa vào dòng log `missed_first_publish` bên dưới. */
  let missedPostLabel: string | undefined;
  let payload: unknown;
  let hasPayload = true;
  try {
    payload = await request.json();
  } catch {
    // No/invalid JSON body (e.g. a manual test ping) — nothing to notify about.
    hasPayload = false;
  }

  if (hasPayload) {
    const entry = payload as ContentfulEntryPayload;
    missedPostLabel =
      entry?.fields?.slug?.[LOCALE] ?? entry?.fields?.titleVi?.[LOCALE] ?? entry?.sys?.id;
    try {
      newPostNotified = await maybeNotifyNewPost(payload, deadline);
    } catch {
      // Ném ra ở đâu thì không biết được: có thể Kit đã nhận broadcast rồi mới
      // mất response. Ghi thành trạng thái riêng chứ không để nguyên
      // "no_payload" — nhầm nó thành "chưa gửi gì" là mở đường cho một lần
      // retry gửi bản tin lần thứ hai.
      newPostNotified = "notify_failed";
    }
  }

  // Trả 200 khi CDN chưa xoá được là nói dối webhook: Contentful thấy thành
  // công nên không gọi lại, và người đọc vẫn nhận HTML cũ từ CDN Hostinger cho
  // tới khi nó tự hết hạn — đúng lỗi đã gặp lúc thêm 4 tài khoản BMO®.
  //
  // Nhưng không phải lúc nào cũng được phép xin gọi lại. `maybeNotifyNewPost`
  // chống trùng bằng `publishedCounter === 1`, mà con số đó KHÔNG đổi khi
  // webhook được gọi lại — nên retry sau một lần đã gửi broadcast sẽ gửi bản
  // tin lần thứ hai tới toàn bộ subscriber, và không rút lại được. Chỉ xin
  // retry khi lượt này không gửi gì: publish thẻ tín dụng và tài khoản ngân
  // hàng — đúng những thứ cần CDN sạch — đều rơi vào nhánh đó.
  //
  // `"not-configured"` vẫn trả 200: gọi lại bao nhiêu lần cũng không làm biến
  // ra một token Hostinger.
  //
  // NGOẠI LỆ `false`: Kit trả 4xx, tức là CHẮC CHẮN chưa có broadcast nào được
  // tạo và `claimBroadcast` đã trả chỗ lại. Trả 200 ở đây là bài đầu tiên của
  // một entry im lặng không có bản tin nào — mà `publishedCounter` không bao
  // giờ về 1 nữa, nên publish lại cũng không cứu được. Xin webhook gọi lại là
  // an toàn đúng ở nhánh này và chỉ ở nhánh này. Hai nhánh không chắc chắn —
  // `"notify_uncertain"` (Kit 5xx) và `"notify_failed"` (fetch ném) — vẫn trả
  // 200 và vẫn giữ chỗ: lúc đó không biết Kit đã nhận hay chưa.
  //
  // `"fetch_failed"` đi CÙNG nhánh với `false`, và vì đúng cùng một lý do:
  // lượt gọi CMA nằm TRƯỚC `claimBroadcast` và trước mọi lời gọi Kit, nên khi
  // nó hỏng thì chắc chắn chưa có bản tin nào được tạo và chưa có chỗ nào bị
  // giành. Nó cũng là lỗi THOÁNG QUA (CMA 429/503), khác hẳn
  // `"not-configured"` hay `"missing_fields"` — gọi lại là qua được. Trả 200 ở
  // đây là mất hẳn bản tin của bài đó: Contentful không gọi lại, còn
  // `publishedCounter` thì sang lần publish sau đã là 2 nên `maybeNotifyNewPost`
  // không bao giờ chạm tới Kit nữa. Đúng một lần CMA nấc là một bài viết ra
  // đời im lặng.
  // Bài mới mà bản tin của nó đã rơi mất — xem `missedFirstPublish`. Không tự
  // gửi bù, nhưng phải LOG: đây là thứ duy nhất báo cho người biết rằng có một
  // bài ra đời im lặng, và việc cần làm (vào Kit gửi tay) là việc của người.
  // `curl -f` trong workflow nuốt body, còn Contentful thì chỉ hiện status —
  // nên runtime log của Hostinger là chỗ duy nhất đọc được.
  if (newPostNotified === "missed_first_publish") {
    // PHẢI nêu đích danh bài nào. Hai bài publish gần nhau sinh hai dòng log
    // giống hệt nhau thì người trực không biết vào Kit tìm cái gì — mà đây là
    // dòng duy nhất báo cho họ.
    console.error(
      `[revalidate] bài "${missedPostLabel ?? "(không đọc được slug)"}" có thể đã mất bản tin:` +
        " entry vừa publish lần đầu trong 30 phút qua, publishedCounter đã > 1, và tiến trình này" +
        " chưa gửi gì. KIỂM TRONG KIT TRƯỚC — nếu bản tin đã gửi rồi thì đây là báo thừa" +
        " (tiến trình restart làm mất dấu); chưa có thì gửi tay.",
    );
  }

  const retrySafe = newPostNotified === false || newPostNotified === "fetch_failed";
  const status = retrySafe ? 502 : 200;
  return NextResponse.json({ revalidated: true, hostingerCachePurged, newPostNotified }, { status });
}

async function purgeHostingerCache(deadline: number): Promise<boolean | "not-configured"> {
  const token = process.env.HOSTINGER_API_TOKEN;
  const username = process.env.HOSTINGER_USERNAME;
  const domain = process.env.HOSTINGER_DOMAIN;
  if (!token || !username || !domain) return "not-configured";

  // Ba lần thử, vì khi bài viết đầu tiên được publish thì broadcast đã gửi và
  // route KHÔNG được phép xin webhook gọi lại — lần thử ở đây là cơ hội cuối
  // để CDN sạch. Xoá cache gọi lại bao nhiêu lần cũng không hại gì.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));

    try {
      const res = await fetch(
        `https://developers.hostinger.com/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/cache/clear`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: budgeted(deadline, PURGE_ATTEMPT_MS),
        },
      );
      if (res.ok) return true;
    } catch {
      // Thử lại ở vòng sau.
    }
  }

  return false;
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
  sys?: {
    publishedCounter?: number;
    version?: number;
    publishedVersion?: number;
    /** Lần publish ĐẦU TIÊN của entry. Xem `missedFirstPublish`. */
    firstPublishedAt?: string;
  };
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
async function fetchManagementEntry(
  entryId: string,
  deadline: number,
): Promise<ManagementEntry | "not-configured" | null> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) return "not-configured";

  // `null` cả khi `fetch` NÉM, không chỉ khi nó trả `!ok`.
  //
  // Người gọi ánh xạ `null` thành `"fetch_failed"`, và POST coi đó là nhánh
  // XIN GỌI LẠI (502) — đúng, vì lượt gọi này nằm trước `claimBroadcast` nên
  // chắc chắn chưa có bản tin nào được tạo. Không bắt ở đây thì exception bay
  // lên `catch` của POST và thành `"notify_failed"`, tức là nhánh "không chắc
  // chắn": trả 200, giữ chỗ, Contentful không gọi lại — và bài đó vĩnh viễn
  // không có bản tin, vì `publishedCounter` sang lần publish sau đã là 2.
  //
  // Chuyện này quan trọng hơn hẳn từ khi lượt gọi có `AbortSignal`: hết giờ
  // giờ là một exception THẬT SỰ XẢY RA, không còn là ca lý thuyết.
  //
  // `res.json()` PHẢI nằm trong cùng `try`. `await fetch` chỉ resolve khi
  // headers về, còn body thì đọc sau — nên một entry có `bodyVi` dài, headers
  // 200 ở giây thứ nhất rồi body chưa xong ở giây thứ năm, sẽ abort NGAY TẠI
  // `res.json()`. Để nó ngoài `try` thì exception bay lên `catch` của POST và
  // thành `"notify_failed"`: trả 200, Contentful không gọi lại, và bài đó mất
  // bản tin vĩnh viễn — trong khi `claimBroadcast` còn chưa chạy và Kit còn
  // chưa được gọi, tức là lượt này thừa an toàn để xin gọi lại. Đúng cái lỗi
  // mà cả ngân sách thời gian này sinh ra để chặn.
  try {
    const res = await fetch(
      `https://api.contentful.com/spaces/${spaceId}/environments/master/entries/${entryId}`,
      {
        headers: { Authorization: `Bearer ${managementToken}` },
        cache: "no-store",
        signal: budgeted(deadline, CMA_MS),
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Những entry đã gửi bản tin trong tiến trình này, và lúc nào thì quên.
 *
 * `publishedCounter === 1` KHÔNG phải chốt chống trùng: nó là thuộc tính của
 * entry, không phải của lượt giao webhook, nên hai lượt giao cùng một sự kiện
 * publish đều đọc ra 1 và đều gửi. Contentful giao ít nhất một lần, nên chuyện
 * đó xảy ra được — và bản tin gửi trùng thì không rút lại được.
 *
 * Chốt thật nằm ở đây: giành chỗ TRƯỚC khi gọi Kit, nên lượt giao thứ hai
 * (dù đến sau hay chạy song song) thấy chỗ đã có người và bỏ qua.
 *
 * GIỚI HẠN, ghi ra để không ai tưởng nó mạnh hơn thực tế: state nằm trong bộ
 * nhớ của tiến trình. App chạy một tiến trình Node duy nhất trên Hostinger
 * (cùng giả định `lib/rate-limit` đang dùng), nhưng deploy hoặc restart giữa
 * hai lượt giao là mất. Nó thu hẹp cửa sổ trùng từ "mọi lượt giao lại" xuống
 * "lượt giao lại vắt qua một lần restart", chứ không đóng hẳn. Đóng hẳn thì
 * cần một chỗ lưu bền — mà site này chưa có cái nào.
 */
const broadcastClaims = new Map<string, number>();
const CLAIM_TTL_MS = 30 * 60 * 1000;

/** Chỗ này đã có người giành chưa — KHÔNG giành hộ. Dùng để phân biệt "mình
 *  vừa gửi" với "chưa ai gửi", ở `missedFirstPublish`. */
function hasBroadcastClaim(entryId: string): boolean {
  const at = broadcastClaims.get(entryId);
  return at !== undefined && Date.now() - at <= CLAIM_TTL_MS;
}

/** `true` nếu lượt này giành được quyền gửi; `false` nghĩa là đã có người gửi. */
function claimBroadcast(entryId: string): boolean {
  const now = Date.now();
  for (const [id, at] of broadcastClaims) {
    if (now - at > CLAIM_TTL_MS) broadcastClaims.delete(id);
  }
  if (broadcastClaims.has(entryId)) return false;
  broadcastClaims.set(entryId, now);
  return true;
}

// Categories whose posts never trigger a broadcast: Deals (transfer bonus /
// points-buy promos age out fast) and News (short reaction pieces to someone
// else's announcement — they land on the site, not in everyone's inbox).
const NO_BROADCAST_CATEGORIES = new Set(["deals", "news"]);

/**
 * Lượt này gần như chắc chắn là một bài MỚI mà bản tin của nó đã bị mất.
 *
 * CÁCH LỖI XẢY RA: chống trùng dựa vào `publishedCounter === 1`, mà con số đó
 * là thuộc tính của ENTRY chứ không phải của lượt giao webhook. Tác giả bấm
 * Publish, webhook thứ nhất bắt đầu chạy (purge CDN tới ba lượt, rồi mới đọc
 * CMA); tác giả sửa một lỗi chính tả và Publish lần nữa TRƯỚC khi lượt đọc CMA
 * kia diễn ra. Lúc đó cả hai webhook đều đọc ra `publishedCounter = 2`, cả hai
 * cùng trả `not_first_publish`, và bài đó ra đời im lặng — không bản tin nào.
 *
 * VÌ SAO KHÔNG TỰ GỬI Ở ĐÂY, dù nghe hợp lý: mọi cách nới điều kiện gửi đều
 * đổi một lỗi HỒI LẠI ĐƯỢC lấy một lỗi KHÔNG hồi lại được. Bản tin bị mất thì
 * tác giả vào Kit bấm gửi tay; bản tin gửi trùng tới toàn bộ subscriber thì
 * không rút lại được. Chốt chống trùng duy nhất đang có (`broadcastClaims`)
 * nằm trong bộ nhớ tiến trình, nên nó không sống qua một lần restart — mà
 * "restart giữa hai lượt giao" chính là ca này. Nới điều kiện ở đây là mở đúng
 * cửa đó.
 *
 * Cách sửa THẬT cần một chỗ lưu bền để hỏi "bài này đã gửi bản tin chưa" —
 * hoặc một trường trong Contentful, hoặc tra ngược danh sách broadcast của
 * Kit. Cả hai đều ngoài phạm vi một bản vá không chạy thử được API.
 *
 * Nên ở đây chỉ LÀM CHO NÓ NHÌN THẤY ĐƯỢC. Ba dấu hiệu cùng lúc mới báo, để
 * không kêu ở mọi lượt sửa bài bình thường:
 * - `publishedCounter > 1` (đã ở nhánh `not_first_publish`),
 * - `firstPublishedAt` mới trong vòng 30 phút — bài vừa ra đời, chứ không phải
 *   bài cũ đang được biên tập lại,
 * - tiến trình này KHÔNG giữ chỗ nào cho entry đó, tức là chính nó chưa gửi.
 *
 * Trả 200 chứ không 502: gọi lại bao nhiêu lần cũng không kéo `publishedCounter`
 * về 1. Việc cần làm là một người vào Kit gửi tay, và dòng log dưới đây nói rõ
 * bài nào.
 */
const FRESH_PUBLISH_MS = 30 * 60 * 1000;

function missedFirstPublish(entry: ManagementEntry, entryId: string): boolean {
  // `> 1`, không phải "khác 1". Người gọi vào đây từ nhánh
  // `publishedCounter !== 1`, mà `undefined !== 1` cũng đúng — nên một response
  // CMA thiếu trường sẽ đi thẳng vào cảnh báo dù không biết gì về entry.
  const counter = entry.sys?.publishedCounter;
  if (typeof counter !== "number" || counter <= 1) return false;

  const firstPublishedAt = entry.sys?.firstPublishedAt;
  if (!firstPublishedAt) return false;

  const firstAt = new Date(firstPublishedAt).getTime();
  if (!Number.isFinite(firstAt)) return false;
  if (Date.now() - firstAt > FRESH_PUBLISH_MS) return false;

  return !hasBroadcastClaim(entryId);
}

// Sends a Kit newsletter broadcast the first time a "post"-type blogPost
// entry is published. Skips video posts and the categories above, and skips
// edits/republishes of an already-published post.
async function maybeNotifyNewPost(payload: unknown, deadline: number): Promise<boolean | string> {
  const entry = payload as ContentfulEntryPayload;

  if (entry?.sys?.contentType?.sys?.id !== "blogPost") return "not_blog_post";
  if (entry.fields?.type?.[LOCALE] !== "post") return "video_post";
  const category = entry.fields?.categoryVi?.[LOCALE]?.trim().toLowerCase();
  if (category && NO_BROADCAST_CATEGORIES.has(category)) return `${category}_post`;

  const entryId = entry.sys?.id;
  if (!entryId) return "missing_entry_id";

  const managementEntry = await fetchManagementEntry(entryId, deadline);
  if (managementEntry === "not-configured") return "not-configured";
  if (!managementEntry) return "fetch_failed";
  if (managementEntry.sys?.publishedCounter !== 1) {
    return missedFirstPublish(managementEntry, entryId) ? "missed_first_publish" : "not_first_publish";
  }

  // Payload webhook là ảnh chụp lúc Publish, còn lượt gọi CMA ở trên đọc TRẠNG
  // THÁI BÂY GIỜ — hai mốc thời gian khác nhau, và giữa chúng có ba lần thử
  // purge CDN. Bài bị unpublish trong khoảng đó thì bản tin sẽ giới thiệu một
  // trang 404, mà bản tin gửi rồi không rút lại được.
  const { version, publishedVersion } = managementEntry.sys;
  if (!publishedVersion) return "no_longer_published";

  const apiKey = process.env.KIT_V4_API_KEY;
  if (!apiKey) return "not-configured";

  const title = entry.fields?.titleVi?.[LOCALE];
  const excerpt = entry.fields?.excerptVi?.[LOCALE];
  const slug = entry.fields?.slug?.[LOCALE];
  if (!title || !slug) return "missing_fields";

  // `listEntries`/`entries/:id` của CMA trả bản DRAFT. Sau một lần publish
  // sạch, draft trùng bản đang phục vụ (`version === publishedVersion + 1`) nên
  // đọc `bodyVi` ở đó là an toàn. Nhưng nếu tác giả đã lưu thêm một bản nháp
  // trong lúc webhook còn đang chạy, `bodyVi` này là chữ CHƯA publish — gửi đi
  // là phát tán bản nháp của họ cho toàn bộ subscriber. Thà gửi bản tin chỉ có
  // tiêu đề và link: link trỏ về bài đang thật sự nằm trên site.
  const draftAhead = typeof version === "number" && version > publishedVersion + 1;
  const bodyDocument = draftAhead ? undefined : managementEntry.fields?.bodyVi?.[LOCALE];
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

  // Giành chỗ ngay trước lời gọi, sau khi mọi kiểm tra đã qua — giành sớm hơn
  // thì một payload bị loại vì lý do khác cũng chiếm mất chỗ của bài thật.
  if (!claimBroadcast(entryId)) return "already_broadcast";

  const res = await fetch("https://api.kit.com/v4/broadcasts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kit-Api-Key": apiKey },
    signal: budgeted(deadline, KIT_MS),
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

    // 5xx KHÔNG phải bằng chứng là chưa gửi: Kit có thể đã tạo broadcast rồi
    // mới hỏng ở đường trả lời. Giữ chỗ, và báo về như một lượt không chắc
    // chắn — cùng đối xử với `fetch` ném. Chấp nhận mất bản tin ở ca hiếm này,
    // vì bản tin gửi trùng thì không rút lại được.
    if (res.status >= 500) return "notify_uncertain";

    // 4xx là Kit từ chối chính request này: chắc chắn chưa có broadcast nào
    // được tạo, nên trả chỗ lại an toàn. Lượt giao lại sẽ thử lại — 429 thì
    // lần sau qua được, còn 401/422 thì webhook đỏ trong Contentful, đúng thứ
    // tác giả cần nhìn thấy.
    broadcastClaims.delete(entryId);
    return false;
  }

  return true;
}
