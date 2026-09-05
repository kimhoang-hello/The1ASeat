import { NextRequest, NextResponse } from "next/server";
import { cmaClient, cmaInit, field, listEntries, updateEntry, type CmaEntry, type CmaClient } from "@/lib/contentful-cma";
import { fetchFinlyWealthOffer, finlyWealthRebateUrl } from "@/lib/finlywealth";
import { isRewriteConfigured, rewriteOfferCopy } from "@/lib/rewrite-offer";
import { jobAuthResponse } from "@/lib/job-auth";
import { hasExpired } from "@/lib/format-date";
import {
  fetchContentfulCreditCardOffers,
  fetchContentfulTransferBonuses,
} from "@/lib/content/contentful";

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

// POST only. Một job ghi vào Contentful không nên chạy được bằng cách dán URL
// vào thanh địa chỉ: GET là thứ prefetch của browser, trình quét link và bot
// tự bấm vào.
export async function POST(request: NextRequest) {
  return handleExpire(request);
}

async function handleExpire(request: NextRequest) {
  const denied = jobAuthResponse(request, process.env.EXPIRE_OFFERS_SECRET, "EXPIRE_OFFERS_SECRET");
  if (denied) return denied;

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

    // Entry CHƯA TỪNG publish không phải offer đang chạy trên site — nó không
    // nằm trong `liveExpiredSlugs` (đọc qua CDA) nên không ai cần gỡ gì cả.
    // `updateEntry` tự nó không publish một entry chưa từng publish (xem
    // `contentful-cma.ts`), nhưng vẫn PUT đè `fields`, tức vẫn ghi lên bản
    // nháp tác giả đang viết. Vòng bonus bên dưới đã có đúng cửa này
    // (`if (!bonus.sys.publishedVersion) continue;`); vòng thẻ thiếu nó là kẽ
    // hở duy nhất trong file này còn động vào một entry chưa từng lên site.
    if (!card.sys.publishedVersion) continue;

    // Cùng cửa chặn mà `check-rebates` đã có, vì cùng một `updateEntry`:
    // nó PUT lại toàn bộ `fields` của bản draft rồi publish CẢ ENTRY. Thẻ
    // đang có thay đổi chưa publish nghĩa là tác giả viết dở ở đâu đó trong
    // entry — ghi hai trường của job vào đấy là đẩy luôn phần viết dở lên
    // site. Báo để người xử lý. Lỗi này tự nhận ra được ở mọi lượt sau: bản
    // published vẫn treo `expiresAt` đã qua nên điều kiện còn nguyên, `--retry`
    // của workflow không rửa nó thành xanh.
    if (card.sys.version > card.sys.publishedVersion + 1) {
      errors.push({
        slug,
        message:
          "offer đã hết hạn nhưng entry có thay đổi chưa publish — job không tự ghi (updateEntry publish cả entry), xử lý tay trong Contentful",
      });
      continue;
    }

    try {
      const changes: Record<string, unknown> = { elevatedBonus: false, expiresAt: undefined };
      let rewrote = false;
      let reason = "";
      // Lỗi tạm thời (FinlyWealth hỏng, rewrite ném, thiếu API key) khác lỗi
      // cấu trúc (thẻ không có trang FinlyWealth nào để đọc): cái đầu lượt sau
      // chạy lại được, cái sau thì không bao giờ.
      let retryable = false;

      const rebateUrl = finlyWealthRebateUrl(field<string>(card, "applyUrl") ?? "");
      if (!rebateUrl) {
        reason = "no FinlyWealth page to read the new offer from";
      } else if (!isRewriteConfigured) {
        reason = "ANTHROPIC_API_KEY is not set";
        retryable = true;
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
          retryable = true;
        }
      }

      // GIỮ `expiresAt` khi lỗi còn chạy lại được. Xoá nó là xoá luôn thứ duy
      // nhất khiến lượt sau tìm thấy thẻ này: truy vấn CMA lọc theo
      // `expiresAt[lte]`, nên thẻ không còn hạn thì biến mất khỏi mọi lượt sau
      // và trang thẻ nằm lại với welcome offer đã chết vĩnh viễn. Trả 500 một
      // lần không cứu được — workflow gọi bằng `curl --retry`, lượt sau trả
      // 200 là job xanh. Ngày mai chạy lại vẫn thấy thẻ, vẫn đỏ, cho tới khi
      // rewrite thành công.
      //
      // `elevatedBonus: false` thì vẫn ghi ngay: thẻ nằm sai tab tệ hơn thẻ có
      // copy cũ. Người đọc không thấy cái hạn còn treo lại — `CardBadges` chỉ
      // in ngày hết hạn khi nó chưa qua.
      if (retryable) delete changes.expiresAt;

      await updateEntry(client, card, CARD_TYPE, changes);
      movedToOther.push(slug);
      if (rewrote) bonusRewritten.push(slug);
      else needsReview.push({ slug, reason });
      if (retryable) errors.push({ slug, message: `${reason} — giữ expiresAt để lượt sau thử lại` });
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

  // Cùng lý do với thẻ: `listEntries` trả DRAFT, mà gỡ một bonus khỏi site là
  // việc không hoàn tác được bằng cách chạy lại. Mốc quyết định phải là bản
  // ĐANG PHỤC VỤ — nếu không, một tác giả sửa `expiresAt` trong bản nháp (lùi
  // ngày lại để tính toán gì đó, hoặc đang gõ dở) là đủ để job gỡ mất một
  // bonus vẫn còn hạn trên site.
  const liveBonusExpiry = new Map(
    (await fetchContentfulTransferBonuses()).map((bonus) => [bonus.slug, bonus.expiresAt]),
  );

  const bonuses = await listEntries(client, BONUS_TYPE, expiredQuery);
  const consideredBonusSlugs = new Set<string>();
  for (const bonus of bonuses) {
    const slug = field<string>(bonus, "slug") ?? bonus.sys.id;
    if (!bonus.sys.publishedVersion) continue;

    const liveExpiresAt = liveBonusExpiry.get(slug);
    // Không có trong CDA: entry đã publish nhưng bản đang phục vụ không thấy —
    // slug bị đổi trong draft, hoặc CDN chưa kịp. Dừng lại, đừng gỡ mò.
    if (!liveExpiresAt) continue;
    if (!hasExpired(liveExpiresAt)) continue;

    consideredBonusSlugs.add(slug);
    try {
      await unpublish(client, bonus);
      unpublished.push(slug);
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Mặt còn lại của cùng một chuyện, giống hệt phần thẻ ở trên: bản published
  // đã hết hạn nhưng draft mang ngày khác nên không lọt vào truy vấn CMA. Site
  // vẫn treo bonus chết, và không lượt nào tự tìm ra nếu không đối chiếu ở đây.
  for (const [slug, expiresAt] of liveBonusExpiry) {
    if (consideredBonusSlugs.has(slug) || !hasExpired(expiresAt)) continue;
    errors.push({
      slug,
      message:
        "site vẫn phục vụ transfer bonus đã hết hạn nhưng draft mang expiresAt khác — kiểm rồi unpublish tay trong Contentful",
    });
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

// `X-Contentful-Version` biến DELETE này thành optimistic concurrency: giữa
// lúc `listEntries` đọc entry và lúc gỡ, tác giả có thể vừa gia hạn và publish
// lại. Không gửi version thì Contentful gỡ luôn bản mới đó; gửi rồi thì nó trả
// 409 và job đỏ — đúng thứ mình muốn thấy.
async function unpublish(client: CmaClient, entry: CmaEntry): Promise<void> {
  const res = await fetch(
    `${client.base}/entries/${entry.sys.id}/published`,
    cmaInit({
      method: "DELETE",
      headers: { ...client.headers, "X-Contentful-Version": String(entry.sys.version) },
    }),
  );
  // Already unpublished by an earlier run — not an error.
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
