import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { CATCH_THE_POINTS_PUBLISHED } from "@/lib/feature-flags";

/**
 * File tĩnh của mini-game, dựng sẵn lúc build.
 *
 * VÌ SAO KHÔNG ĐỂ TRONG `public/`: trên production, máy chủ web của Hostinger
 * phục vụ thẳng `public/` từ ổ đĩa, không qua Next. `src/proxy.ts` từng chặn
 * `/games/catch-the-points/*` khi cờ tắt — chạy đúng khi `next start` local,
 * nhưng trên ghe1a.com không bao giờ được gọi: kiểm 26/09/2026, game đã gỡ từ
 * 17/09 vẫn trả 200, response không mang header nào của Next. Để ở đây thì cờ
 * là thứ duy nhất quyết định, bất kể tầng trước Next làm gì.
 *
 * Dựng TĨNH từ danh sách file thật (`dynamicParams = false`): cờ tắt thì danh
 * sách rỗng và mọi đường dẫn là 404, không tốn lượt đọc ổ đĩa nào lúc chạy.
 * Đường dẫn giải mã kiểu `/%67ames/…` cũng rơi vào đúng route này — Next khớp
 * route trên đường đã giải mã — nên không cần lớp chặn riêng như proxy cũ.
 */

const ROOT = path.join(process.cwd(), "games", "catch-the-points", "web");

/** Chỉ những loại file game thật sự dùng. `.md` (ghi chú nguồn ảnh) không ra ngoài. */
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function servedFiles(): string[][] {
  return readdirSync(ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) in CONTENT_TYPES)
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath, entry.name)).split(path.sep));
}

export const dynamicParams = false;

export function generateStaticParams(): { path: string[] }[] {
  return CATCH_THE_POINTS_PUBLISHED ? servedFiles().map((segments) => ({ path: segments })) : [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!CATCH_THE_POINTS_PUBLISHED) return new Response(null, { status: 404 });

  const { path: segments } = await params;
  // `dynamicParams = false` đã giới hạn ở danh sách file thật; kiểm lại ở đây
  // để hàm này không bao giờ đọc được gì ngoài `ROOT`, kể cả khi ai đó đổi cấu
  // hình kia.
  const file = path.resolve(ROOT, ...segments);
  const type = CONTENT_TYPES[path.extname(file)];
  if (!type || !file.startsWith(ROOT + path.sep) || segments.some((part) => part.startsWith("."))) {
    return new Response(null, { status: 404 });
  }

  try {
    return new Response(await readFile(file), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
