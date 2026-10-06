import messages from "../../messages/vi.json";

type Messages = typeof messages;
type Namespace = keyof Messages;

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    str
  );
}

/**
 * The site's name is two words that must never be split across a line — "Ghế"
 * stranded above a lone "1A." reads as a typo. Joining them with a non-breaking
 * space here rather than in the JSON means every string is covered, including
 * copy written later, and nobody has to remember to type an invisible
 * character. The source files keep an ordinary space, so the strings stay
 * searchable and diffable.
 */
export const BRAND = "Ghế 1A";
/** The same name with a space that cannot break — what a reader ends up seeing. */
export const BRAND_NO_BREAK = BRAND.replace(" ", "\u00A0");

/** Exported for the copy that comes from Contentful rather than from these files. */
export function keepBrandTogether(str: string): string {
  return str.replaceAll(BRAND, BRAND_NO_BREAK);
}

/**
 * Bản của `t` cho Client Component và mọi file chúng import: nhận thẳng bảng
 * chuỗi, `translator(messages.nav)`, với `messages` import trực tiếp từ
 * `messages/vi.json`.
 *
 * `t("nav")` tra khoá ĐỘNG, nên webpack không biết namespace nào được dùng và
 * nhét nguyên `vi.json` (53 KB, ~15 KB gzip) vào bundle trình duyệt — của MỌI
 * trang, vì header là Client Component trong layout gốc. `messages.nav` là
 * truy cập tĩnh: webpack chỉ giữ những namespace phía client thật sự đọc.
 * Một lời gọi `t(...)` trong cây client — kể cả ở đầu một file lib mà client
 * import gián tiếp — là kéo lại cả file JSON (đo 05/10/2026).
 */
export function translator(table: Record<string, string>) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const raw = table[key];
    if (raw === undefined) return key;
    return keepBrandTogether(interpolate(raw, vars));
  };
}

/** Vietnamese-only stand-in for next-intl's useTranslations/getTranslations. Server only — see `translator`. */
export function t<N extends Namespace>(namespace: N) {
  return translator(messages[namespace] as Record<string, string>);
}
