import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    console.error("Newsletter subscribe: KIT_API_KEY / KIT_FORM_ID not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const res = await fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, email }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Kit subscribe failed", res.status, body);
    return NextResponse.json({ error: "subscribe_failed" }, { status: 502 });
  }

  await sendWelcomeEmail(email);

  return NextResponse.json({ ok: true });
}

// Placeholder subject/body — Hoàng will supply the real welcome copy later,
// just swap these two constants out when he does.
const WELCOME_SUBJECT = "Chào mừng bạn đến với Ghế 1A!";
const WELCOME_HTML = `
  <p>Cảm ơn bạn đã đăng ký nhận bản tin từ Ghế 1A!</p>
  <p>Bạn sẽ nhận được email mỗi khi có bài viết mới về Miles &amp; Points, thẻ tín dụng, và Award Travel.</p>
  <p>Hẹn gặp lại,<br />Hoàng — Ghế 1A</p>
`;

// Sends a one-off welcome email to the new subscriber via Resend, from
// info@ghe1a.com. Best-effort: a failure here never fails the subscribe
// request itself, since the Kit subscription above already succeeded.
async function sendWelcomeEmail(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Welcome email: RESEND_API_KEY not configured");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "Ghế 1A <info@ghe1a.com>",
      to: email,
      subject: WELCOME_SUBJECT,
      html: WELCOME_HTML,
    }),
  });

  if (!res.ok) {
    console.error("Welcome email failed", res.status, await res.text());
  }
}
