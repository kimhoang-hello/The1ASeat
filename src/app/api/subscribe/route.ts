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

  return NextResponse.json({ ok: true });
}
