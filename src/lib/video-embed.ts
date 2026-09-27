/**
 * Host được nhận, so ĐÚNG TÊN chứ không `includes`: `includes("youtube.com")`
 * nhận cả `notyoutube.com.evil.example`. ID cũng phải đúng hình dạng — nó đi
 * thẳng vào `src` của iframe và vào URL ảnh, nên một `v=` tuỳ ý là một đoạn
 * đường dẫn tuỳ ý trên youtube.com.
 */
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youTubeIdFrom(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") return url.pathname.slice(1);
  if (!YOUTUBE_HOSTS.has(host)) return null;
  if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/")[2] ?? null;
  }
  return url.searchParams.get("v");
}

// Extract a YouTube video ID from common URL formats (watch, youtu.be, embed, shorts)
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const id = youTubeIdFrom(new URL(url));
    return id !== null && YOUTUBE_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * `maxresdefault` KHÔNG tồn tại cho mọi video, và khi nó thiếu thì hỏng lặng lẽ.
 *
 * YouTube chỉ sinh bản 1280×720 cho một phần video, không phải tất cả — kiểm
 * ngày 31/08/2026: `jNQXAC9IVRw` (video công khai có thật) trả **404** ở
 * `maxresdefault.jpg` trong khi `hqdefault.jpg` trả 200. Đường ảnh của site đi
 * qua `/_next/image`, mà upstream 404 thì nó cũng trả 404 — tức thẻ bài mất
 * ảnh, ảnh OG mất, enclosure RSS trỏ vào chỗ trống. 15 video hiện tại đều có
 * `maxres` nên chưa nổ; video cũ hoặc video nguồn độ phân giải thấp thì có.
 *
 * `hqdefault` là bản DUY NHẤT vừa chắc chắn tồn tại vừa đủ lớn để dùng thật
 * (480×360). `sddefault` cũng không được bảo đảm; `mqdefault` chỉ 320×180.
 *
 * `maxresdefault` VẪN LÀ MẶC ĐỊNH ở mọi nơi, kể cả ảnh OG, `thumbnailUrl`
 * trong JSON-LD và `<enclosure>` của RSS. Đã thử đổi những chỗ đó sang
 * `hqdefault` cho chắc và ĐÃ BỎ ngày 01/09/2026: đó là hạ 1280×720 xuống
 * 480×360 — ít hơn khoảng bảy lần điểm ảnh, và đổi khung 16:9 thành 4:3 có
 * viền đen — cho **mọi** lượt chia sẻ của **mọi** video, để phòng một ca hiện
 * đang xảy ra ở **0/15** video. Facebook tụt thẻ lớn xuống thẻ nhỏ ở dưới
 * 1200×630, nên cái giá thấy được ngay còn cái lợi thì chưa.
 *
 * Đường lùi đặt ở đúng chỗ trả giá thấp nhất:
 *
 * - TRÊN SITE: `VideoThumbnail` bắt `onError` và tụt xuống `hqdefault`. Trình
 *   duyệt còn chạy nên có lượt thử thứ hai — full chất lượng, không bao giờ vỡ.
 * - GIAO CHO MÁY KHÁC (OG/JSON-LD/RSS): không có lượt thử thứ hai, và ở đây
 *   chấp nhận rủi ro. Nếu một video thật sự thiếu `maxres` thì ảnh OG của
 *   riêng bài đó trống — và content model đã có sẵn lối thoát: `coverPhoto`
 *   được ưu tiên hơn thumbnail YouTube ở CẢ BỐN chỗ dùng, nên tác giả chỉ cần
 *   tải một ảnh bìa lên entry đó là xong.
 */
export function getYouTubeThumbnailUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : null;
}

/** Bản chắc chắn tồn tại. Xem `getYouTubeThumbnailUrl` để biết vì sao có hai. */
export function getYouTubeThumbnailFallbackUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function getYouTubeWatchUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  const youTubeId = getYouTubeVideoId(url);
  if (youTubeId) return `https://www.youtube.com/embed/${youTubeId}`;

  try {
    const u = new URL(url);

    const host = u.hostname.toLowerCase();
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      // `/video/<id>` (link player) hoặc `/<id>` (link trang); id Vimeo là số.
      const id = u.pathname.split("/").filter(Boolean).pop() ?? "";
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }

    return null;
  } catch {
    return null;
  }
}
