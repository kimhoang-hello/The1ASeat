import { NextRequest, NextResponse } from "next/server";

import { CATCH_THE_POINTS_PUBLISHED } from "@/lib/feature-flags";

/**
 * Chặn file tĩnh của mini-game khi cờ tắt.
 *
 * File trong `public/` được phục vụ trước mọi route, nên `notFound()` ở trang
 * game không chặn được bản chơi thật ở `/games/catch-the-points/`. Rewrite
 * trong `next.config.ts` cũng không đủ: nó so trên đường dẫn CHƯA giải mã, còn
 * bộ phục vụ file thì giải mã — `/%67ames/catch-the-points/index.html` lọt qua
 * với 200 (Codex bắt được 17/09/2026). Vì thế kiểm ở đây, trên đường đã giải
 * mã, và matcher phải rộng: matcher cũng so trên đường chưa giải mã.
 */
const GAME_DIR = "/games/catch-the-points";

export function proxy(request: NextRequest) {
  if (CATCH_THE_POINTS_PUBLISHED) return NextResponse.next();

  let path: string;
  try {
    path = decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return NextResponse.next();
  }
  path = path.replace(/\/+/g, "/").toLowerCase();

  if (path === GAME_DIR || path.startsWith(`${GAME_DIR}/`)) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
