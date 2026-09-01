/** The bare video id from any YouTube watch/shorts/youtu.be/embed URL. */
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);

    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      return u.searchParams.get("v");
    }

    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;

    return null;
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

    if (u.hostname.includes("vimeo.com")) {
      if (u.pathname.startsWith("/video/")) return `https://player.vimeo.com${u.pathname}`;
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    return null;
  } catch {
    return null;
  }
}
