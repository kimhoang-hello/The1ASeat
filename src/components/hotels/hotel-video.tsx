"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "@phosphor-icons/react";

import { VideoThumbnail } from "@/components/blog/video-thumbnail";

/**
 * Video review, chỉ tải trình phát YouTube khi người đọc bấm.
 *
 * Trang bài video nhúng iframe thẳng (`loading="lazy"`), nhưng ở trang khách
 * sạn video nằm giữa trang trên điện thoại: cuộn ngang qua là iframe tải về
 * cả trình phát YouTube — hàng trăm KB script cho một video người đọc có thể
 * không xem. Ở đây trước khi bấm chỉ có một tấm ảnh.
 *
 * Là một LINK tới trang xem trên YouTube, không phải nút: JS chưa chạy (hoặc
 * hỏng) thì bấm vẫn tới được video; Cmd/Ctrl/nút giữa vẫn mở tab YouTube như
 * mọi link khác. Chỉ cú bấm trái trần mới đổi thành trình phát tại chỗ.
 *
 * Bấm xong thì focus chuyển vào iframe: link đang giữ focus biến mất, và không
 * chuyển thì trình duyệt thả focus về `body` (luật ở DESIGN-SYSTEM.md 5.4).
 */
export function HotelVideo({
  videoId,
  title,
  playLabel,
}: {
  videoId: string;
  title: string;
  /** Nhãn cho trình đọc màn hình, vd. "Phát video: <tên>". */
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-primary">
      {playing ? (
        <iframe
          ref={frameRef}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          aria-label={playLabel}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setPlaying(true);
          }}
          className="group absolute inset-0 block cursor-pointer"
        >
          <VideoThumbnail
            src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
            fallbackSrc={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            sizes="(min-width: 1280px) 42rem, (min-width: 768px) 704px, calc(100vw - 2rem)"
            className="object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-navy-ink shadow-md transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Play size={28} weight="fill" aria-hidden />
            </span>
          </span>
        </a>
      )}
    </div>
  );
}
