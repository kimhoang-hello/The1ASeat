"use client";

import Link from "next/link";
import { sendGAEvent } from "@next/third-parties/google";

/**
 * Link trong bốn bước của `/bat-dau`, có đo.
 *
 * VÌ SAO CẦN: trước đây chỉ ngã ba đầu trang bắn `start_here_goal`, nên biết
 * được người ta chọn lối nào nhưng không biết có ai đi tiếp hay không. Trang
 * này tồn tại để dẫn người đọc sang thẻ tín dụng và bản tin — đúng hai thước
 * đo thành công trong PRODUCT.md — mà cả hai đều không quy về được trang này.
 *
 * `step` là số bước, `target` là đích. Hai thuộc tính rời chứ không phải một
 * chuỗi ghép, để trong GA4 còn gộp được theo bước.
 *
 * Client component CHỈ vì `sendGAEvent`. Vẫn là `<Link>` thật, nên tắt
 * JavaScript thì vẫn đi được — chỉ mất số đo.
 */
export function StartHereLink({
  href,
  step,
  target,
  className,
  children,
}: {
  href: string;
  step: number;
  target: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => sendGAEvent("event", "start_here_step", { step, target })}
    >
      {children}
    </Link>
  );
}
