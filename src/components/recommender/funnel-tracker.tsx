"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

import { markRecommenderCard } from "@/lib/recommender/via";

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
        // KHÔNG kèm "trả lời gì" — kể cả "chưa có thẻ nào": đó vẫn là một câu
        // trả lời về người dùng (Codex, vòng bác bản vá 27/09/2026).
        sendGAEvent("event", "recommender_answered", { question });
      } else if (kind === "skip") {
        sendGAEvent("event", "recommender_skipped", { question });
      } else if (kind === "reset") {
        sendGAEvent("event", "recommender_reset", {});
      }
    };
    // Sang trang thẻ từ kết quả ("Đọc kỹ về thẻ này", "Xem thẻ"). Phần lớn
    // người đọc không bấm Apply ngay trên trang gợi ý mà đọc trang thẻ trước —
    // không có event này thì 2 click `recommender_primary` trong 30 ngày không
    // phân biệt được "bỏ dở" với "sang trang thẻ rồi mới apply" (GA4 10/10/2026).
    // Chỉ slug thẻ công khai và vị trí, như `apply_clicked`.
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof HTMLElement ? event.target.closest("a[data-reco-card]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      // Chuột giữa phát `auxclick`, không phát `click` (như `ApplyLink`); chuột
      // phải cũng là `auxclick` nhưng chưa đi đâu cả.
      if (event.type === "auxclick" && event.button !== 1) return;
      const product = link.dataset.recoProduct ?? "unknown";
      sendGAEvent("event", "recommender_card_clicked", { position: link.dataset.recoCard ?? "unknown", product });
      // Đánh dấu `via` chỉ khi trang thẻ mở NGAY TRONG tab này. Cmd/Ctrl/Shift+click
      // hay chuột giữa mở tab khác: ghi dấu vào tab gợi ý là gắn `via` nhầm cho
      // một lần apply sau này của tab này (Codex, 10/10/2026).
      const sameTab =
        event.type === "click" && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
      if (sameTab) markRecommenderCard(product);
    };
    document.addEventListener("submit", onSubmit, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("auxclick", onClick, { capture: true });
    return () => {
      document.removeEventListener("submit", onSubmit, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("auxclick", onClick, { capture: true });
    };
  }, []);
  return null;
}

/**
 * Người đọc đã thấy một KẾT QUẢ — đáy của phễu trước `apply_clicked`.
 *
 * Trước đây phễu dừng ở `recommender_answered`: không biết bao nhiêu người tới
 * được trang kết quả, và kết quả đó là "mở thẻ" hay "chưa cần mở thẻ" — mà hai
 * thứ đó đọc ngược nhau khi đếm click Apply (GA4 10/10/2026).
 *
 * Một lần cho mỗi lượt chạy: F5 hay tab thứ hai hiện lại đúng lượt đó
 * (`runForDisplay`) nên không bắn lại. Nhớ id lượt chạy cuối bằng `localStorage`
 * — `sessionStorage` riêng từng tab nên hai tab cùng hồ sơ từng đếm hai lần
 * (Codex, 10/10/2026). Bọc try/catch: có trình duyệt chặn nó; mất thì chỉ đếm dư.
 * `runId` KHÔNG gửi lên GA4: nó là khoá tra cứu hồ sơ ở phía mình.
 */
export function RecommenderResultSeen({
  runId,
  goal,
  outcome,
}: {
  runId: string;
  /** Cùng chuỗi với `recommender_started` (`goalValueOf`). */
  goal: string;
  outcome: "open_card" | "no_new_card";
}) {
  useEffect(() => {
    const key = "g1a_reco_seen";
    try {
      if (window.localStorage.getItem(key) === runId) return;
    } catch {
      // Không đọc được thì vẫn đếm.
    }
    // Lần tải trang ĐẦU, effect này chạy trước script khởi tạo GA
    // (`afterInteractive`, nằm sau `main` trong layout) — `sendGAEvent` khi đó
    // bỏ event kèm một cảnh báo. Đợi `dataLayer` có mặt, tối đa ~10 giây; điều
    // hướng phía client (sau mỗi câu trả lời) thì nó đã có sẵn.
    let tries = 0;
    // Kiểm LẠI ngay lúc gửi, rồi giữ chỗ trước khi gửi: hai tab cùng mở trước
    // khi GA sẵn sàng đều qua phép kiểm đầu, và tab đến sau vẫn gửi (Codex, vòng
    // bác bản vá 10/10/2026). Hai tab đọc–ghi xen kẽ đúng cùng khoảnh khắc vẫn
    // có thể đếm dư MỘT event (`localStorage` không có khoá liên tab) — chấp
    // nhận: số NGƯỜI của event trong GA4 không đổi, không dựng khoá cho ca đó.
    const send = () => {
      try {
        if (window.localStorage.getItem(key) === runId) return;
        window.localStorage.setItem(key, runId);
      } catch {
        // Không nhớ được thì F5 đếm thêm một lần.
      }
      sendGAEvent("event", "recommender_result", { goal, outcome });
    };
    const ready = () => Array.isArray((window as { dataLayer?: unknown }).dataLayer);
    if (ready()) {
      send();
      return;
    }
    const timer = window.setInterval(() => {
      tries += 1;
      if (ready()) send();
      if (ready() || tries >= 40) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [runId, goal, outcome]);
  return null;
}
