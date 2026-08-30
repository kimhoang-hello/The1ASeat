import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SITE_URL, emailParagraphStyle, renderSubscriberEmailHtml } from "@/lib/subscriber-email";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
// A person subscribes once. Five an hour leaves room for a typo, a retry and a
// second address for the family, and nothing beyond that.
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  // Ahead of parsing: this endpoint has someone else's inbox on the other end
  // of it, so the cheapest possible rejection is the right one.
  const limit = rateLimit(`subscribe:${clientIp(request)}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof email !== "string" || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
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

const WELCOME_SUBJECT = "Chào mừng bạn đến với Ghế 1A";

const WELCOME_BODY_HTML = `
  <p style="${emailParagraphStyle}" class="email-text">Chào mừng bạn đến với Ghế 1A.</p>
  <p style="${emailParagraphStyle}" class="email-text">Khởi đầu chỉ là một chút tò mò về Miles &amp; Points đã nhanh chóng trở thành đam mê của mình từ lúc nào không hay. Càng tìm hiểu về các offers thẻ tín dụng, các chương trình khách hàng thân thiết của hãng hàng không và khách sạn, cũng như cách đặt vé award, mình càng nhận ra rằng những trải nghiệm du lịch tuyệt vời không nhất thiết phải đi kèm với một mức giá đắt đỏ.</p>
  <p style="${emailParagraphStyle}" class="email-text">Ghế 1A là nơi mình chia sẻ tất cả những gì đã học được trên hành trình đó — từ chiến lược thẻ tín dụng trong thực tế, các mẹo tận dụng chương trình khách hàng thân thiết, hướng dẫn đặt vé award, đánh giá chuyến bay và khách sạn, đến những trải nghiệm đổi điểm thực tế. Mình hy vọng những kiến thức và kinh nghiệm này sẽ giúp bạn tận dụng tối đa số điểm của mình và truyền cảm hứng cho chuyến đi tiếp theo — dù đó là chuyến bay award đầu tiên hay chuyến đi trong mơ ở khoang hạng Nhất.</p>
  <p style="${emailParagraphStyle}" class="email-text">Hẹn gặp bạn ở ghế 1A.</p>
`;

/**
 * CTA của email chào mừng, GATE theo `START_HERE_PUBLISHED` như mọi cửa vào
 * khác của `/bat-dau`.
 *
 * Đây là cửa duy nhất nằm ngoài site, và là cửa duy nhất KHÔNG THU HỒI ĐƯỢC.
 * Một link trên trang thì tắt cờ là biến mất; một link đã gửi vào hộp thư thì
 * nằm đó mãi. Không gate thì tắt cờ lại là mọi subscriber mới nhận email trỏ
 * thẳng vào một trang `noindex` đang đeo dải "Trang nháp, chưa công bố" —
 * đúng cái mà docstring của cờ hứa là không xảy ra.
 *
 * Cờ tắt thì quay về đích cũ (`/blog`), không phải bỏ trống CTA: người vừa
 * đăng ký bản tin vẫn cần một chỗ để đi.
 */
const WELCOME_HTML = renderSubscriberEmailHtml({
  title: WELCOME_SUBJECT,
  preheader: "Cảm ơn bạn đã đăng ký nhận bản tin từ Ghế 1A",
  bodyHtml: WELCOME_BODY_HTML,
  ...(START_HERE_PUBLISHED
    ? {
        ctaHref: `${SITE_URL}/bat-dau`,
        ctaLabel: "Xem lộ trình mới bắt đầu ở đây →",
      }
    : {
        ctaHref: `${SITE_URL}/blog`,
        ctaLabel: "Khám phá bài viết mới nhất →",
      }),
});

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
