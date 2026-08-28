import { NextRequest, NextResponse } from "next/server";
import { cmaClient, field, listEntries, updateEntry } from "@/lib/contentful-cma";
import { fetchContentfulCreditCardOffers } from "@/lib/content/contentful";
import { fetchFinlyWealthRebate, finlyWealthRebateUrl } from "@/lib/finlywealth";
import { jobSecretValid } from "@/lib/job-auth";

// Called daily (see .github/workflows/check-rebates.yml). FinlyWealth changes
// its rebate amounts without warning — the BMO card went $125 -> $200 — and a
// figure on the card that no longer matches what the reader actually gets is
// worse than no figure at all. This walks every card whose apply link is a
// FinlyWealth rebate product and writes the current amount back.

const CONTENT_TYPE = "creditCardOffer";

export async function POST(request: NextRequest) {
  return handleCheck(request);
}

export async function GET(request: NextRequest) {
  return handleCheck(request);
}

interface Change {
  slug: string;
  from: string | null;
  to: string;
}

async function handleCheck(request: NextRequest) {
  if (!jobSecretValid(request, process.env.EXPIRE_OFFERS_SECRET)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const client = cmaClient(spaceId, managementToken);
  const entries = await listEntries(client, CONTENT_TYPE);

  // Đối chiếu với bản ĐÃ PUBLISH, không phải draft trong CMA. `listEntries`
  // trả draft, mà `updateEntry` ghi draft xong mới publish — nên một lần
  // publish hỏng để lại draft mang số mới trong khi site vẫn phục vụ số cũ, và
  // mọi lần chạy sau đó đều thấy "không đổi" rồi bỏ qua vĩnh viễn. Bản published
  // là thứ người đọc thật sự nhìn thấy, nên nó mới là mốc so.
  const published = new Map(
    (await fetchContentfulCreditCardOffers()).map((offer) => [offer.slug, offer.rebate ?? null]),
  );

  const updated: Change[] = [];
  const unchanged: string[] = [];
  const errors: { slug: string; message: string }[] = [];
  let checked = 0;

  for (const entry of entries) {
    const slug = field<string>(entry, "slug") ?? entry.sys.id;
    const applyUrl = field<string>(entry, "applyUrl");
    if (!applyUrl) continue;

    const rebateUrl = finlyWealthRebateUrl(applyUrl);
    // Cards linked to a non-rebate FinlyWealth page, or straight to an issuer's
    // own referral, have no rebate to keep in sync.
    if (!rebateUrl) continue;

    // Thẻ chưa publish bao giờ thì không nằm trên site, không có gì để giữ cho
    // khớp — và `updateEntry` cũng cố ý không publish giúp nó.
    if (!published.has(slug)) continue;

    checked += 1;
    try {
      const current = await fetchFinlyWealthRebate(rebateUrl);
      const live = published.get(slug) ?? null;

      if (live === current) {
        unchanged.push(slug);
        continue;
      }

      // Site đang lệch, nhưng entry có thay đổi chưa publish: có thể là bản
      // nháp tác giả đang viết dở, và `updateEntry` publish cả entry chứ không
      // publish riêng một trường. Báo để người sửa, tuyệt đối không tự đẩy bản
      // nháp của người khác lên site.
      if (entry.sys.publishedVersion && entry.sys.version > entry.sys.publishedVersion + 1) {
        errors.push({
          slug,
          message: `site đang hiện ${live ?? "(trống)"} còn FinlyWealth trả ${current}, nhưng entry có thay đổi chưa publish — job không tự ghi, publish tay trong Contentful`,
        });
        continue;
      }

      await updateEntry(client, entry, CONTENT_TYPE, { rebateVi: current });
      updated.push({ slug, from: live, to: current });
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Gom lỗi vào body rồi vẫn trả 200 nghĩa là `curl -sfS` trong workflow thấy
  // xanh: FinlyWealth đổi markup hay timeout thì con số rebate cũ nằm lại trên
  // site vô thời hạn, không ai được báo. Gọi lại an toàn — route đối chiếu với
  // Contentful trước khi ghi, và workflow đã có sẵn `--retry 3`.
  const status = errors.length > 0 ? 500 : 200;
  return NextResponse.json({ checked, updated, unchanged, errors }, { status });
}
