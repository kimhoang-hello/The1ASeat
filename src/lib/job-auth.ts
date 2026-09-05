import { NextRequest, NextResponse } from "next/server";

/**
 * Shared secret check for the scheduled-job routes.
 *
 * The secret travels in an `Authorization: Bearer` header, and only there. It
 * used to be accepted as `?secret=…` too, which meant every run wrote the
 * secret into Hostinger's access log in plain text — and into any proxy or
 * referrer log along the way. That fallback existed to carry callers through
 * the migration; it is gone now that every caller sends the header (kiểm ngày
 * 29/08/2026: cả ba workflow dùng `-X POST -H "Authorization: Bearer …"`, và
 * webhook `Refresh Ghế 1A site` trong Contentful cũng gửi header, URL không
 * mang query nào). Thêm lại nó là mở lại đúng đường rò cũ.
 *
 * Comparison is length-checked first and then constant-time, so a caller cannot
 * learn the secret one character at a time from response timing.
 */

/**
 * `null` khi được phép đi tiếp, hoặc câu trả lời từ chối kèm đúng mã lỗi.
 *
 * Hai lý do từ chối, HAI mã khác nhau, và đó là toàn bộ điểm của hàm này:
 *
 *  - **500** — server không có biến môi trường nào để so. Đây là lỗi cấu hình
 *    của server, không phải lỗi của người gọi, và nó phải đọc ra như vậy.
 *  - **401** — người gọi đưa sai hoặc không đưa token.
 *
 * Bản trước gộp cả hai thành 401 "Invalid secret". Hậu quả đo được ngày
 * 04/09/2026: một job đỏ với 401 và cả buổi đi tìm secret sai, trong khi thứ
 * đáng nghi là biến môi trường chưa nạp lúc PM2 vừa restart. Một mã lỗi nói
 * dối về tầng hỏng thì đắt hơn hẳn thời gian viết thêm nhánh này.
 *
 * `envName` đi vào phần thân của câu trả lời 500 — tên biến, KHÔNG phải giá
 * trị. Log của Hostinger giữ body, nên đưa giá trị vào đây là dựng lại đúng
 * đường rò mà việc bỏ `?secret=` đã bịt.
 */
export function jobAuthResponse(
  request: NextRequest,
  expected: string | undefined,
  envName: string,
): NextResponse | null {
  if (!expected) {
    return NextResponse.json(
      { message: `Server chưa cấu hình ${envName}` },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!provided || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
