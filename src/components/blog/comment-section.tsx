"use client";

import Script from "next/script";

declare global {
  interface Window {
    CUSDIS?: { initial: () => void };
  }
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
  if (!appId) return null;

  return (
    <div className="mt-12 border-t border-border pt-8">
      <div
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
        onReady={() => window.CUSDIS?.initial()}
      />
    </div>
  );
}
