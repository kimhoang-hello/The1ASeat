import { NextRequest } from "next/server";

/**
 * Shared secret check for the scheduled-job routes.
 *
 * The secret is read from an `Authorization: Bearer` header. It used to travel
 * as `?secret=…`, which meant every run wrote the secret into Hostinger's
 * access log in plain text — and into any proxy or referrer log along the way.
 * The query parameter is still accepted so a run in flight during a deploy, or
 * a workflow that has not been updated, keeps working; new callers should send
 * the header.
 *
 * Comparison is length-checked first and then constant-time, so a caller cannot
 * learn the secret one character at a time from response timing.
 */
export function jobSecretValid(request: NextRequest, expected: string | undefined): boolean {
  if (!expected) return false;

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const provided = bearer ?? request.nextUrl.searchParams.get("secret");
  if (!provided) return false;

  return timingSafeEqual(provided, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
