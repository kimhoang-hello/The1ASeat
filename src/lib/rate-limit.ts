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

import { createHash, randomBytes } from "node:crypto";

interface Window {
  count: number;
  /** Epoch ms at which this window resets. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Xem `emailKey`. Ngẫu nhiên mỗi lần khởi động, cố ý. */
const EMAIL_SALT = randomBytes(32);

/** Anything older than this is unreachable by any caller and can be dropped. */
const SWEEP_AFTER_MS = 60 * 60 * 1000;
let lastSweep = 0;

/**
 * Trần số khoá trong Map.
 *
 * Quét định kỳ chỉ dọn được khoá ĐÃ HẾT HẠN, mà khoá do người gọi tự sinh ra
 * — mỗi IP giả trong `X-Forwarded-For` là một khoá, mỗi địa chỉ email khác
 * nhau gửi tới `/api/subscribe` là một khoá nữa — thì đều còn hạn trong suốt
 * cửa sổ một giờ. Không có trần thì bộ nhớ của tiến trình tăng theo số request
 * mà người gọi chịu bỏ ra, và tiến trình này phục vụ cả site.
 *
 * 10,000 là con số vừa đủ rộng cho lưu lượng thật (site có vài nghìn lượt
 * xem/ngày, mà chỉ hai route công khai đi qua đây) và vẫn nhỏ so với bộ nhớ
 * một tiến trình Node. Đây là trần cho TOÀN BỘ Map, kể cả ô của xô chung —
 * xem chỗ trừ 1 trong `rateLimit`.
 */
const MAX_WINDOWS = 10_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_AFTER_MS) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Khoá của xô CHUNG dùng khi Map đã đầy.
 *
 * Khi chạm trần, một khoá MỚI không được thêm vào Map nữa — request đó tính
 * vào xô này. Không đuổi khoá nào ra cả.
 *
 * VÌ SAO KHÔNG ĐUỔI, dù đuổi nghe hợp lý hơn: đã thử FIFO và nó TỆ HƠN bản
 * không có trần. Với một botnet có 10,001 IP THẬT (tức là không cần giả
 * `X-Forwarded-For`), chúng bơm cho Map đầy rồi quay vòng đúng những IP vừa bị
 * đuổi — mỗi IP bị đuổi là một cửa sổ mới, tức là tự tay reset giới hạn cho
 * chúng. Bản không trần thì giữ nguyên xô của những IP đó và chặn tới hết giờ.
 * Mọi chính sách đuổi đều có tính chất này; đổi sang ngẫu nhiên chỉ làm nó
 * khó đoán hơn, không mất đi.
 *
 * CÁI GIÁ, nói thẳng: trong lúc bị bơm, một người đọc THẬT vừa tới cũng rơi
 * vào xô chung và có thể bị chặn. Đó là đánh đổi có chủ ý — hai lựa chọn kia
 * đều tệ hơn. Không trần thì bộ nhớ tiến trình tăng tới lúc OOM, mà tiến trình
 * này phục vụ CẢ SITE: mất form đăng ký trong cơn bơm còn hơn mất mọi trang.
 * Đuổi khoá thì như trên, nó reset giới hạn hộ kẻ đang bơm.
 */
const OVERFLOW_KEY = "\u0000overflow";

/**
 * Ngân sách riêng của xô chung, rộng hơn hẳn giới hạn của một người (5/giờ):
 * lúc Map đầy thì mọi người đọc mới đều chung một xô, nên xô đó phải đủ chỗ
 * cho lưu lượng thật chen qua được một lúc, chứ không đóng sập ngay ở request
 * thứ sáu.
 */
const OVERFLOW_LIMIT = 100;

/**
 * Cửa sổ RIÊNG của xô chung, không mượn `windowMs` của người gọi.
 *
 * Xô chung dùng chung cho MỌI người gọi, nên nếu nó lấy `windowMs` của lượt
 * tình cờ tạo ra nó thì cửa sổ của nó do một chi tiết ngẫu nhiên quyết định.
 * Hôm nay cả hai route đều dùng một tiếng nên không thấy gì; ngày ai đó đổi
 * một trong hai, xô chung sẽ âm thầm nhận cửa sổ của route kia và không có
 * chỗ nào đỏ. Cố định ở đây để nó không phụ thuộc vào ai gọi trước.
 */
const OVERFLOW_WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry, for the Retry-After header. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  // Map đầy và đây là khoá chưa từng thấy: tính vào xô chung thay vì mở thêm
  // một ô nhớ mới. Khoá ĐÃ CÓ vẫn đi đường bình thường, kể cả khi Map đầy —
  // đó chính là điểm của cách này, không xô nào đang chặn ai bị mất.
  // `- 1` vì chính xô chung cũng chiếm một ô. Không trừ thì lúc Map đã đủ
  // `MAX_WINDOWS` khoá thường, lượt overflow ĐẦU TIÊN vẫn thêm ô thứ
  // `MAX_WINDOWS + 1` — trần vẫn cứng, nhưng code nói một con số và làm một
  // con số khác, và đó là kiểu sai lặng lẽ khó thấy nhất khi ai đó sửa sau này.
  if (!windows.has(key) && windows.size >= MAX_WINDOWS - 1) {
    key = OVERFLOW_KEY;
    limit = OVERFLOW_LIMIT;
    windowMs = OVERFLOW_WINDOW_MS;
  }

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

/**
 * Khoá xô cho một địa chỉ email, KHÔNG PHẢI chính địa chỉ đó.
 *
 * Map này sống trong bộ nhớ tiến trình cả tiếng đồng hồ. Nhét địa chỉ email
 * thô vào đó là giữ lại thứ đọc được ngay lâu hơn hẳn thời gian cần để phục vụ
 * request — mà thứ duy nhất xô cần là "hai lần gửi này có cùng một đích
 * không", và một chuỗi băm trả lời được câu đó y hệt.
 *
 * ĐỪNG ghi rằng làm thế này là "Map không còn giữ dữ liệu cá nhân". Chuỗi băm
 * vẫn là một định danh giả danh ổn định suốt vòng đời tiến trình, và định danh
 * băm vẫn có thể bị coi là thông tin cá nhân tuỳ ngữ cảnh. Cái đạt được là
 * ĐỊA CHỈ KHÔNG CÒN ĐỌC ĐƯỢC TRỰC TIẾP, không phải là hết nghĩa vụ.
 *
 * Muối sinh ngẫu nhiên mỗi lần khởi động, không đọc từ env: nó không cần bền
 * (restart là mất cả Map). Nó chặn việc dò ngược bằng cách băm thử một danh
 * sách địa chỉ — nhưng CHỈ khi lộ chuỗi băm mà không lộ muối (log, dump một
 * phần). Ai đọc được cả bộ nhớ tiến trình thì đọc được luôn `EMAIL_SALT`.
 *
 * HẠ CHỮ THƯỜNG TOÀN BỘ, kể cả local-part. RFC 5321 nói local-part CÓ THỂ
 * phân biệt hoa/thường, nên đây là một đánh đổi chứ không phải một sự thật:
 * gộp `Bob@` với `bob@` là cố ý, vì nếu không thì đổi hoa/thường là vượt xô
 * ngay — đúng thứ nó sinh ra để chặn. Cái giá: trên một máy chủ thư hiếm hoi
 * thật sự phân biệt hoa/thường, hai hộp thư khác nhau dùng chung một xô và
 * người thứ hai nhận 429 kèm `Retry-After`. Một lần chờ, không mất gì.
 */
export function emailKey(email: string): string {
  return createHash("sha256").update(EMAIL_SALT).update(email.toLowerCase()).digest("hex");
}
