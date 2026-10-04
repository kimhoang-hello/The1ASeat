import { HotTip } from "@/components/ui/hot-tip";
import { t as translate } from "@/lib/t";

const offers = translate("offers");

/**
 * The editor's take is one plain-text field in Contentful, and the rebate
 * cards end it with a "HOT TIP: ..." sentence. Split that sentence back out so
 * it can be given its own emphasis instead of disappearing into the paragraph
 * — it is the line that earns the rebate, and it was the least visible part of
 * the box. Anything without a HOT TIP just renders as before.
 */
export function splitHotTip(editorsTake: string): { body: string; hotTip?: string } {
  const match = editorsTake.match(/\bHOT\s*TIP\s*:\s*/i);
  if (!match || match.index === undefined) return { body: editorsTake };

  const body = editorsTake.slice(0, match.index).trim();
  const hotTip = editorsTake.slice(match.index + match[0].length).trim();
  if (!body || !hotTip) return { body: editorsTake };

  return { body, hotTip };
}

export function EditorsTake({
  editorsTake,
  className = "",
}: {
  editorsTake: string;
  className?: string;
}) {
  const { body, hotTip } = splitHotTip(editorsTake);

  return (
    // Không còn hộp nền kem (03/10/2026): trang thẻ đã là một bề mặt, thêm một
    // hộp nữa là hộp lồng hộp.
    //
    // Tiêu đề là H2 cùng kiểu với "Thông tin nhanh" và "Quyền lợi chính" ngay
    // trên và dưới nó (04/10/2026, audit UX/UI). Trước đó là một dòng chữ navy
    // thường: người dùng trình đọc màn hình nhảy theo tiêu đề đi thẳng từ
    // "Thông tin nhanh" sang "Quyền lợi chính", bỏ qua đúng phần nhận định;
    // còn mắt thì thấy chữ navy — màu của link — mà bấm không được.
    <section className={className}>
      <h2 className="font-display text-xl font-bold text-foreground">{offers("editorsTake")}</h2>
      <p className="mt-3 leading-relaxed text-foreground/90">{body}</p>

      {hotTip && (
        <div className="mt-4">
          <HotTip>{hotTip}</HotTip>
        </div>
      )}
    </section>
  );
}
