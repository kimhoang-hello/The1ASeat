// Data-integrity check for the Award Flight Finder. Run after editing
// award-charts.ts or the awardCharts strings:  npm run audit:awards
//
// It sweeps every origin x destination x cabin combination and asserts the
// things that are easy to break by hand: message keys that exist, logo files
// that exist on disk, airports and carriers that resolve, distance bands that
// increase and end at Infinity, routings that start and end where they should
// without repeating an airport, and a headline price that matches its own
// best option. Exits non-zero on any failure.
//
// Add --links to also check that each programme's sourceUrl still resolves.
// That one needs the network, so it is off by default:  npm run audit:awards -- --links

import fs from "node:fs";
import path from "node:path";
import { PROGRAMS, ORIGINS, DESTINATIONS, CABINS, quoteRoute } from "../src/lib/award-charts.ts";
import { TRANSFER_PARTNERS } from "../src/lib/transfer-partners.ts";
import { VIETNAM_ROUTES, assertNoPointsInProse } from "../src/lib/award-routes.ts";

const ROOT = process.cwd();
const msgs = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/vi.json"), "utf8"));
const ns = msgs.awardCharts as Record<string, string>;
const src = fs.readFileSync(path.join(ROOT, "src/components/award-charts/award-chart-finder.tsx"), "utf8");
const fails: string[] = [];

// 1. every literal t("key") in the component exists
const literal = [...src.matchAll(/\bt\(\s*"([a-zA-Z0-9_]+)"/g)].map((m) => m[1]);
for (const k of new Set(literal)) if (!(k in ns)) fails.push(`missing message key: ${k}`);

// 2. template keys howStepNTitle/Body
for (const n of [1, 2, 3, 4]) for (const s of ["Title", "Body"])
  if (!(`howStep${n}${s}` in ns)) fails.push(`missing message key: howStep${n}${s}`);

// 3. keys referenced from the data module
for (const p of PROGRAMS) {
  if (!(p.noteKey in ns)) fails.push(`${p.id}: missing noteKey ${p.noteKey}`);
  if (p.transferNoteKey && !(p.transferNoteKey in ns)) fails.push(`${p.id}: missing transferNoteKey`);
  if (p.pricing.kind === "unquotable") {
    if (!(p.pricing.labelKey in ns)) fails.push(`${p.id}: missing labelKey ${p.pricing.labelKey}`);
    if (!(p.pricing.hintKey in ns)) fails.push(`${p.id}: missing hintKey ${p.pricing.hintKey}`);
  }
}
for (const c of CABINS) if (!(c.labelKey in ns)) fails.push(`missing cabin key ${c.labelKey}`);
for (const p2 of PROGRAMS) for (const o of p2.overrides ?? [])
  if (o.noteKey && !(o.noteKey in ns)) fails.push(`${p2.id}: missing override noteKey ${o.noteKey}`);

// 3b. an override flagged `highlight` is claiming the published chart is wrong,
// so it has to carry the corrected `rates` too. Without them the note tells the
// reader one number while the price beside it still shows the chart's — which
// is exactly what YYZ-TPE did: "chỉ 50,000 điểm" printed above a 65,000 quote.
for (const p2 of PROGRAMS) for (const o of p2.overrides ?? [])
  if (o.tone === "highlight" && Object.keys(o.rates ?? {}).length === 0)
    fails.push(`${p2.id}: override ${o.origins.join("/")}->${o.destinations.join("/")} is tone:"highlight" but has no rates, so the note contradicts the price shown`);

// 4. unused message keys
const used = new Set([...literal, ...PROGRAMS.map(p => p.noteKey), ...PROGRAMS.flatMap(p => p.transferNoteKey ? [p.transferNoteKey] : []),
  ...PROGRAMS.flatMap(p => p.pricing.kind === "unquotable" ? [p.pricing.labelKey, p.pricing.hintKey] : []),
  ...CABINS.map(c => c.labelKey), ...[1,2,3,4].flatMap(n => [`howStep${n}Title`, `howStep${n}Body`]),
  "eyebrow","title","subtitle","noRouting","noRoutingShort","feederNote","feederOnlyShort","optionDynamic","medianLabel",
  ...PROGRAMS.flatMap(p2 => (p2.overrides ?? []).flatMap(o => o.noteKey ? [o.noteKey] : [])),
  ...[...src.matchAll(/"(confidence[A-Z]\w+|surcharge[A-Z]\w+|transferNone)"/g)].map(m => m[1])]);
const unused = Object.keys(ns).filter(k => !used.has(k));
if (unused.length) fails.push(`unused message keys: ${unused.join(", ")}`);

// 4b. a programme's transferPartnerKey must still match a row in
// transfer-partners.ts. Renaming a programme there would otherwise make the
// card's transfer ratios vanish with nothing failing.
for (const p2 of PROGRAMS) {
  if (p2.transferPartnerKey === null) continue;
  if (!TRANSFER_PARTNERS.some(r => r.program === p2.transferPartnerKey))
    fails.push(`${p2.id}: transferPartnerKey "${p2.transferPartnerKey}" matches no TRANSFER_PARTNERS row`);
}

// 5. every logo referenced exists on disk
const logos = new Set<string>();
for (const p of PROGRAMS) logos.add(p.logo);
for (const o of ORIGINS) for (const d of DESTINATIONS) for (const c of CABINS)
  for (const q of quoteRoute(o, d, c.id)) for (const opt of q.options) for (const c2 of opt.carriers) logos.add(c2.logo);
for (const l of logos) if (!fs.existsSync(path.join(ROOT, "public", l))) fails.push(`missing logo file: ${l}`);

// 6. airports/carriers all resolve, bands sane
for (const a of [...ORIGINS, ...DESTINATIONS]) if (!a?.code) fails.push(`undefined airport in ORIGINS/DESTINATIONS`);
for (const p of PROGRAMS) {
  if (p.pricing.kind === "distance-total") {
    let prev = 0;
    for (const b of p.pricing.bands) {
      if (b.upTo <= prev) fails.push(`${p.id}: band edges not increasing at ${b.upTo}`);
      prev = b.upTo;
    }
    if (p.pricing.bands.at(-1)!.upTo !== Infinity) fails.push(`${p.id}: last band must be Infinity`);
  }
}

// 7. exhaustive quote sweep — no crashes, no undefined carriers, sane values
let quotes = 0, unpriced = 0;
for (const o of ORIGINS) for (const d of DESTINATIONS) for (const c of CABINS) {
  const qs = quoteRoute(o, d, c.id);
  if (qs.length !== PROGRAMS.length) fails.push(`${o.code}->${d.code}/${c.id}: wrong quote count`);
  for (const q of qs) {
    quotes++;
    if (q.points === null) unpriced++;
    if (q.points !== null && (q.points < 1000 || q.points > 400000)) fails.push(`${o.code}->${d.code}/${c.id} ${q.program.id}: implausible ${q.points}`);
    for (const opt of q.options) {
      if (!opt.carriers?.length || opt.carriers.some(c2 => !c2?.name)) fails.push(`${o.code}->${d.code} ${q.program.id}: bad carriers`);
      if (opt.needsFeeder && !ORIGINS.some(g => g.code === opt.routing[1])) fails.push(`${q.program.id}: feeder second stop is not a Canadian gateway: ${opt.routing.join("-")}`);
      if (opt.carriers.length > 3) fails.push(`${q.program.id}: too many carriers`);
      if (opt.routing.includes(o.code) === false) fails.push(`${q.program.id}: routing missing origin`);
      if (opt.routing.at(-1) !== d.code) fails.push(`${q.program.id}: routing missing destination`);
      if (new Set(opt.routing).size !== opt.routing.length) fails.push(`${q.program.id}: repeated airport in ${opt.routing.join("-")}`);
      if (opt.miles < 100) fails.push(`${q.program.id}: implausible distance ${opt.miles}`);
      if (opt.needsFeeder && !q.program.pricesWithFeeder && opt.points !== null)
        fails.push(`${q.program.id}: priced a feeder itinerary`);
      if (opt.dynamicPrice && opt.points !== null)
        fails.push(`${q.program.id}: priced a dynamically-priced itinerary`);
      if (!opt.dynamicPrice && (opt.dynamicFrom !== undefined || opt.dynamicMedian !== undefined))
        fails.push(`${q.program.id}: dynamic guidance on a chart-priced option`);
      if (opt.dynamicFrom !== undefined && opt.dynamicMedian !== undefined && opt.dynamicMedian < opt.dynamicFrom)
        fails.push(`${q.program.id}: median below the floor (${opt.dynamicFrom}/${opt.dynamicMedian})`);
      const dyn = q.program.dynamicCarriers ?? [];
      if (dyn.length && opt.carriers.every(c2 => dyn.includes(c2.code)) && !opt.dynamicPrice)
        fails.push(`${q.program.id}: all-dynamic itinerary not flagged: ${opt.routing.join("-")}`);
    }
    // Every option needs a key the UI can tell apart, or React reuses rows
    // across searches and a stale routing survives a destination change.
    const keys = q.options.map(o2 => `${o2.routing.join("-")}-${o2.carriers.map(c2=>c2.code).join("")}${o2.dynamicPrice?"-dyn":""}`);
    if (new Set(keys).size !== keys.length)
      fails.push(`${o.code}->${d.code} ${q.program.id}: duplicate option keys`);

    const best = q.options.filter(o2 => o2.isBest);
    if (best.length > 1) fails.push(`${q.program.id}: ${best.length} best options`);
    if (best.length === 1 && best[0].points !== q.points) fails.push(`${q.program.id}: headline != best option`);
    // A crowned option must be strictly cheaper than every other priced one.
    if (best.length === 1) {
      const rivals = q.options.filter(o2 => o2 !== best[0] && o2.points !== null);
      if (rivals.some(o2 => o2.points! <= best[0].points!))
        fails.push(`${q.program.id}: crowned a tied option`);
    }
  }
}

// 9b. the twelve /bay-ve-viet-nam pages: their hand-written prose must not
// carry a points figure. Those pages print a table computed by quoteRoute() at
// render time, so a number typed into the prose beside it goes stale silently
// the day a programme devalues — the same failure that made audit:rebate-prose
// necessary on the bank side. `generateStaticParams` asserts this too, so a bad
// paragraph also reddens the build; running it here means `npm run audit:awards`
// catches it without a full build.
try {
  assertNoPointsInProse();
} catch (err) {
  fails.push(err instanceof Error ? err.message : String(err));
}

// Every message key those pages reach for, same check as the finder above.
const routeNs = msgs.awardRoutes as Record<string, string>;
const routeSrc = [
  "src/app/bay-ve-viet-nam/page.tsx",
  "src/app/bay-ve-viet-nam/[route]/page.tsx",
  "src/components/award-charts/route-award-table.tsx",
]
  .map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"))
  .join("\n");
for (const key of new Set([...routeSrc.matchAll(/\br\(\s*"([a-zA-Z0-9_]+)"/g)].map((m) => m[1])))
  if (!(key in routeNs)) fails.push(`missing awardRoutes key: ${key}`);

// Slug đôi một khác nhau: hai chặng trùng slug thì một trang biến mất khỏi
// site mà build vẫn xanh — `generateStaticParams` chỉ sinh trùng, không đỏ.
const slugs = VIETNAM_ROUTES.map((r) => r.slug);
for (const slug of new Set(slugs))
  if (slugs.filter((s2) => s2 === slug).length > 1) fails.push(`duplicate route slug: ${slug}`);
console.log(`checked ${VIETNAM_ROUTES.length} Vietnam route pages`);

console.log(`swept ${quotes} quotes across ${ORIGINS.length}x${DESTINATIONS.length}x${CABINS.length} combos (${unpriced} unpriced)`);

// 10. every sourceUrl still resolves — only with --links, because it is the one
// check that needs the network and the rest of this file is meant to run in a
// second. Airlines move these pages without redirecting: on 23/08/2026 four of
// the six were 404s (Aeroplan, AAdvantage, Qatar and Flying Blue had all moved),
// and nothing here noticed, so every reader clicking "nguồn" landed on an error
// page. A 403 is not a failure — aa.com and bmo.com block scripted requests
// while serving the page fine to a browser; only a 404/410 means the page is
// really gone.
if (process.argv.includes("--links")) {
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
  for (const p of PROGRAMS) {
    try {
      const res = await fetch(p.sourceUrl, { redirect: "follow", headers: { "User-Agent": UA } });
      if (res.status === 404 || res.status === 410) fails.push(`${p.id}: sourceUrl is gone (${res.status}) ${p.sourceUrl}`);
      else if (!res.ok) console.log(`  (${p.id}: ${res.status} — likely bot-blocking, check by hand: ${p.sourceUrl})`);
    } catch (err) {
      console.log(`  (${p.id}: could not be reached — ${err instanceof Error ? err.message : String(err)})`);
    }
  }
  console.log(`checked ${PROGRAMS.length} source links`);
}
if (fails.length) {
  console.error("FAILURES:\n - " + [...new Set(fails)].join("\n - "));
  process.exit(1);
}
console.log("ALL CHECKS PASSED");
