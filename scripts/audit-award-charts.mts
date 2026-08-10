// Data-integrity check for the Award Flight Finder. Run after editing
// award-charts.ts or the awardCharts strings:  npm run audit:awards
//
// It sweeps every origin x destination x cabin combination and asserts the
// things that are easy to break by hand: message keys that exist, logo files
// that exist on disk, airports and carriers that resolve, distance bands that
// increase and end at Infinity, routings that start and end where they should
// without repeating an airport, and a headline price that matches its own
// best option. Exits non-zero on any failure.

import fs from "node:fs";
import path from "node:path";
import { PROGRAMS, ORIGINS, DESTINATIONS, CABINS, quoteRoute } from "../src/lib/award-charts.ts";

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

// 4. unused message keys
const used = new Set([...literal, ...PROGRAMS.map(p => p.noteKey), ...PROGRAMS.flatMap(p => p.transferNoteKey ? [p.transferNoteKey] : []),
  ...PROGRAMS.flatMap(p => p.pricing.kind === "unquotable" ? [p.pricing.labelKey, p.pricing.hintKey] : []),
  ...CABINS.map(c => c.labelKey), ...[1,2,3,4].flatMap(n => [`howStep${n}Title`, `howStep${n}Body`]),
  "eyebrow","title","subtitle","noRouting","noRoutingShort","feederNote","optionDynamic","medianLabel",
  ...PROGRAMS.flatMap(p2 => (p2.overrides ?? []).flatMap(o => o.noteKey ? [o.noteKey] : [])),
  ...[...src.matchAll(/"(confidence[A-Z]\w+|surcharge[A-Z]\w+|transferNone)"/g)].map(m => m[1])]);
const unused = Object.keys(ns).filter(k => !used.has(k));
if (unused.length) fails.push(`unused message keys: ${unused.join(", ")}`);

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
    const best = q.options.filter(o2 => o2.isBest);
    if (q.points !== null && best.length !== 1) fails.push(`${q.program.id}: ${best.length} best options`);
    if (q.points !== null && best[0]?.points !== q.points) fails.push(`${q.program.id}: headline != best option`);
  }
}

console.log(`swept ${quotes} quotes across ${ORIGINS.length}x${DESTINATIONS.length}x${CABINS.length} combos (${unpriced} unpriced)`);
if (fails.length) {
  console.error("FAILURES:\n - " + [...new Set(fails)].join("\n - "));
  process.exit(1);
}
console.log("ALL CHECKS PASSED");
