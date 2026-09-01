"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Ảnh thumbnail video, có đường lùi khi bản `maxresdefault` không tồn tại.
 *
 * YouTube không sinh bản 1280×720 cho mọi video (xem `lib/video-embed.ts`), và
 * `/_next/image` trả 404 theo upstream — nên thẻ bài của một video thiếu
 * `maxres` sẽ hiện ô trống, không có gì báo. Ở đây trình duyệt vẫn còn chạy nên
 * bắt được `onError` và đổi sang `hqdefault`, bản chắc chắn có.
 *
 * VÌ SAO KHÔNG DÙNG THẲNG `hqdefault` CHO NHANH: thẻ bài rộng 384px thì 480×360
 * là đủ, nhưng cùng hàm này còn dùng ở chỗ khác và `maxres` là bản nét hơn hẳn
 * khi có. Lùi khi hỏng thì được cả hai; đổi sẵn thì 15 video đang có `maxres`
 * mất chất lượng để đề phòng một ca chưa xảy ra.
 *
 * `unoptimized` cho lượt lùi: `/_next/image` cache theo URL, và một entry 404
 * đã nằm trong cache của nó thì lượt sau vẫn 404. Lấy thẳng từ `i.ytimg.com`
 * bỏ qua lớp đó — ảnh này chỉ hiện khi đường tối ưu đã hỏng, nên không phải
 * đường nóng.
 */
export function VideoThumbnail({
  src,
  fallbackSrc,
  alt,
  sizes,
  className = "",
}: {
  src: string;
  fallbackSrc: string | null;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Không còn đường lùi nào thì thôi, đừng lặp vô hạn giữa hai URL.
  const useFallback = failed && fallbackSrc !== null;

  return (
    <Image
      src={useFallback ? fallbackSrc : src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized={useFallback}
      onError={() => setFailed(true)}
    />
  );
}
