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

const SITE_URL = "https://ghe1a.com";
const WELCOME_SUBJECT = "Chào mừng bạn đến với Ghế 1A";

// Table-based layout with inline styles — email clients (Gmail especially)
// strip <style> blocks and don't support Tailwind, so the site's cream/navy
// palette and rounded-pill buttons have to be hand-inlined here to match
// src/app/globals.css instead of reused from it.
const WELCOME_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${WELCOME_SUBJECT}</title>
    <style>
      /* The site itself has no dark theme, so opt this email out of mail
         clients' auto dark mode too — otherwise Gmail/Apple Mail invert or
         wash out the navy logo and text on their own dark backgrounds. */
      :root { color-scheme: light only; supported-color-schemes: light only; }
      [data-ogsc] .email-bg { background-color: #FAF6EC !important; }
      [data-ogsc] .email-card { background-color: #FFFFFF !important; }
      [data-ogsc] .email-text { color: #1A1613 !important; }
      [data-ogsc] .email-brand { color: #0F2A4A !important; }
      [data-ogsc] .email-muted { color: #6B6259 !important; }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#FAF6EC;" class="email-bg">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Cảm ơn bạn đã đăng ký nhận bản tin từ Ghế 1A
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;" class="email-bg">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px; vertical-align:middle;">
                      <img
                        src="${SITE_URL}/images/logo.png"
                        width="56"
                        height="56"
                        alt=""
                        style="display:block; border-radius:12px;"
                      />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:22px; font-weight:800; letter-spacing:-0.01em; color:#0F2A4A;" class="email-brand">Ghế 1A</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#FFFFFF; border:1px solid #E5DAC3; border-radius:20px; padding:40px 36px;" class="email-card">
                <p style="margin:0 0 18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.7; color:#1A1613;" class="email-text">
                  Chào mừng bạn đến với Ghế 1A.
                </p>
                <p style="margin:0 0 18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.7; color:#1A1613;" class="email-text">
                  Khởi đầu chỉ là một chút tò mò về Miles &amp; Points đã nhanh chóng trở thành đam mê của mình từ lúc nào không hay. Càng tìm hiểu về các offers thẻ tín dụng, các chương trình khách hàng thân thiết của hãng hàng không và khách sạn, cũng như cách đặt vé award, mình càng nhận ra rằng những trải nghiệm du lịch tuyệt vời không nhất thiết phải đi kèm với một mức giá đắt đỏ.
                </p>
                <p style="margin:0 0 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.7; color:#1A1613;" class="email-text">
                  Ghế 1A là nơi mình chia sẻ tất cả những gì đã học được trên hành trình đó — từ chiến lược thẻ tín dụng trong thực tế, các mẹo tận dụng chương trình khách hàng thân thiết, hướng dẫn đặt vé award, đánh giá chuyến bay và khách sạn, đến những trải nghiệm đổi điểm thực tế. Mình hy vọng những kiến thức và kinh nghiệm này sẽ giúp bạn tận dụng tối đa số điểm của mình và truyền cảm hứng cho chuyến đi tiếp theo — dù đó là chuyến bay award đầu tiên hay chuyến đi trong mơ ở khoang hạng Nhất.
                </p>
                <p style="margin:0 0 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.7; color:#1A1613;" class="email-text">
                  Hẹn gặp bạn ở ghế 1A.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:999px; background-color:#0F2A4A;">
                      <a
                        href="${SITE_URL}/blog"
                        style="display:inline-block; padding:12px 26px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:14px; font-weight:600; color:#FFFFFF; text-decoration:none;"
                      >
                        Khám phá bài viết mới nhất →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; color:#6B6259;" class="email-muted">
                Ghế 1A · <a href="${SITE_URL}" style="color:#6B6259;">ghe1a.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
