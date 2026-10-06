import Link from "next/link";
import { t } from "@/lib/t";

/**
 * Những mảnh dùng chung của hai bảng `/transfer-partners` (Canada và Mỹ), để hai
 * bảng trên một trang đọc như một: cùng ô tỷ lệ, cùng cột chương trình, cùng
 * nhãn nhóm, cùng hàng tiêu đề dính. Sửa giao diện ở đây là sửa cả hai bảng.
 */
const tp = t("transferPartners");

/**
 * Cột tên chương trình dính mép trái khi các cột tỷ lệ cuộn ngang: trên điện
 * thoại bảng rộng hơn khung cuộn, và không có nó người đọc vuốt tới cột ngân
 * hàng thứ hai mà không biết tỷ lệ đó thuộc chương trình nào.
 */
export const STICKY_COL = "sticky left-0 z-10";

/**
 * Hàng tên cột dính dưới khối dính của site từ `xl`. Chỉ từ `xl` vì đó là chỗ
 * cả hai bảng vừa khung không cần cuộn ngang: khung đổi sang `overflow-clip`,
 * KHÔNG phải `overflow-hidden` — `hidden` tạo khung cuộn riêng và nuốt luôn
 * `sticky`. Dưới `xl` khung còn `overflow-x-auto` nên hàng này không dính được;
 * ở đó cột tên chương trình dính trái là thứ giữ hướng cho người đọc.
 *
 * Đỉnh là `--chrome-h` (chiều cao thật của khối dính, `StickyChrome` đo), không
 * phải `top-chrome`: 9rem để hở một khe mà các hàng cuộn qua lộ ra phía trên
 * hàng tiêu đề (đo 06/10/2026 ở 1280px: khối cao 113px, khe 31px).
 */
export const STICKY_HEAD = "xl:sticky xl:top-[var(--chrome-h,9rem)]";

/** Khung của bảng. `relative`: không có nó các `sr-only` trong bảng thoát khỏi khung cuộn và kéo ngang được cả trang. */
export const TABLE_FRAME = "relative overflow-x-auto rounded-2xl border border-border xl:overflow-clip";

/** Ô tiêu đề cột: tên hệ điểm viết hoa + số đối tác bên dưới. */
export function IssuerNameCell({ name, count }: { name: string; count: number }) {
  return (
    <th
      className={`${STICKY_HEAD} min-w-[7.5rem] bg-primary px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide xl:z-20`}
    >
      {name}
      <span className="mt-0.5 block font-normal normal-case tracking-normal opacity-80">
        {tp("partnerCount", { count })}
      </span>
    </th>
  );
}

/** Ô góc trái hàng tiêu đề — dính cả trái lẫn trên nên phải nằm trên mọi ô dính khác. */
export function ProgramColumnHead() {
  return (
    <th
      className={`${STICKY_COL} ${STICKY_HEAD} min-w-[9.5rem] bg-primary px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:min-w-[13rem] sm:px-4 xl:z-30`}
    >
      {tp("columnProgram")}
    </th>
  );
}

/**
 * Ô tỷ lệ. Ô trống là gạch ngang `muted-foreground` (5.53:1) kèm một dòng
 * `sr-only` đọc thành chữ: chỉ một dấu gạch thì screen reader không nói gì, trên
 * đúng cái bảng mà "không chuyển được" là một nửa câu trả lời.
 *
 * Ô có số mang màu TRUNG TÍNH cho mọi ngân hàng (03/10/2026): tên ngân hàng
 * không phải một lời đánh giá. `lines` là các dòng nhỏ dưới tỷ lệ (điều kiện,
 * thời gian…), dòng `muted` mờ hơn.
 */
export function RatioCell({
  ratio,
  lines = [],
}: {
  ratio: string | null;
  lines?: { text: string; muted?: boolean }[];
}) {
  if (!ratio) {
    return (
      <td className="px-2 py-3 text-center text-muted-foreground">
        <span aria-hidden>{tp("noData")}</span>
        <span className="sr-only">{tp("noDataLabel")}</span>
      </td>
    );
  }

  return (
    <td className="px-1 py-2.5">
      <div className="mx-auto flex max-w-[9.5rem] flex-col items-center gap-0.5 rounded-lg bg-secondary px-2 py-1.5 text-center text-foreground">
        <span className="whitespace-nowrap text-sm font-bold">{ratio}</span>
        {lines.map((line) => (
          <span key={line.text} className={`text-xs ${line.muted ? "opacity-80" : ""}`}>
            {line.text}
          </span>
        ))}
      </div>
    </td>
  );
}

/**
 * Nhãn nhóm (Hãng bay / Khách sạn) nằm trong ô dính trái, không phải một ô
 * `colSpan` trải hết hàng: ô rộng hơn khung cuộn thì `sticky` không giữ được
 * chữ, và trên điện thoại nhãn trôi mất khi vuốt sang các cột bên phải.
 */
export function GroupHeaderRow({ title, columns }: { title: string; columns: number }) {
  return (
    <tr className="border-t border-border bg-background">
      <th
        scope="rowgroup"
        className={`${STICKY_COL} bg-background px-3 pb-2 pt-5 text-left text-sm font-semibold text-muted-foreground sm:px-4`}
      >
        {title}
      </th>
      <td colSpan={columns} className="bg-background" />
    </tr>
  );
}

/**
 * Ô tên chương trình — `th scope="row"`, không phải `td`: người dùng screen
 * reader nhảy giữa các ô tỷ lệ phải nghe được ô đó thuộc chương trình nào.
 *
 * Màu sọc của hàng phải lặp lại trên chính ô này: ô dính bị nhấc ra khỏi thứ tự
 * vẽ của hàng, không có nền đặc riêng thì các cột tỷ lệ cuộn lộ ra bên dưới nó.
 *
 * Chương trình nào Award Flight Finder có bảng giá (`quotable`) thì tên thành
 * link sang đó.
 */
export function ProgramCell({
  program,
  detail,
  logo,
  stripe,
  quotable,
}: {
  program: string;
  detail?: string;
  logo: string;
  stripe: string;
  quotable: boolean;
}) {
  return (
    <th
      scope="row"
      className={`${STICKY_COL} px-3 py-3 text-left font-medium text-foreground sm:px-4 ${stripe}`}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          className="h-8 w-8 shrink-0 rounded-md border border-border bg-white object-contain p-1"
        />
        <span className="min-w-0">
          {quotable ? (
            <Link
              href="/award-flight-finder"
              className="text-primary underline decoration-border underline-offset-4 hover:decoration-primary"
            >
              {program}
            </Link>
          ) : (
            <span>{program}</span>
          )}
          {detail && (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{detail}</span>
          )}
        </span>
      </div>
    </th>
  );
}

/** Sọc xen kẽ trong một nhóm, bắt đầu lại ở mỗi nhóm. */
export function stripeFor(index: number): string {
  return index % 2 === 0 ? "bg-card" : "bg-background";
}
