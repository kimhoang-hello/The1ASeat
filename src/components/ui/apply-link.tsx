"use client";

import { sendGAEvent } from "@next/third-parties/google";

/**
 * Mọi đường ra affiliate của site đi qua đây, và đây là chỗ DUY NHẤT bắn
 * `apply_clicked`.
 *
 * VÌ SAO CẦN: PRODUCT.md có đúng hai thước đo thành công — đăng ký bản tin và
 * bấm "Apply ngay". Cái đầu đã đo được từ `NewsletterForm` (`newsletter_subscribed`
 * kèm `source`); cái thứ hai, tức là toàn bộ doanh thu, cho tới nay không đo
 * được ở đâu cả. Không có nó thì mọi câu hỏi kiểu "trang so sánh có đáng
 * không", "khối Đi tiếp từ đây có dẫn được ai sang thẻ không" đều chỉ trả lời
 * được bằng cảm giác.
 *
 * `placement` và `product` là BẮT BUỘC, cùng luật với `source` của
 * `NewsletterForm`: một event `apply_clicked` không nói được nó xảy ra ở đâu
 * thì chỉ đếm được tổng, mà tổng thì Kit/FinlyWealth đã có rồi.
 *
 * KHÔNG chặn điều hướng, không `preventDefault`, không `await`. Link mở tab
 * mới (`target="_blank"`) nên tab hiện tại còn sống và `sendGAEvent` cứ thế
 * gửi nốt — đánh đổi ngược lại (giữ người đọc lại vài trăm ms cho chắc số đo)
 * là lấy tiền của người đọc trả cho tiện nghi của mình.
 *
 * Component này CHỈ tồn tại vì `sendGAEvent` cần chạy ở client. Nó không giữ
 * state, không nhận `children` là function, nên qua được ranh giới RSC.
 */
export function ApplyLink({
  href,
  rel,
  placement,
  product,
  className,
  children,
  ariaHidden,
  tabIndex,
}: {
  href: string;
  rel: string;
  /** Bề mặt phát ra click: "card_detail", "card_list", "home_offers", … */
  placement: string;
  /** Slug của thẻ hoặc tài khoản, để nối event với đúng sản phẩm. */
  product: string;
  className?: string;
  children?: React.ReactNode;
  ariaHidden?: boolean;
  tabIndex?: number;
}) {
  const track = () => sendGAEvent("event", "apply_clicked", { placement, product });

  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className={className}
      aria-hidden={ariaHidden}
      tabIndex={tabIndex}
      onClick={() => track()}
      // Bấm NÚT GIỮA để mở tab mới phát `auxclick`, KHÔNG phát `click` — link
      // vẫn mở, hoa hồng vẫn tính, nhưng số đo mất. Chỉ nhận nút giữa
      // (`button === 1`): chuột phải cũng là `auxclick`, mà mở menu ngữ cảnh
      // thì chưa ai đi đâu cả. Cmd/Ctrl+click trái vẫn đi qua `onClick`.
      onAuxClick={(event) => {
        if (event.button === 1) track();
      }}
    >
      {children}
    </a>
  );
}
