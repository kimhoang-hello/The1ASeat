import { NextRequest, NextResponse } from "next/server";
import { cmaClient, field, listEntries, updateEntry, type CmaEntry, type CmaClient } from "@/lib/contentful-cma";
import { fetchFinlyWealthOffer, finlyWealthRebateUrl } from "@/lib/finlywealth";
import { isRewriteConfigured, rewriteOfferCopy } from "@/lib/rewrite-offer";
import { jobSecretValid } from "@/lib/job-auth";

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
  const nowIso = new Date().toISOString();
  const expiredQuery = `&fields.expiresAt[lte]=${encodeURIComponent(nowIso)}`;

  const movedToOther: string[] = [];
  const bonusRewritten: string[] = [];
  const needsReview: { slug: string; reason: string }[] = [];
  const unpublished: string[] = [];
  const errors: { slug: string; message: string }[] = [];

  const cards = await listEntries(client, CARD_TYPE, expiredQuery);
  for (const card of cards) {
    const slug = field<string>(card, "slug") ?? card.sys.id;
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
    bonusRewritten,
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
