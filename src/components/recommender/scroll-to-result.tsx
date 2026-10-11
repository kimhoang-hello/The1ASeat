"use client";

import { useEffect } from "react";

/**
 * Cuộn về thẻ gợi ý (`#ket-qua`) khi câu trả lời vừa rồi đổi hành động chính.
 *
 * Server Action chuyển hướng về cùng URL nên Next giữ nguyên chỗ cuộn ở câu hỏi
 * — đúng khi gợi ý không đổi, sai khi nó đổi: thẻ mới nằm khuất phía trên. Chỉ
 * được render khi đã đổi; `token` là id lượt chạy, nên hai lần đổi liên tiếp
 * (cùng URL) vẫn cuộn cả hai. `scrollIntoView` tôn trọng `scroll-margin-top`
 * (`scroll-mt-chrome`), nên thẻ không bị khối dính che. Không có JavaScript thì
 * câu báo đổi vẫn nằm trên thẻ — chỉ thiếu cú cuộn.
 *
 * MỘT lần mỗi lượt chạy: Back từ trang thẻ dựng lại trang từ cache và mount lại
 * component này với cùng `token` — cuộn lần nữa là giành chỗ cuộn trình duyệt
 * vừa khôi phục (Codex, 10/10/2026). Nhớ bằng `sessionStorage`; chặn được thì
 * cùng lắm cuộn thêm một lần.
 */
export function ScrollToResult({ token }: { token: string }) {
  useEffect(() => {
    const key = "g1a_reco_scrolled";
    try {
      if (window.sessionStorage.getItem(key) === token) return;
      window.sessionStorage.setItem(key, token);
    } catch {
      // Không nhớ được thì vẫn cuộn.
    }
    document.getElementById("ket-qua")?.scrollIntoView({ block: "start" });
  }, [token]);
  return null;
}
