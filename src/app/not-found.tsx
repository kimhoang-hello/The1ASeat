import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/lib/t";

const notFound = t("notFound");
const common = t("common");

/**
 * Trang 404 vẫn mang đúng tiêu đề mặc định của cả site, nên tab trình duyệt và
 * lịch sử của người đọc ghi nó y hệt trang chủ. Đặt tiêu đề riêng để nhìn tab
 * là biết mình đi lạc.
 *
 * Không dùng `pageMetadata` như các trang khác: helper đó gắn canonical trỏ về
 * một URL thật, mà URL ở đây thì không tồn tại. Chỉ cần tiêu đề và `noindex` —
 * Next đã trả đúng HTTP 404 rồi, đây là lớp chặn thứ hai cho trường hợp Google
 * vẫn ghé qua.
 */
export const metadata: Metadata = {
  title: notFound("title"),
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold tracking-wide text-primary">{notFound("eyebrow")}</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
        {notFound("title")}
      </h1>
      <p className="mt-3 text-muted-foreground">{notFound("description")}</p>
      <Link
        href="/"
        className="mt-8 inline-block cursor-pointer rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {common("backHome")}
      </Link>
    </section>
  );
}
