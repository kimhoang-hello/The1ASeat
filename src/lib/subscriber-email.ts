import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import { BLOCKS, MARKS, type Document } from "@contentful/rich-text-types";

export const SITE_URL = "https://ghe1a.com";

const FONT_HEADING = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_BODY = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const emailParagraphStyle = `margin:0 0 18px; font-family:${FONT_BODY}; font-size:15px; line-height:1.7; color:#1A1613;`;
export const emailHeadlineStyle = `margin:0 0 18px; font-family:${FONT_HEADING}; font-size:19px; font-weight:800; letter-spacing:-0.01em; color:#0F2A4A;`;

const emailListStyle = `margin:0 0 18px; padding-left:20px; font-family:${FONT_BODY}; font-size:15px; line-height:1.7; color:#1A1613;`;
const emailSubheadingStyle = `margin:24px 0 12px; font-family:${FONT_HEADING}; font-size:17px; font-weight:800; letter-spacing:-0.01em; color:#0F2A4A;`;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Contentful's rich-text renderer emits bare tags (<p>, <ul>, ...) with no
// styling — email clients don't apply our stylesheet reliably, so every tag
// needs its own inline style, same as the hand-written paragraphs elsewhere
// in this file.
export function renderPostBodyForEmail(document: Document): string {
  return documentToHtmlString(document, {
    renderMark: {
      [MARKS.BOLD]: (text) => `<strong style="font-weight:700;">${text}</strong>`,
      [MARKS.ITALIC]: (text) => `<em>${text}</em>`,
    },
    renderNode: {
      [BLOCKS.PARAGRAPH]: (_node, next) => `<p style="${emailParagraphStyle}">${next(_node.content)}</p>`,
      [BLOCKS.HEADING_1]: (node, next) => `<h2 style="${emailHeadlineStyle}">${next(node.content)}</h2>`,
      [BLOCKS.HEADING_2]: (node, next) => `<h2 style="${emailSubheadingStyle}">${next(node.content)}</h2>`,
      [BLOCKS.HEADING_3]: (node, next) => `<h3 style="${emailSubheadingStyle}">${next(node.content)}</h3>`,
      [BLOCKS.UL_LIST]: (node, next) => `<ul style="${emailListStyle}">${next(node.content)}</ul>`,
      [BLOCKS.OL_LIST]: (node, next) => `<ol style="${emailListStyle}">${next(node.content)}</ol>`,
      [BLOCKS.LIST_ITEM]: (node, next) => `<li style="margin-bottom:8px;">${next(node.content)}</li>`,
    },
  });
}

interface SubscriberEmailOptions {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaHref: string;
  ctaLabel: string;
}

// Shared design system for every email sent to Ghế 1A subscribers (welcome
// email, new-post notifications, ...): cream/navy palette matching
// src/app/globals.css, logo+wordmark header like the site nav, a pill CTA
// button, and a light-only dark-mode opt-out (the site itself has no dark
// theme, so mail clients' auto dark mode just washes out the navy logo).
// Table-based layout with inline styles since email clients strip <style>
// blocks / don't support Tailwind.
export function renderSubscriberEmailHtml({
  title,
  preheader,
  bodyHtml,
  ctaHref,
  ctaLabel,
}: SubscriberEmailOptions): string {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${title}</title>
    <style>
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
      ${preheader}
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
                      <span style="font-family:${FONT_HEADING}; font-size:22px; font-weight:800; letter-spacing:-0.01em; color:#0F2A4A;" class="email-brand">Ghế 1A</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#FFFFFF; border:1px solid #E5DAC3; border-radius:20px; padding:40px 36px;" class="email-card">
                ${bodyHtml}
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:999px; background-color:#0F2A4A;">
                      <a
                        href="${ctaHref}"
                        style="display:inline-block; padding:12px 26px; font-family:${FONT_HEADING}; font-size:14px; font-weight:600; color:#FFFFFF; text-decoration:none;"
                      >
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:28px; font-family:${FONT_BODY}; font-size:12px; color:#6B6259;" class="email-muted">
                Ghế 1A · <a href="${SITE_URL}" style="color:#6B6259;">ghe1a.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
