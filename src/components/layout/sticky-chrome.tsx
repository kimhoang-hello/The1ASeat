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
  //
  // Cột flex cao TỐI ĐA một màn hình: phần nào của khối dính thò khỏi mép
  // dưới màn hình thì không bao giờ cuộn tới được (cuộn chỉ trượt trang phía
  // sau). Đo 03/10/2026 ở 375×812: mở nhóm "Thẻ tín dụng" trong menu mobile là
  // khối cao 929px, nút "Đăng ký bản tin" đứng yên ở 904px. Trần này cộng
  // `min-h-0` của header và panel menu (`site-header.tsx`) làm panel co lại
  // và tự cuộn. Làm bằng CSS chứ không đo bằng JS: dải offer đổi chiều cao
  // (48–82px tuỳ tên thẻ) mỗi lần xoay thẻ, kể cả khi menu đang mở.
  // `max-h-screen` là đường lui cho trình duyệt chưa hiểu `dvh` (iOS < 15.4).
  const cap = "flex max-h-screen flex-col supports-[height:100dvh]:max-h-dvh";
  return <div className={`${sticky ? "sticky top-0" : "relative"} z-50 ${cap}`}>{children}</div>;
}
