/**
 * One place decides what `rel` an outbound link carries, because the answer has
 * to be the same whether the link is an apply button, a card image or something
 * an editor dropped into a Contentful rich-text body.
 */

/** Marks the link as the affiliate link it is, wherever an apply link is rendered. */
export const AFFILIATE_REL = "sponsored nofollow noopener noreferrer";

/** The same link when there is no commission behind it — no `sponsored`, because
 *  claiming a paid relationship that does not exist is its own kind of lie. */
export const PLAIN_REL = "nofollow noopener noreferrer";

/** An ordinary outbound link: safe to open, still followable, because linking to
 *  a source is not the kind of thing search engines need warning about. */
export const EDITORIAL_REL = "noopener noreferrer";

/**
 * The hosts the author earns a referral from. Rich text gives an editor nowhere
 * to mark a link as sponsored, so the body renderer looks the host up here
 * instead — the alternative is an unmarked affiliate link, which is the one
 * thing the rest of the site is careful never to ship.
 *
 * Add a host here whenever a new referral arrangement starts.
 */
const REFERRAL_SOURCES: { host: string; path?: string }[] = [
  { host: "finlywealth.com" },
  { host: "chexy.co" },
  { host: "neobanc.com" },
  // Amex trả thưởng qua link referral riêng của tác giả, nằm ở nhánh
  // `/referral/` — nhưng một link tới trang sản phẩm Amex mà biên tập viên dán
  // vào bài viết thì không có hoa hồng nào. Khoá theo đường dẫn, vì đánh dấu
  // nhầm cả host cũng sai y như bỏ sót.
  { host: "americanexpress.com", path: "/referral/" },
];

/** `/referral` phải là một đoạn đường dẫn trọn vẹn, không phải chuỗi con:
 *  `includes("/referral/")` vừa trượt `/en-ca/referral` (không có gạch cuối)
 *  vừa nhận nhầm `/không-referral-gì-cả/`. */
function matchesSegment(pathname: string, segment: string): boolean {
  const name = segment.replace(/^\/|\/$/g, "");
  return pathname.split("/").includes(name);
}

export function isReferralUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Bỏ dấu chấm cuối: "americanexpress.com." là cùng một host với
  // "americanexpress.com" nhưng so chuỗi thẳng thì trượt.
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  // Giải mã TRƯỚC rồi mới hạ chữ thường — làm ngược lại thì `/%52eferral/`
  // giải ra `/Referral/` và trượt phép so chữ thường, tức một link có hoa hồng
  // thật mất dấu `sponsored`. Giải nhiều lượt vì mã hoá hai lần cũng trượt.
  let pathname = parsed.pathname;
  for (let i = 0; i < 3; i += 1) {
    let next: string;
    try {
      next = decodeURIComponent(pathname);
    } catch {
      break; // Mã hoá hỏng — dùng bản đang có.
    }
    if (next === pathname) break;
    pathname = next;
  }
  pathname = pathname.toLowerCase();

  return REFERRAL_SOURCES.some(
    ({ host, path }) =>
      (hostname === host || hostname.endsWith(`.${host}`)) && (!path || matchesSegment(pathname, path)),
  );
}

/** `null` for a same-site link, which needs neither a `rel` nor a new tab. */
export function relForUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  return isReferralUrl(url) ? AFFILIATE_REL : EDITORIAL_REL;
}
