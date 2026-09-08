import { slugifyVi } from "@/lib/blog-categories";

export type TocItem = { id: string; text: string };

/**
 * Mục lục của một bài, dựng TỪ CHÍNH HTML thân bài chứ không phải từ một field
 * riêng trong Contentful.
 *
 * Lý do là hai giá trị tách rời nhau thì lệch được: người viết đổi tên một
 * mục trong thân bài, mục lục vẫn đọc tên cũ, và cái link vẫn nhảy đúng chỗ
 * nên không ai phát hiện. Đọc thẳng từ thân bài thì không có gì để lệch.
 *
 * CHỈ `h2`. Rich text của bài dùng `h2` cho các mục lớn; `h3` trong DOM trang
 * bài đến từ `CardSpotlight` và thẻ bài liên quan — đó là component, không
 * phải mục của bài, và đưa chúng vào mục lục là nói dối về cấu trúc bài.
 */
const H2 = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gắn `id` vào từng `h2` của thân bài và trả về mục lục tương ứng.
 *
 * `id` trùng nhau được đánh số đuôi: hai mục cùng tên trong một bài là chuyện
 * có thật, và hai phần tử cùng `id` thì trình duyệt luôn nhảy về cái đầu —
 * link của mục thứ hai sẽ im lặng dẫn sai chỗ.
 */
export function withHeadingAnchors(blocks: string[]): { blocks: string[]; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();

  const out = blocks.map((block) =>
    block.replace(H2, (match, attrs: string, inner: string) => {
      // Heading đã tự mang `id` thì để nguyên: đè lên nó là làm hỏng những
      // link đang trỏ tới đúng cái id đó từ nơi khác.
      if (/\bid\s*=/i.test(attrs)) return match;

      const text = plainText(inner);
      if (!text) return match;

      const base = slugifyVi(text) || "muc";
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;

      toc.push({ id, text });
      return `<h2${attrs} id="${id}">${inner}</h2>`;
    }),
  );

  return { blocks: out, toc };
}
