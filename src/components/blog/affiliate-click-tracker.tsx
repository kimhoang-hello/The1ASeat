"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

/**
 * Đo click vào link affiliate NẰM TRONG thân bài viết.
 *
 * VÌ SAO LÀ COMPONENT RỖNG, TÌM DOM BẰNG SELECTOR: để thân bài vẫn nằm trọn
 * trong Server Component. Cách hiển nhiên hơn — một Client Component bọc lấy
 * thân bài và tự `dangerouslySetInnerHTML` — kéo cả cây đó qua ranh giới
 * client chỉ để gắn một `addEventListener`.
 *
 * ĐỪNG viện lý do "để khỏi gửi HTML hai lần" — ĐÃ ĐO VÀ SAI: trang blog đã
 * dựng sẵn chứa chuỗi thân bài ĐÚNG HAI LẦN dù đi đường nào (một lần là HTML
 * đã render, một lần trong RSC payload), vì payload phải mô tả cả prop
 * `dangerouslySetInnerHTML` của Server Component. Cái được ở đây là ranh giới
 * client nhỏ hơn, không phải ít byte hơn.
 *
 * VÌ SAO CẦN ĐO Ở ĐÂY: `ApplyLink` phủ được nút "Apply ngay" và vùng ảnh thẻ,
 * nhưng thân bài là đường ra affiliate thứ ba và là đường không có component
 * React nào để treo `onClick` — HTML dựng ở server từ rich text Contentful.
 * Kiểm tại nguồn 30/08/2026: cả 5 link trong thân bài của 36 bài đều có hoa
 * hồng (FinlyWealth ×3, Chexy, Neobanc). Doanh thu thật, không phải ca lý
 * thuyết.
 *
 * NHẬN DIỆN BẰNG `rel~="sponsored"`, không phải bằng một danh sách host chép
 * lại: `relForUrl` trong `lib/affiliate-links.ts` đã là chốt duy nhất quyết
 * định link nào có hoa hồng, và bản sao thứ hai sẽ lệch vào ngày thêm đối tác.
 */
export function AffiliateClickTracker({ scope, slug }: { scope: string; slug: string }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`[data-affiliate-scope="${scope}"]`);
    if (!root) return;

    function handle(event: MouseEvent) {
      // Chuột phải cũng phát `auxclick`; mở menu ngữ cảnh thì chưa ai đi đâu.
      if (event.type === "auxclick" && (event as MouseEvent).button !== 1) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[rel~='sponsored']");
      if (!anchor) return;
      sendGAEvent("event", "apply_clicked", { placement: "post_body", product: slug });
    }

    // `capture` để bắt trước khi có gì kịp `stopPropagation`. `auxclick` vì bấm
    // nút giữa mở tab mới KHÔNG phát `click` — cùng lý do với `ApplyLink`.
    root.addEventListener("click", handle, true);
    root.addEventListener("auxclick", handle, true);
    return () => {
      root.removeEventListener("click", handle, true);
      root.removeEventListener("auxclick", handle, true);
    };
  }, [scope, slug]);

  return null;
}
