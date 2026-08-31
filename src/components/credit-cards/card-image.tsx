import Image from "next/image";
import { MediaPlaceholder, isPlaceholderIcon } from "@/components/ui/media-placeholder";
import { AFFILIATE_REL, PLAIN_REL, isReferralUrl } from "@/lib/affiliate-links";
import { ApplyLink } from "@/components/ui/apply-link";

/**
 * Vùng ảnh thẻ là ĐƯỜNG CLICK THỨ HAI ra affiliate, nên khi nó click được thì
 * nó phải đo được y như nút bên cạnh — nếu không `apply_clicked` báo thấp hơn
 * thực tế mà không ai nhận ra.
 *
 * Union chứ không phải ba prop optional: prop optional cộng một giá trị mặc
 * định kiểu `"unknown"` thì chỗ gọi mới quên truyền vẫn build xanh, chỉ có số
 * liệu âm thầm sai. Ở đây có `applyUrl` là BUỘC phải có `placement` và
 * `product`; không có `applyUrl` thì CẤM truyền chúng.
 */
type ApplyOverlay =
  | { applyUrl: string; placement: string; product: string }
  | { applyUrl?: undefined; placement?: never; product?: never };

export function CardImage({
  image,
  name,
  className = "",
  badge,
  applyUrl,
  placement,
  product,
  // The artwork is object-contain, so it paints a shape narrower than the box
  // it sits in — `sizes` has to describe the painted width, not the box, or
  // the browser fetches a variant several times larger than it can show. The
  // default is the width a card's own page paints.
  sizes = "320px",
  // `preload`, không phải `priority`: Next 16 đánh dấu prop cũ là deprecated
  // và ném lỗi nếu truyền cả hai. Ý nghĩa không đổi — bỏ lazy-load và cho
  // trình duyệt nạp sớm ảnh này.
  preload = false,
  // Thẻ nào chưa có ảnh thật thì Contentful đã cho chọn sẵn một biểu tượng ở
  // trường `image` — trước đây giá trị đó không được đọc tới, nên thẻ đặt
  // "airplane" vẫn ra hình thẻ tín dụng như mọi thẻ khác.
  placeholderIcon,
}: {
  image: string;
  name: string;
  className?: string;
  badge?: React.ReactNode;
  sizes?: string;
  preload?: boolean;
  placeholderIcon?: string;
} & ApplyOverlay) {
  return (
    <div className={`relative ${className}`}>
      {image ? (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-secondary">
          <Image
            src={image}
            alt={name}
            fill
            sizes={sizes}
            preload={preload}
            className="object-contain p-3"
          />
        </div>
      ) : (
        <MediaPlaceholder
          icon={placeholderIcon && isPlaceholderIcon(placeholderIcon) ? placeholderIcon : "credit-card"}
          tone="tan"
          className="absolute inset-0 rounded-[inherit]"
        />
      )}
      {badge}
      {applyUrl && (
        // Sits above the artwork and the ribbon so the whole box is one hit
        // target. Hidden from keyboard and screen readers on purpose: it
        // duplicates the labelled apply button next to it, and an extra
        // unlabelled link in the tab order would only get in the way.
        <ApplyLink
          href={applyUrl}
          // Cùng luật với ApplyButton ngay bên cạnh: chỉ link thật sự có hoa
          // hồng mới mang `sponsored`. Hai link phủ lên nhau mà công bố khác
          // nhau thì ít nhất một cái đang nói sai.
          rel={isReferralUrl(applyUrl) ? AFFILIATE_REL : PLAIN_REL}
          // `_image` nối vào bề mặt chứ không phải một bề mặt riêng: trong GA4
          // vẫn tách được ảnh với nút, mà gộp theo tiền tố thì ra tổng click
          // của cả trang đó.
          placement={`${placement}_image`}
          product={product}
          ariaHidden
          tabIndex={-1}
          className="absolute inset-0 z-10 cursor-pointer rounded-[inherit]"
        />
      )}
    </div>
  );
}
