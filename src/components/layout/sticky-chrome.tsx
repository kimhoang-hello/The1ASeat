"use client";

import { usePathname } from "next/navigation";
import { CATCH_THE_POINTS_PATH } from "@/lib/catch-the-points-path";

/**
 * Dải offer + thanh nav dính trên cùng — trừ vài trang tự xin không dính.
 *
 * Trang game là trang duy nhất hiện nay: lúc chơi, khung game cao gần hết màn
 * hình, mà một thanh dính đè lên đó vừa ăn mất chiều cao sân chơi vừa che
 * đúng phần HUD điểm và đồng hồ đếm ngược.
 *
 * Client Component chỉ để đọc `usePathname` — `children` vẫn được layout gốc
 * (Server Component) dựng sẵn rồi truyền vào, nên không có gì bị kéo thêm
 * xuống client.
 */
const NOT_STICKY: string[] = [CATCH_THE_POINTS_PATH];

export function StickyChrome({ children }: { children: React.ReactNode }) {
  const sticky = !NOT_STICKY.includes(usePathname());

  // `z-50` giữ nguyên ở cả hai nhánh: panel tìm kiếm và menu mobile thả xuống
  // từ thanh này, chúng vẫn phải nằm trên nội dung trang.
  return <div className={sticky ? "sticky top-0 z-50" : "relative z-50"}>{children}</div>;
}
