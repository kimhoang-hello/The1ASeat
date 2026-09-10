import { NextRequest, NextResponse } from "next/server";
import { runCheckRebates } from "@/lib/check-rebates";
import { jobAuthResponse } from "@/lib/job-auth";

// Vỏ HTTP mỏng quanh `runCheckRebates`. Toàn bộ phép so nằm trong
// `src/lib/check-rebates.ts` để `scripts/check-rebates.mts` gọi được cùng một
// đoạn mã mà không phải đi qua ghe1a.com — xem đầu file script.
//
// Route vẫn còn vì đây là cách GỌI TAY (curl từ máy, hoặc webhook). Lượt theo
// lịch KHÔNG đi qua đây nữa — nó chạy script trong runner.

// POST only. Một job ghi vào Contentful không nên chạy được bằng cách dán URL
// vào thanh địa chỉ: GET là thứ prefetch của browser, trình quét link và bot
// tự bấm vào.
export async function POST(request: NextRequest) {
  const denied = jobAuthResponse(request, process.env.EXPIRE_OFFERS_SECRET, "EXPIRE_OFFERS_SECRET");
  if (denied) return denied;

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const result = await runCheckRebates({ spaceId, managementToken });

  // Gom lỗi vào body rồi vẫn trả 200 nghĩa là người gọi thấy xanh: FinlyWealth
  // đổi markup hay timeout thì con số rebate cũ nằm lại trên site vô thời hạn,
  // không ai được báo.
  //
  // Route KHÔNG tự thử lại — người gọi tay đọc `errors` rồi tự quyết. Vòng thử
  // lại chỉ nằm ở `scripts/check-rebates.mts`, nơi không có ai ngồi nhìn. Gọi
  // lại an toàn ở cả hai đường: mọi nhánh ghi đối chiếu với bản đã publish
  // trước khi ghi.
  const status = result.errors.length > 0 ? 500 : 200;
  return NextResponse.json(result, { status });
}
