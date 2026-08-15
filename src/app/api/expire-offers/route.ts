import { NextRequest, NextResponse } from "next/server";
import { cmaClient, field, listEntries, updateEntry, type CmaEntry, type CmaClient } from "@/lib/contentful-cma";
import { fetchFinlyWealthRebate, finlyWealthRebateUrl } from "@/lib/finlywealth";

// Called on a schedule (see .github/workflows/expire-offers.yml) to deal with
// entries whose expiresAt has passed.
//
// A transferBonus that has run out is simply over, so it gets unpublished
// (never deleted) and can be republished if the bonus returns.
//
// A credit card is different: the card still exists once its elevated offer
// ends, it just goes back to the issuer's standing offer. So instead of
// pulling the card off the site, this clears the elevated flag and the expiry
// date, which moves the card into the "Các offers khác" tab, and refreshes the
// FinlyWealth rebate while it is there. The Vietnamese copy — headline, key
// benefits, editor's take — still quotes the old welcome bonus and no job can
// rewrite that responsibly, so every moved card is returned in `needsReview`.

const CARD_TYPE = "creditCardOffer";
const BONUS_TYPE = "transferBonus";

export async function POST(request: NextRequest) {
  return handleExpire(request);
}

export async function GET(request: NextRequest) {
  return handleExpire(request);
}

async function handleExpire(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.EXPIRE_OFFERS_SECRET || secret !== process.env.EXPIRE_OFFERS_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) {
    return NextResponse.json({ message: "not_configured" }, { status: 501 });
  }

  const client = cmaClient(spaceId, managementToken);
  const nowIso = new Date().toISOString();
  const expiredQuery = `&fields.expiresAt[lte]=${encodeURIComponent(nowIso)}`;

  const movedToOther: string[] = [];
  const needsReview: string[] = [];
  const unpublished: string[] = [];
  const errors: { slug: string; message: string }[] = [];

  const cards = await listEntries(client, CARD_TYPE, expiredQuery);
  for (const card of cards) {
    const slug = field<string>(card, "slug") ?? card.sys.id;
    try {
      const wasElevated = field<boolean>(card, "elevatedBonus") === true;
      const changes: Record<string, unknown> = { elevatedBonus: false, expiresAt: undefined };

      const rebateUrl = finlyWealthRebateUrl(field<string>(card, "applyUrl") ?? "");
      if (rebateUrl) {
        // Best effort: a card should still move out of the elevated tab even
        // if FinlyWealth is unreachable this morning.
        try {
          changes.rebateVi = await fetchFinlyWealthRebate(rebateUrl);
        } catch {
          /* leave the stored rebate for the daily rebate check to correct */
        }
      }

      await updateEntry(client, card, CARD_TYPE, changes);
      movedToOther.push(slug);
      if (wasElevated) needsReview.push(slug);
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const bonuses = await listEntries(client, BONUS_TYPE, expiredQuery);
  for (const bonus of bonuses) {
    const slug = field<string>(bonus, "slug") ?? bonus.sys.id;
    if (!bonus.sys.publishedVersion) continue;
    try {
      await unpublish(client, bonus);
      unpublished.push(slug);
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    checked: cards.length + bonuses.length,
    movedToOther,
    needsReview,
    unpublished,
    errors,
  });
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
