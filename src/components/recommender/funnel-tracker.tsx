"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

/**
 * Phễu của trang gợi ý: bắt đầu → trả lời / bỏ qua → (apply_clicked với
 * `placement=recommender_primary`, đã có sẵn ở `ApplyLink`).
 *
 * VÌ SAO NGHE Ở `document` thay vì gắn `onSubmit` vào từng form: mọi form của
 * trang là form thuần + Server Action, dựng trong server component, và chạy
 * được khi không có JavaScript (xem `actions.ts`). Gắn handler vào chúng là
 * biến cả bảng câu hỏi thành client component chỉ để đếm. Ở đây form chỉ mang
 * `data-reco-event`; không có JavaScript thì không có số đo — và bảng câu hỏi
 * vẫn chạy y hệt.
 *
 * CHỈ GỬI THỨ KHÔNG NÓI GÌ VỀ NGƯỜI DÙNG: loại câu hỏi (`kind`, không bao giờ
 * `kind:subject` — subject có thể là id phiên, thứ mở được cả hồ sơ) và mục
 * tiêu đã chọn. Không gửi câu trả lời: thu nhập, số dư, thẻ đang giữ là dữ
 * liệu tài chính, và GA4 không phải chỗ của chúng.
 *
 * Tên tham số tránh `source`/`medium`/`campaign`/`term`/`content` — GA4 đọc
 * chúng thành nguồn phiên (AGENTS.md, mục Đo đạc GA4 20/09/2026).
 */
export function RecommenderFunnelTracker() {
  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      const kind = form?.dataset.recoEvent;
      if (!form || !kind) return;
      const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      if (kind === "start") {
        // Nút mục tiêu là nút gửi; không bấm nút nào (Enter trong form) thì
        // không có mục tiêu — máy chủ sẽ trả lỗi, nên cũng không phải một lượt bắt đầu.
        if (submitter?.name !== "goal" || submitter.value === "") return;
        // Bỏ tick "Mình đang sống ở Canada" thì máy chủ chuyển sang trang báo
        // "chỉ dùng được ở Canada" mà không tạo hồ sơ — không phải một lượt
        // bắt đầu (Codex, review 27/09/2026).
        const canada = form.elements.namedItem("canada");
        if (!(canada instanceof HTMLInputElement) || !canada.checked) return;
        sendGAEvent("event", "recommender_started", { goal: submitter.value });
        return;
      }
      const question = form.dataset.recoQuestion ?? "unknown";
      if (kind === "answer") {
        // "Mình chưa có thẻ nào" / "chưa có điểm ở đâu" là một câu trả lời, và
        // là câu trả lời phổ biến nhất của người mới — tách ra để đọc được.
        sendGAEvent("event", "recommender_answered", {
          question,
          answer_none: submitter?.name === "none" ? "yes" : "no",
        });
      } else if (kind === "skip") {
        sendGAEvent("event", "recommender_skipped", { question });
      } else if (kind === "reset") {
        sendGAEvent("event", "recommender_reset", {});
      }
    };
    document.addEventListener("submit", onSubmit, { capture: true });
    return () => document.removeEventListener("submit", onSubmit, { capture: true });
  }, []);
  return null;
}
