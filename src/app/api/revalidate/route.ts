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

// Called by a Contentful webhook on publish/unpublish/delete so the site
// updates immediately instead of waiting for the next code deploy or a
// manual "Clear cache" click in the Hostinger dashboard. Also sends a Kit
// newsletter broadcast the first time a "post"-type blogPost is published
// (see maybeNotifyNewPost below).
export async function POST(request: NextRequest) {
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

  const hostingerCachePurged = await purgeHostingerCache();

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
  let payload: unknown;
  let hasPayload = true;
  try {
    payload = await request.json();
  } catch {
    // No/invalid JSON body (e.g. a manual test ping) — nothing to notify about.
    hasPayload = false;
  }

  if (hasPayload) {
    try {
      newPostNotified = await maybeNotifyNewPost(payload);
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
  const retrySafe = newPostNotified === false || newPostNotified === "fetch_failed";
  const status = retrySafe ? 502 : 200;
  return NextResponse.json({ revalidated: true, hostingerCachePurged, newPostNotified }, { status });
}

async function purgeHostingerCache(): Promise<boolean | "not-configured"> {
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
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
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
  sys?: { publishedCounter?: number; version?: number; publishedVersion?: number };
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

// Sends a Kit newsletter broadcast the first time a "post"-type blogPost
// entry is published. Skips video posts and the categories above, and skips
// edits/republishes of an already-published post.
async function maybeNotifyNewPost(payload: unknown): Promise<boolean | string> {
  const entry = payload as ContentfulEntryPayload;

  if (entry?.sys?.contentType?.sys?.id !== "blogPost") return "not_blog_post";
  if (entry.fields?.type?.[LOCALE] !== "post") return "video_post";
  const category = entry.fields?.categoryVi?.[LOCALE]?.trim().toLowerCase();
  if (category && NO_BROADCAST_CATEGORIES.has(category)) return `${category}_post`;

  const entryId = entry.sys?.id;
  if (!entryId) return "missing_entry_id";

  const managementEntry = await fetchManagementEntry(entryId);
  if (managementEntry === "not-configured") return "not-configured";
  if (!managementEntry) return "fetch_failed";
  if (managementEntry.sys?.publishedCounter !== 1) return "not_first_publish";

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
