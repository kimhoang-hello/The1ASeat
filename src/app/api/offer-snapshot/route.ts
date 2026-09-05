import { NextRequest, NextResponse } from "next/server";
import { jobAuthResponse } from "@/lib/job-auth";
import { fetchContentfulCreditCardOffers } from "@/lib/content/contentful";
import type { OfferSnapshot } from "@/lib/offer-history";

// Ảnh chụp con số của mọi thẻ tại đúng lúc gọi, để
// .github/workflows/offer-history.yml ghi lại thành lịch sử.
//
// VÌ SAO PHẢI LÀ MỘT ENDPOINT: lịch sử phải nằm trong repo — một job đang chạy
// trên Hostinger không sửa được file nguồn, và ổ đĩa của nó bị dựng lại mỗi
// lần deploy. Chỗ duy nhất ghi được vào repo là GitHub Actions, mà runner ở đó
// KHÔNG có token Contentful (chỉ có `EXPIRE_OFFERS_SECRET`). Nên chiều dữ liệu
// phải đi ngược: server đang có token thì đọc hộ và trả về, runner chỉ ghi.
//
// Đọc qua CDA chứ không phải CMA: lịch sử phải là thứ NGƯỜI ĐỌC ĐÃ THẤY, không
// phải bản nháp tác giả đang viết dở.
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const denied = jobAuthResponse(request, process.env.EXPIRE_OFFERS_SECRET, "EXPIRE_OFFERS_SECRET");
  if (denied) return denied;

  // Chỉ đọc, không ghi gì — nên khác ba job kia, ở đây GET là đúng nghĩa.
  const offers = await fetchContentfulCreditCardOffers();

  const snapshot: OfferSnapshot = {
    takenAt: new Date().toISOString(),
    cards: offers
      .map((offer) => ({
        slug: offer.slug,
        name: offer.name,
        welcomeBonus: offer.welcomeBonus,
        rebate: offer.rebate,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };

  // Danh sách rỗng gần như chắc chắn là Contentful lỗi chứ không phải site
  // thật sự hết thẻ. Ghi nó vào lịch sử là ghi đè một ngày trống lên dữ liệu
  // thật, nên chặn ngay ở đây thay vì để script bên kia đoán.
  if (snapshot.cards.length === 0) {
    return NextResponse.json({ message: "no_cards" }, { status: 500 });
  }

  return NextResponse.json(snapshot);
}
