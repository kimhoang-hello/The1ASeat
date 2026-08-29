import { NextRequest } from "next/server";

/**
 * Shared secret check for the scheduled-job routes.
 *
 * The secret travels in an `Authorization: Bearer` header, and only there. It
 * used to be accepted as `?secret=…` too, which meant every run wrote the
 * secret into Hostinger's access log in plain text — and into any proxy or
 * referrer log along the way. That fallback existed to carry callers through
 * the migration; it is gone now that every caller sends the header (kiểm ngày
 * 29/08/2026: cả ba workflow dùng `-X POST -H "Authorization: Bearer …"`, và
 * webhook `Refresh Ghế 1A site` trong Contentful cũng gửi header, URL không
 * mang query nào). Thêm lại nó là mở lại đúng đường rò cũ.
 *
 * Comparison is length-checked first and then constant-time, so a caller cannot
 * learn the secret one character at a time from response timing.
 */
export function jobSecretValid(request: NextRequest, expected: string | undefined): boolean {
  if (!expected) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!provided) return false;

  return timingSafeEqual(provided, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
