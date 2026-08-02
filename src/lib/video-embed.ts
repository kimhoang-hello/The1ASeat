export function getYouTubeThumbnailUrl(url: string): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);
    let id: string | null = null;

    if (u.hostname.includes("youtube.com")) {
      id = u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.searchParams.get("v");
    } else if (u.hostname === "youtu.be") {
      id = u.pathname.slice(1);
    }

    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

export function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);

    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.pathname.startsWith("/shorts/")
        ? u.pathname.split("/")[2]
        : u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

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
