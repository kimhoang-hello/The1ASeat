import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { USER_FIXTURES } from "@/lib/recommendation/data/user-fixtures";
import { ENGINE_VERSION, RULE_VERSION, recoDebuggerEnabled } from "@/lib/recommendation";
import { todayInSiteZone } from "@/lib/format-date";
import { DebuggerForm } from "./debugger-form";

// Tiêu đề chỉ khi đang bật: metadata tĩnh đi vào cả trang 404, và một trang
// "không tồn tại" mang tên "Recommendation Debugger" là tự khai nó có ở đó.
export function generateMetadata(): Metadata {
  return recoDebuggerEnabled()
    ? { title: "Recommendation Debugger", robots: { index: false, follow: false } }
    : { robots: { index: false, follow: false } };
}

// Chạy engine trên hồ sơ gõ tay: không có gì để dựng tĩnh, và không được lọt
// vào CDN — xem `recoDebuggerEnabled`.
export const dynamic = "force-dynamic";

export default function RecoDebuggerPage() {
  if (!recoDebuggerEnabled()) notFound();
  const fixtures = USER_FIXTURES.map((state) => ({
    id: state.profile.id as string,
    json: JSON.stringify(state, null, 2),
  }));
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold">Recommendation Debugger (§22)</h1>
      <p className="mt-2 text-sm text-foreground/70">
        engine {ENGINE_VERSION} · luật biên tập {RULE_VERSION} · chỉ bật khi chạy local hoặc có
        {" "}<code>RECO_DEBUGGER=1</code>. Cùng dữ liệu, cùng lịch sử offer với production.
      </p>
      <DebuggerForm fixtures={fixtures} defaultAsOf={todayInSiteZone()} />
    </section>
  );
}
