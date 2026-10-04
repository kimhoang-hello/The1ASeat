"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "@phosphor-icons/react";
import { t } from "@/lib/t";

const tBanner = t("banner");

export interface FeaturedOffer {
  slug: string;
  name: string;
  teaser: string;
  cardImage: string;
}

/** Long enough that the strip is read rather than watched. */
const ROTATE_MS = 30000;

/**
 * Cycles the strip through the elevated offers. The order arrives already
 * shuffled from the server — doing it here instead would mean the first card
 * rendered on the server and the first card after hydration disagreed.
 */
export function FeaturedOfferRotator({ offers }: { offers: FeaturedOffer[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (paused || dismissed || offers.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % offers.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, dismissed, offers.length]);

  if (dismissed) return null;

  const offer = offers[index];
  const href = `/credit-cards/${offer.slug}`;

  return (
    // Paused on hover and on focus: without it a card can swap out from under
    // a cursor that was already on its way to the button.
    <div
      className="bg-primary text-primary-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* One line from sm up, where there is room to truncate and still say
          something. Below that the offer stacks onto two short lines and the
          strip grows instead — a cut-off card name is worth nothing. */}
      <div className="flex min-h-12 items-center gap-3 px-4 py-2 sm:h-12 sm:px-6 sm:py-0 lg:px-10 2xl:px-16">
        <span className="hidden shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider md:inline-block">
          {tBanner("eyebrow")}
        </span>

        {/* Mọi offer cùng nằm MỘT ô lưới (`col-start-1 row-start-1`), chỉ offer
            đang hiện là nhìn thấy được. Ô lưới cao bằng offer DÀI NHẤT, nên đổi
            thẻ không còn làm dải cao thấp ±16px — và cả trang nhích theo (ghi
            "biết, chưa sửa" ở AGENTS.md mục 03/10/2026, vá cùng ngày sau audit
            UX/UI). Tên thẻ vẫn đầy đủ trên điện thoại, không cắt: cái giá là dải
            cao hơn một chút với thẻ tên ngắn. Từ `sm` dải vốn cao cố định 48px.

            Offer đang ẩn: `invisible` + `inert` (không bấm, không Tab, screen
            reader bỏ qua), và không tải ảnh — ô ảnh cỡ cố định nên một khối rỗng
            cùng cỡ là đủ giữ chỗ. Đổi sang `animate-offer-in` lúc được hiện là
            phát lại hiệu ứng mờ dần, như bản cũ làm bằng `key`. */}
        <div className="grid min-w-0 flex-1 items-center">
          {offers.map((item, i) => {
            const active = i === index;
            return (
              <div
                key={item.slug}
                aria-hidden={active ? undefined : true}
                inert={!active}
                className={`col-start-1 row-start-1 flex min-w-0 items-center ${
                  active ? "animate-offer-in" : "invisible"
                }`}
              >
                <Link
                  href={`/credit-cards/${item.slug}`}
                  tabIndex={active ? undefined : -1}
                  className="flex min-w-0 items-center gap-2.5 hover:opacity-90 sm:gap-3"
                >
                  {item.cardImage &&
                    (active ? (
                      <Image
                        src={item.cardImage}
                        alt=""
                        // 56×32 is the box the classes below paint. Any other ratio
                        // here and next/image warns that one dimension was changed
                        // without the other — the artwork itself is letterboxed inside
                        // the box by object-contain, whatever shape it arrives in.
                        width={56}
                        height={32}
                        sizes="56px"
                        className="h-8 w-14 shrink-0 rounded object-contain"
                      />
                    ) : (
                      <span className="h-8 w-14 shrink-0" />
                    ))}
                  <span className="min-w-0 text-xs leading-snug sm:truncate sm:text-sm">
                    <span className="block font-bold sm:inline">{item.name}</span>
                    <span className="hidden sm:inline"> • </span>
                    {/* Its own line on a phone, part of the same sentence above that,
                        where truncate takes care of a row that runs out of room. */}
                    <span className="block text-primary-foreground/75 sm:inline">{item.teaser}</span>
                  </span>
                </Link>
              </div>
            );
          })}
        </div>

        <Link
          href={href}
          // Cùng cách với nút đóng: pill vẫn cao 28px, vùng chạm 44px do
          // `::before` phủ lên. Chỉ nới theo CHIỀU DỌC (`w-full`, không phải
          // `w-11`) để không chồm sang nút đóng bên cạnh.
          //
          // Lập luận cũ "cụm bên trái đã là target lớn nên pill không cần" đã
          // BỊ BÁC: cụm đó chỉ cao 32px (ảnh `h-8`), và một target khác cùng
          // đích không làm cái pill này bấm trúng hơn.
          className="relative hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary-foreground px-4 py-1.5 text-xs font-bold text-primary transition-opacity before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] hover:opacity-90 sm:inline-flex"
        >
          {tBanner("cta")}
          <ArrowRight size={12} weight="bold" />
        </Link>

        <button
          type="button"
          aria-label={tBanner("close")}
          onClick={() => setDismissed(true)}
          // Vùng chạm 44px bằng PSEUDO-ELEMENT, không phải bằng `h-11 w-11`.
          //
          // Dải này cao `min-h-12` + `py-2`, nên một nút 44px thật đẩy chiều
          // cao tối thiểu trên điện thoại từ 48px lên 60px — sửa một lỗi chạm
          // bằng cách làm dải chiếm thêm một phần tư màn hình đầu. `::before`
          // nằm ngoài luồng bố cục nên vùng chạm to ra mà dải không cao thêm
          // một pixel nào. Nền tròn vẫn 32px và chỉ hiện khi hover.
          className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-foreground/70 transition-colors before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:bg-white/10 hover:text-primary-foreground"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
