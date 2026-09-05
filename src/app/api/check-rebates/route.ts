import { NextRequest, NextResponse } from "next/server";
import { cmaClient, field, listEntries, LOCALE, updateEntry } from "@/lib/contentful-cma";
import { fetchContentfulCreditCardOffers } from "@/lib/content/contentful";
import { fetchFinlyWealthRebate, finlyWealthRebateUrl } from "@/lib/finlywealth";
import { jobAuthResponse } from "@/lib/job-auth";
import { RESERVED_SLUG, slugClashMessage } from "@/lib/card-compare";
import { rebateProseMismatches, rebateProsePatch } from "@/lib/rebate-prose";

// Called twice a day (see .github/workflows/check-rebates.yml). FinlyWealth
// changes its rebate amounts without warning — the BMO card went $125 -> $200 —
// and a figure on the card that no longer matches what the reader actually gets
// is worse than no figure at all. This walks every card whose apply link is a
// FinlyWealth rebate product and writes the current amount back.

const CONTENT_TYPE = "creditCardOffer";

// POST only. Một job ghi vào Contentful không nên chạy được bằng cách dán URL
// vào thanh địa chỉ: GET là thứ prefetch của browser, trình quét link và bot
// tự bấm vào.
export async function POST(request: NextRequest) {
  return handleCheck(request);
}

interface Change {
  slug: string;
  from: string | null;
  to: string;
  /** Tên các trường chữ được sửa kèm, rỗng khi phần chữ vốn đã đúng. */
  prose: string[];
}

async function handleCheck(request: NextRequest) {
  const denied = jobAuthResponse(request, process.env.EXPIRE_OFFERS_SECRET, "EXPIRE_OFFERS_SECRET");
  if (denied) return denied;

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
  //
  // `applyUrl` cũng lấy từ đây chứ không lấy từ draft, vì nó quyết định PHẠM VI
  // kiểm: đọc từ draft thì một tác giả đang sửa dở link (hoặc vừa đổi sang
  // link chưa publish) là đủ để thẻ rơi ra khỏi vòng lặp trong im lặng, job
  // trả 200, còn số rebate trên site thì lệch mãi.
  const published = new Map(
    (await fetchContentfulCreditCardOffers()).map((offer) => [
      offer.slug,
      {
        rebate: offer.rebate ?? null,
        applyUrl: offer.applyUrl,
        // Chữ hiển thị, để đối chiếu con số rebate viết tay trong câu HOT TIP.
        // Lấy từ bản published vì đó là thứ người đọc đang nhìn thấy — bản
        // draft có thể là câu tác giả đang viết dở, báo lỗi vào đó là báo sai.
        prose: {
          headlineVi: offer.headline,
          editorsTakeVi: offer.editorsTake,
          keyBenefitsVi: offer.keyBenefits,
        } as Record<string, unknown>,
      },
    ]),
  );

  // Lượt canh thứ hai cho đường dẫn của trang so sánh. `generateStaticParams`
  // bắt được thẻ đã có lúc build, nhưng thẻ publish sau đó thì webhook chỉ
  // revalidate chứ không chạy lại hàm đó — và trang chi tiết của nó sẽ bị
  // trang so sánh che mất trong im lặng, trong khi danh sách, ô tìm kiếm và
  // sitemap vẫn trỏ tới đúng đường dẫn đó. Job này đọc bản published hai lượt
  // mỗi ngày, nên nó thấy; và vì điều kiện còn nguyên ở mọi lượt sau, `--retry`
  // của workflow không rửa nó thành xanh.
  const updated: Change[] = [];
  const unchanged: string[] = [];
  const errors: { slug: string; message: string }[] = [];
  let checked = 0;

  if (published.has(RESERVED_SLUG)) {
    errors.push({ slug: RESERVED_SLUG, message: slugClashMessage() });
  }

  const checkedSlugs = new Set<string>();
  for (const entry of entries) {
    const slug = field<string>(entry, "slug") ?? entry.sys.id;

    // Thẻ chưa publish bao giờ thì không nằm trên site, không có gì để giữ cho
    // khớp — và `updateEntry` cũng cố ý không publish giúp nó.
    const liveCard = published.get(slug);
    if (!liveCard) continue;

    const rebateUrl = finlyWealthRebateUrl(liveCard.applyUrl);
    // Cards linked to a non-rebate FinlyWealth page, or straight to an issuer's
    // own referral, have no rebate to keep in sync.
    if (!rebateUrl) continue;

    checked += 1;
    checkedSlugs.add(slug);
    try {
      const current = await fetchFinlyWealthRebate(rebateUrl);
      const live = liveCard.rebate;

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

      // Sửa luôn con số viết tay trong phần chữ, TRONG CÙNG một lần ghi.
      //
      // Không tách thành lượt ghi thứ hai: `updateEntry` publish cả entry, nên
      // hai lần ghi là hai lần publish, và nếu lần thứ hai hỏng thì site nằm
      // lại ở đúng trạng thái mà chỗ này sinh ra để chặn — badge một số, câu
      // HOT TIP một số khác. Gộp lại thì hai con số không bao giờ rời nhau.
      const prose = rebateProsePatch(entry.fields, LOCALE, current);
      await updateEntry(client, entry, CONTENT_TYPE, { ...prose, rebateVi: current });
      updated.push({ slug, from: live, to: current, prose: Object.keys(prose) });
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Thẻ trên site có link FinlyWealth nhưng vòng lặp không chạm tới: draft đã
  // đổi `slug` nên không join được với bản published. Không báo thì rebate của
  // thẻ đó ngừng được canh mà chẳng ai hay. Đối chiếu với bản published nên
  // lỗi còn nguyên ở mọi lượt sau, `--retry` không rửa thành xanh.
  for (const [slug, liveCard] of published) {
    const onRebatePage = Boolean(finlyWealthRebateUrl(liveCard.applyUrl));

    // Thẻ ĐANG HIỆN một con số rebate nhưng link apply không còn trỏ tới trang
    // rebate nào — đổi sang link thẳng ngân hàng, hoặc sang một trang
    // FinlyWealth không thuộc `/rebates/`.
    //
    // Trước 01/09/2026 trạng thái này rơi vào đúng hai khe hở cùng lúc: vòng
    // lặp chính `continue` ngay khi `finlyWealthRebateUrl` trả `null`, và vòng
    // đối chiếu này cũng bỏ qua vì cùng điều kiện. Không chỗ nào kiểm, job trả
    // 200, còn trang thẻ thì vẫn in "+$200 REBATE" cho một con đường không còn
    // trả đồng nào. Đó là tiền hứa với người đọc, đúng thứ cả route này sinh ra
    // để canh.
    //
    // BÁO chứ không tự gỡ: `updateEntry` publish CẢ entry, nên tự xoá
    // `rebateVi` là đẩy luôn phần tác giả đang viết dở lên site. Và không đoán
    // được ý định — có thể link mới là nhầm, có thể con số mới là thứ quên xoá.
    // Điều kiện này đọc từ bản ĐÃ PUBLISH nên còn nguyên ở mọi lượt sau,
    // `--retry` của workflow không rửa được thành xanh.
    if (!onRebatePage && liveCard.rebate) {
      errors.push({
        slug,
        message: `site đang hiện rebate ${liveCard.rebate} nhưng link apply không trỏ tới trang /rebates/ nào — gỡ rebateVi hoặc sửa lại link`,
      });
      continue;
    }

    if (checkedSlugs.has(slug) || !onRebatePage) continue;
    errors.push({
      slug,
      message:
        "thẻ trên site dùng link FinlyWealth nhưng không có entry nào khớp slug để kiểm — nhiều khả năng slug bị đổi trong bản nháp",
    });
  }

  // Lượt canh cuối: con số rebate viết tay trong phần chữ có khớp badge không.
  //
  // Nhánh tự sửa ở trên chỉ chạy khi FinlyWealth ĐỔI SỐ. Một thẻ giữ nguyên
  // $50 suốt nửa năm mà có người gõ nhầm "$125 rebate" vào editor's take thì
  // không lượt nào chạm tới — đúng chuyện đã xảy ra với Scotiabank® Scene+™
  // Visa for Students, phát hiện ngày 01/09/2026 bằng cách rà tay.
  //
  // BÁO chứ không tự sửa, cùng lý do với hai nhánh trên: `updateEntry` publish
  // cả entry. Ở đây còn thêm một lẽ nữa — khi hai con số đá nhau mà FinlyWealth
  // không đổi gì, không suy ra được cái nào mới là cái đúng: có thể badge cũ,
  // có thể câu chữ gõ nhầm. Đoán hộ là ghi đè lên chữ của tác giả.
  //
  // Bỏ qua thẻ vừa được sửa ở vòng trên: `published` là ảnh chụp TRƯỚC lần ghi
  // đó, nên đọc nó sẽ báo lại đúng cái vừa vá xong.
  for (const [slug, liveCard] of published) {
    if (!liveCard.rebate) continue;
    if (updated.some((change) => change.slug === slug)) continue;

    for (const { field: name, found } of rebateProseMismatches(liveCard.prose, liveCard.rebate)) {
      errors.push({
        slug,
        message: `badge hiện ${liveCard.rebate} nhưng ${name} viết "${found} rebate" — sửa cho khớp`,
      });
    }
  }

  // Gom lỗi vào body rồi vẫn trả 200 nghĩa là `curl -sfS` trong workflow thấy
  // xanh: FinlyWealth đổi markup hay timeout thì con số rebate cũ nằm lại trên
  // site vô thời hạn, không ai được báo. Gọi lại an toàn — route đối chiếu với
  // Contentful trước khi ghi, và workflow đã có sẵn `--retry 3`.
  const status = errors.length > 0 ? 500 : 200;
  return NextResponse.json({ checked, updated, unchanged, errors }, { status });
}
