"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    CUSDIS?: { initial: () => void };
    CUSDIS_LOCALE?: Record<string, string>;
  }
}

// Cusdis' own auto-resize (postMessage from its iframe) doesn't reliably fire,
// leaving the widget stuck at the browser's default 150px iframe height. Its
// srcdoc iframe has no `sandbox` attribute, so it shares our origin — we read
// its real content height directly and size the iframe ourselves instead.
const CUSDIS_LOCALE_VI: Record<string, string> = {
  powered_by: "Bình luận được cung cấp bởi Cusdis",
  post_comment: "Gửi bình luận",
  loading: "Đang tải bình luận...",
  email: "Email (tuỳ chọn)",
  nickname: "Tên hiển thị",
  reply_placeholder: "Nội dung bình luận",
  reply_btn: "Trả lời",
  sending: "Đang gửi...",
  mod_badge: "QUẢN TRỊ",
  content_is_required: "Vui lòng nhập nội dung bình luận",
  nickname_is_required: "Vui lòng nhập tên hiển thị",
  comment_has_been_sent: "Bình luận của bạn đã được gửi. Vui lòng chờ duyệt trước khi hiển thị công khai.",
};

function hideEmailField(doc: Document) {
  const emailInput = doc.querySelector<HTMLInputElement>('input[name="email"]');
  const wrapper = emailInput?.closest("div");
  if (!wrapper || wrapper.style.display === "none") return;
  wrapper.style.display = "none";
  const grid = wrapper.parentElement;
  if (grid) grid.style.gridTemplateColumns = "1fr";
}

function syncHeight(iframe: HTMLIFrameElement, doc: Document) {
  iframe.style.height = `${doc.documentElement.scrollHeight}px`;
}

export function CommentSection({
  pageId,
  url,
  title,
}: {
  pageId: string;
  url: string;
  title: string;
}) {
  const appId = process.env.NEXT_PUBLIC_CUSDIS_APP_ID;
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appId) return;
    const thread = threadRef.current;
    if (!thread) return;

    let timeoutId = 0;
    let attempts = 0;
    let observer: MutationObserver | null = null;

    function attach() {
      const iframe = thread?.querySelector("iframe");
      const doc = iframe?.contentDocument;
      if (!iframe || !doc?.body) {
        if (attempts++ < 100) timeoutId = window.setTimeout(attach, 100);
        return;
      }
      hideEmailField(doc);
      syncHeight(iframe, doc);
      observer = new MutationObserver(() => {
        hideEmailField(doc);
        syncHeight(iframe, doc);
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }

    attach();

    return () => {
      observer?.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, [appId, pageId]);

  if (!appId) return null;

  return (
    <div className="mt-12 border-t border-border pt-8">
      <div
        ref={threadRef}
        id="cusdis_thread"
        data-host="https://cusdis.com"
        data-app-id={appId}
        data-page-id={pageId}
        data-page-url={url}
        data-page-title={title}
      />
      <Script
        src="https://cusdis.com/js/cusdis.es.js"
        strategy="afterInteractive"
        onReady={() => {
          window.CUSDIS_LOCALE = CUSDIS_LOCALE_VI;
          window.CUSDIS?.initial();
        }}
      />
    </div>
  );
}
