import { NextRequest, NextResponse } from "next/server";
import { cmaClient, field, listEntries, updateEntry, type CmaEntry, type CmaClient } from "@/lib/contentful-cma";
import { fetchFinlyWealthOffer, finlyWealthRebateUrl } from "@/lib/finlywealth";
import { isRewriteConfigured, rewriteOfferCopy } from "@/lib/rewrite-offer";
import { jobSecretValid } from "@/lib/job-auth";
import { hasExpired } from "@/lib/format-date";
import { fetchContentfulCreditCardOffers } from "@/lib/content/contentful";

// Called on a schedule (see .github/workflows/expire-offers.yml) to deal with
// entries whose expiresAt has passed.
//
// A transferBonus that has run out is simply over, so it gets unpublished
// (never deleted) and can be republished if the bonus returns.
//
// A credit card is different: the card still exists once its elevated offer
// ends, it just goes back to the issuer's standing offer. So instead of pulling
// the card off the site, this clears the elevated flag and the expiry date —
// moving the card into the "Các offers khác" tab — and brings its content up to
// date with the offer that is actually running: the rebate and the welcome
// bonus both come from the card's FinlyWealth page, with the Vietnamese copy
// rewritten from those figures (see lib/rewrite-offer.ts).
//
// Every step after the flag is best effort. A card whose bonus could not be
// rewritten still moves tabs and is returned in `needsReview` with the reason,
// because a card sitting in the wrong tab is worse than one with stale copy.

const CARD_TYPE = "creditCardOffer";
const BONUS_TYPE = "transferBonus";

export async function POST(request: NextRequest) {
  return handleExpire(request);
}

export async function GET(request: NextRequest) {
  return handleExpire(request);
}

async function handleExpire(request: NextRequest) {
  if (!jobSecretValid(request, process.env.EXPIRE_OFFERS_SECRET)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const client = cmaClient(spaceId, managementToken);

  // Truy vấn thô lấy dư một chút; `hasExpired` mới là chỗ quyết định. Riêng
  // `[lte]=now` là không đủ đúng: 14/15 entry lưu mốc `00:00` đầu ngày, nên
  // ngay 00:00 của chính cái ngày mà trang bảo "còn hạn", entry đã lọt vào
  // truy vấn và bị gỡ — người đọc mất trọn ngày cuối họ được hứa. `hasExpired`
  // so theo NGÀY (giờ Toronto), nên cả mốc `00:00` lẫn `23:59` đều sống đúng
  // hết ngày ghi trên màn hình.
  const nowIso = new Date().toISOString();
  const expiredQuery = `&fields.expiresAt[lte]=${encodeURIComponent(nowIso)}`;

  // Truy vấn trên chỉ nhìn thấy DRAFT. `updateEntry` ghi draft xong mới publish,
  // nên một lần publish hỏng để lại draft đã gỡ `expiresAt` trong khi site vẫn
  // phục vụ offer hết hạn — và vì draft không còn khớp `expiresAt[lte]`, mọi
  // lượt sau bỏ qua nó vĩnh viễn. Trả 500 không cứu được: `--retry` trong
  // workflow chỉ cần chạy lại một lượt là lượt đó trả 200 và job xanh trong khi
  // offer hết hạn vẫn nằm trên site. Nên mốc quyết định phải là bản ĐÃ PUBLISH,
  // thứ người đọc thật sự nhìn thấy — cùng cách check-rebates đã phải sửa.
  const liveExpiredSlugs = new Set(
    (await fetchContentfulCreditCardOffers())
      .filter((offer) => offer.expiresAt && hasExpired(offer.expiresAt))
      .map((offer) => offer.slug),
  );

  const movedToOther: string[] = [];
  const bonusRewritten: string[] = [];
  const needsReview: { slug: string; reason: string }[] = [];
  const unpublished: string[] = [];
  const errors: { slug: string; message: string }[] = [];

  const cards = await listEntries(client, CARD_TYPE, expiredQuery);
  const consideredSlugs = new Set<string>();
  for (const card of cards) {
    const slug = field<string>(card, "slug") ?? card.sys.id;
    const expiresAt = field<string>(card, "expiresAt");
    if (expiresAt && !hasExpired(expiresAt)) continue;
    // Đánh dấu SAU khi qua `hasExpired`, không phải lúc lấy ra khỏi truy vấn.
    // Truy vấn so mốc thời gian còn `hasExpired` so theo ngày Toronto, nên một
    // draft gia hạn tới `00:00` hôm nay vẫn lọt vào truy vấn rồi bị bỏ qua ở
    // dòng trên. Đánh dấu sớm thì thẻ đó coi như đã xử lý và phần đối chiếu
    // bên dưới im lặng, trong khi bản published vẫn treo offer hết hạn.
    consideredSlugs.add(slug);

    try {
      const changes: Record<string, unknown> = { elevatedBonus: false, expiresAt: undefined };
      let rewrote = false;
      let reason = "";

      const rebateUrl = finlyWealthRebateUrl(field<string>(card, "applyUrl") ?? "");
      if (!rebateUrl) {
        reason = "no FinlyWealth page to read the new offer from";
      } else if (!isRewriteConfigured) {
        reason = "ANTHROPIC_API_KEY is not set";
      } else {
        // Best effort throughout: a card must still leave the elevated tab even
        // if FinlyWealth is unreachable or the rewrite fails this morning.
        try {
          const offer = await fetchFinlyWealthOffer(rebateUrl);
          changes.rebateVi = offer.rebate;

          const copy = await rewriteOfferCopy({
            name: field<string>(card, "name") ?? slug,
            issuer: field<string>(card, "issuer") ?? "",
            annualFee: field<string>(card, "annualFeeVi") ?? "",
            rebate: offer.rebate,
            offerDetails: offer.details,
            current: {
              headlineVi: field<string>(card, "headlineVi") ?? "",
              keyBenefitsVi: field<string[]>(card, "keyBenefitsVi") ?? [],
              editorsTakeVi: field<string>(card, "editorsTakeVi") ?? "",
            },
          });

          Object.assign(changes, copy);
          rewrote = true;
        } catch (err) {
          reason = `rewrite failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      await updateEntry(client, card, CARD_TYPE, changes);
      movedToOther.push(slug);
      if (rewrote) bonusRewritten.push(slug);
      else needsReview.push({ slug, reason });
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Thẻ mà bản published vẫn treo hạn đã qua, nhưng draft không còn `expiresAt`
  // nên không lọt vào truy vấn ở trên. Hai nguyên nhân cho cùng một hình dạng:
  // một lượt publish hỏng ở lần chạy trước, hoặc tác giả đang sửa dở và đã gỡ
  // hạn trong bản nháp. Không phân biệt được hai cái, mà `updateEntry` publish
  // CẢ entry — tự sửa ở đây là đẩy bản nháp người khác đang viết lên site. Nên
  // chỉ báo. Vì mốc so là bản published, lỗi này còn nguyên ở mọi lượt sau cho
  // tới khi có người xử lý: `--retry` của workflow không rửa nó thành xanh được.
  for (const slug of liveExpiredSlugs) {
    if (consideredSlugs.has(slug)) continue;
    errors.push({
      slug,
      message:
        "site vẫn phục vụ offer đã hết hạn nhưng draft không còn expiresAt — job không tự publish, kiểm rồi publish tay trong Contentful",
    });
  }

  const bonuses = await listEntries(client, BONUS_TYPE, expiredQuery);
  for (const bonus of bonuses) {
    const slug = field<string>(bonus, "slug") ?? bonus.sys.id;
    if (!bonus.sys.publishedVersion) continue;

    const bonusExpiresAt = field<string>(bonus, "expiresAt");
    if (bonusExpiresAt && !hasExpired(bonusExpiresAt)) continue;

    try {
      await unpublish(client, bonus);
      unpublished.push(slug);
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Như check-rebates: workflow chỉ đọc HTTP status, nên một offer hết hạn gỡ
  // không thành công phải làm job đỏ. Trả 200 kèm errors[] là để offer đã hết
  // hạn nằm lại trên site mà không ai biết.
  const status = errors.length > 0 ? 500 : 200;
  if (errors.length > 0) console.error("[expire-offers] lỗi:", errors);
  return NextResponse.json(
    {
      checked: cards.length + bonuses.length,
      movedToOther,
      bonusRewritten,
      needsReview,
      unpublished,
      errors,
    },
    { status },
  );
}

async function unpublish(client: CmaClient, entry: CmaEntry): Promise<void> {
  const res = await fetch(`${client.base}/entries/${entry.sys.id}/published`, {
    method: "DELETE",
    headers: client.headers,
  });
  // Already unpublished by an earlier run — not an error.
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
