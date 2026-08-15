import { NextRequest, NextResponse } from "next/server";
import { cmaClient, field, listEntries, updateEntry } from "@/lib/contentful-cma";
import { fetchFinlyWealthRebate, finlyWealthRebateUrl } from "@/lib/finlywealth";

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
  const entries = await listEntries(client, CONTENT_TYPE);

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

    checked += 1;
    try {
      const current = await fetchFinlyWealthRebate(rebateUrl);
      const stored = field<string>(entry, "rebateVi") ?? null;

      if (stored === current) {
        unchanged.push(slug);
        continue;
      }

      await updateEntry(client, entry, CONTENT_TYPE, { rebateVi: current });
      updated.push({ slug, from: stored, to: current });
    } catch (err) {
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ checked, updated, unchanged, errors });
}
