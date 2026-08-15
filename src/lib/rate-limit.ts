/**
 * A small fixed-window rate limiter for the two public POST endpoints.
 *
 * Both of them spend something real on an unauthenticated request: /api/contact
 * sends mail to the inbox, and /api/subscribe adds a Kit subscriber and sends a
 * welcome email to whatever address it was handed. Without a limit, anyone can
 * point the site at a stranger's inbox and have ghe1a.com mail them, which
 * costs the domain its sending reputation long before it costs anything else.
 *
 * State is in memory on purpose. The site runs as a single Node process on
 * Hostinger, so a Map is enough and needs no Redis; if it is ever run as more
 * than one instance each gets its own window, which weakens the limit but never
 * breaks a legitimate request. Entries are swept on write, so the Map stays
 * proportional to recent traffic rather than growing forever.
 */

interface Window {
  count: number;
  /** Epoch ms at which this window resets. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Anything older than this is unreachable by any caller and can be dropped. */
const SWEEP_AFTER_MS = 60 * 60 * 1000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_AFTER_MS) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry, for the Retry-After header. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * The caller's IP. Hostinger fronts the app with its own proxy, so the socket
 * address is the proxy's — the client is the first entry of X-Forwarded-For.
 * Falls back to a shared bucket when no header is present, which throttles
 * harder rather than not at all.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
