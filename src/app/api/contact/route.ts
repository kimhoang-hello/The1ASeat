import { NextResponse } from "next/server";
import { clientIp, rateLimit, PUBLIC_BODY_TIMEOUT_MS, readJsonBody } from "@/lib/rate-limit";
import { emailParagraphStyle, escapeHtml } from "@/lib/subscriber-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_INBOX = "info@ghe1a.com";

// Field caps, so one request cannot post a novel into the inbox.
const MAX_NAME = 100;
const MAX_EMAIL = 254; // RFC 5321
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
/**
 * Trần CHUNG cho cả site, đặt cạnh trần theo IP. `clientIp` đọc phần tử đầu của
 * `X-Forwarded-For` — header client tự đặt được nếu proxy Hostinger nối thêm
 * thay vì ghi đè (AGENTS.md: chưa biết). Xoay header là vượt trần theo IP, và
 * đầu kia của route này là hộp thư info@ cộng hạn mức Resend. Trần chung giới
 * hạn thiệt hại bất kể Hostinger làm gì; site ~130 khách/tuần nên người thật
 * không chạm tới nó. Cùng cách với `reco:start:all` ở trang gợi ý thẻ.
 */
const SITE_WIDE_LIMIT = 30;

// Rộng rãi cho MAX_MESSAGE (5000 ký tự, tới 4 byte/ký tự UTF-8) cộng các
// field khác và overhead JSON — xem `readJsonBody` trong lib/rate-limit.ts.
const MAX_BODY_BYTES = 32 * 1024;

/**
 * Hạn giờ cho lượt gọi Resend. `fetch` không có timeout mặc định, nên Resend
 * treo là request treo theo, và `ContactForm` giữ nguyên `status ===
 * "submitting"` với nút Gửi bị disable suốt thời gian đó — người gửi không
 * thấy lỗi, không bấm lại được. Cùng ngưỡng và cùng lý do với
 * `UPSTREAM_TIMEOUT_MS` trong `api/subscribe/route.ts`; xem chú thích dài ở đó.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

function isFilled(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

interface ContactBody {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}

function isValidBody(body: unknown): body is ContactBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    isFilled(b.firstName, MAX_NAME) &&
    isFilled(b.lastName, MAX_NAME) &&
    isFilled(b.email, MAX_EMAIL) &&
    EMAIL_RE.test(b.email) &&
    isFilled(b.subject, MAX_SUBJECT) &&
    isFilled(b.message, MAX_MESSAGE)
  );
}

export async function POST(request: Request) {
  const limit = rateLimit(`contact:${clientIp(request)}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const read = await readJsonBody(request, MAX_BODY_BYTES, PUBLIC_BODY_TIMEOUT_MS);
  if (!read.ok) {
    return NextResponse.json({ error: "invalid_body" }, { status: read.reason === "too_large" ? 413 : read.reason === "timeout" ? 408 : 400 });
  }
  const body = read.value;

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Trần chung đếm SAU khi body hợp lệ, không phải trước: đếm ở đầu route thì
  // 30 POST `{}` từ 30 IP (giả hay thật) là đủ khoá form của cả site trong một
  // giờ (Codex tái hiện 26/09/2026). Lượt rác và lượt đã bị chặn theo IP không
  // được ăn vào phần của người thật.
  const siteWide = rateLimit("contact:all", SITE_WIDE_LIMIT, WINDOW_MS);
  if (!siteWide.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(siteWide.retryAfter) } },
    );
  }

  const { firstName, lastName, email, subject, message } = body;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Contact form: RESEND_API_KEY not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const html = `
    <p style="${emailParagraphStyle}">Từ: ${escapeHtml(firstName)} ${escapeHtml(lastName)} (${escapeHtml(email)})</p>
    <p style="${emailParagraphStyle}">Chủ đề: ${escapeHtml(subject)}</p>
    <p style="${emailParagraphStyle}; white-space: pre-wrap;">${escapeHtml(message)}</p>
  `;

  // Bọc cả lượt gọi: exception mạng trước đây thoát khỏi route thành 500 rỗng.
  // `ContactForm` coi mọi `!res.ok` là lỗi nên 502 lẫn 504 đều ra đúng màn
  // hình "thử lại" — thứ nó không xử lý được là chờ mãi không có phản hồi.
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: "Ghế 1A <info@ghe1a.com>",
        to: CONTACT_INBOX,
        reply_to: email,
        // Dòng tiêu đề thư là MỘT dòng: xuống dòng trong field form không có
        // chỗ nào hợp lệ để đi, và ở tầng SMTP nó là cách chèn header.
        subject: `[Liên hệ] ${subject} — ${firstName} ${lastName}`.replace(/[\r\n]+/g, " "),
        html,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error(timedOut ? "Contact form email timed out" : "Contact form email threw", error);
    return NextResponse.json(
      { error: timedOut ? "upstream_timeout" : "send_failed" },
      { status: timedOut ? 504 : 502 },
    );
  }

  if (!res.ok) {
    console.error("Contact form email failed", res.status, await res.text());
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
