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

export function getYouTubeThumbnailUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : null;
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
