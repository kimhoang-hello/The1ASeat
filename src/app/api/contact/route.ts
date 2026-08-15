import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "Ghế 1A <info@ghe1a.com>",
      to: CONTACT_INBOX,
      reply_to: email,
      subject: `[Liên hệ] ${subject} — ${firstName} ${lastName}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("Contact form email failed", res.status, await res.text());
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
