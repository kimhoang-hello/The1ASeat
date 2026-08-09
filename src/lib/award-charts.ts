// Award chart data for Canada → Vietnam / Southeast Asia, covering the six
// programs a Canadian cardholder can actually reach with Amex Membership
// Rewards or RBC Avion (see transfer-partners.ts for the transfer legs).
//
// Sourcing, all verified 2026-08-09:
//  - Aeroplan: Air Canada's June 2026 flight reward chart, cross checked
//    against princeoftravel.com/news/aeroplan-flight-reward-chart-june-2026
//    and awardtravelfinder.com/award-charts/aeroplan. Both agree on every
//    band, so these numbers are solid. Air Canada's own PDF is behind an
//    Akamai block and cannot be fetched programmatically.
//  - AAdvantage: awardfares.com/blog/aadvantage-guide (updated 2026-08-06).
//    Partner chart only — AA-operated metal is dynamically priced.
//  - British Airways / Qatar Avios: awardtravelfinder.com/award-charts/
//    british-airways. NEITHER airline publishes an official chart any more,
//    so this is a community reconstruction of observed partner pricing.
//    Premium Economy is absent from every source found, hence the gaps.
//    Qatar Privilege Club prices partner awards at the same rates as The
//    British Airways Club, which is why the two share a band table.
//  - Asia Miles: a real fixed chart that Cathay deliberately does not publish.
//    Its official "Flight awards charts" page carries only the upgrade,
//    companion and partner charts. Rates below are the 1 May 2026 revision
//    from suitesmile.com/blog/2026/05/02/cathay-pacific-asia-miles-award-charts,
//    cross checked against mainlymiles.com/2026/04/11/cathay-pacific-adjusts-
//    asia-miles-award-rates-from-may-2026 — the two agree on every Economy,
//    Business and First rate and differ by 1–3k on Premium Economy, where the
//    later suitesmile figures are used. Do NOT trust awardtravelfinder for
//    Cathay: it still serves the pre-May-2026 chart (119,000 business on the
//    longest band, not 115,000).
//  - Flying Blue: fully dynamic, no chart at any price point. Confirmed by
//    awardfares.com/blog/flying-blue-guide (updated 2026-04-09).
//
// When a program changes, update the rates AND the verifiedOn date so the
// page can tell readers how stale the number they are looking at is.

export type Cabin = "economy" | "premium" | "business" | "first";

export const CABINS: { id: Cabin; labelKey: string }[] = [
  { id: "economy", labelKey: "cabinEconomy" },
  { id: "premium", labelKey: "cabinPremium" },
  { id: "business", labelKey: "cabinBusiness" },
  { id: "first", labelKey: "cabinFirst" },
];

/** Which AAdvantage region an airport sits in. Only the two Asia regions and
 *  the North America origin region matter for this tool's scope. */
type AaRegion = "north-america" | "asia1" | "asia2";

export type Airport = {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  aaRegion: AaRegion;
};

export const ORIGINS: Airport[] = [
  { code: "YYZ", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248, aaRegion: "north-america" },
  { code: "YVR", city: "Vancouver", country: "Canada", lat: 49.1967, lon: -123.1815, aaRegion: "north-america" },
  { code: "YUL", city: "Montréal", country: "Canada", lat: 45.4657, lon: -73.7455, aaRegion: "north-america" },
  { code: "YYC", city: "Calgary", country: "Canada", lat: 51.1139, lon: -114.0203, aaRegion: "north-america" },
  { code: "YOW", city: "Ottawa", country: "Canada", lat: 45.3225, lon: -75.6692, aaRegion: "north-america" },
  { code: "YEG", city: "Edmonton", country: "Canada", lat: 53.3097, lon: -113.5801, aaRegion: "north-america" },
  { code: "YWG", city: "Winnipeg", country: "Canada", lat: 49.91, lon: -97.2399, aaRegion: "north-america" },
  { code: "YHZ", city: "Halifax", country: "Canada", lat: 44.8808, lon: -63.5086, aaRegion: "north-america" },
];

export const DESTINATIONS: Airport[] = [
  { code: "SGN", city: "TP. Hồ Chí Minh", country: "Việt Nam", lat: 10.8188, lon: 106.652, aaRegion: "asia2" },
  { code: "HAN", city: "Hà Nội", country: "Việt Nam", lat: 21.2212, lon: 105.8072, aaRegion: "asia2" },
  { code: "DAD", city: "Đà Nẵng", country: "Việt Nam", lat: 16.0439, lon: 108.1994, aaRegion: "asia2" },
  { code: "CXR", city: "Nha Trang", country: "Việt Nam", lat: 11.9982, lon: 109.2192, aaRegion: "asia2" },
  { code: "PQC", city: "Phú Quốc", country: "Việt Nam", lat: 10.1698, lon: 103.9931, aaRegion: "asia2" },
  { code: "BKK", city: "Bangkok", country: "Thái Lan", lat: 13.69, lon: 100.7501, aaRegion: "asia2" },
  { code: "SIN", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915, aaRegion: "asia2" },
  { code: "HKG", city: "Hong Kong", country: "Hong Kong", lat: 22.308, lon: 113.9185, aaRegion: "asia2" },
  { code: "TPE", city: "Đài Bắc", country: "Đài Loan", lat: 25.0777, lon: 121.2328, aaRegion: "asia2" },
  { code: "KUL", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.7099, aaRegion: "asia2" },
  { code: "MNL", city: "Manila", country: "Philippines", lat: 14.5086, lon: 121.0194, aaRegion: "asia2" },
  { code: "PNH", city: "Phnom Penh", country: "Campuchia", lat: 11.5466, lon: 104.8441, aaRegion: "asia2" },
  { code: "ICN", city: "Seoul", country: "Hàn Quốc", lat: 37.4602, lon: 126.4407, aaRegion: "asia1" },
  { code: "NRT", city: "Tokyo Narita", country: "Nhật Bản", lat: 35.772, lon: 140.3929, aaRegion: "asia1" },
  { code: "HND", city: "Tokyo Haneda", country: "Nhật Bản", lat: 35.5494, lon: 139.7798, aaRegion: "asia1" },
];

/** Connecting hubs, assigned per program by alliance. There is no nonstop
 *  Canada→Vietnam service, so every quote is priced over one of these — which
 *  matters, because most of these programs charge on distance actually flown. */
const HUBS: Record<string, Airport> = {
  HKG: { code: "HKG", city: "Hong Kong", country: "Hong Kong", lat: 22.308, lon: 113.9185, aaRegion: "asia2" },
  DOH: { code: "DOH", city: "Doha", country: "Qatar", lat: 25.2731, lon: 51.6081, aaRegion: "asia2" },
  NRT: { code: "NRT", city: "Tokyo Narita", country: "Nhật Bản", lat: 35.772, lon: 140.3929, aaRegion: "asia1" },
  HND: { code: "HND", city: "Tokyo Haneda", country: "Nhật Bản", lat: 35.5494, lon: 139.7798, aaRegion: "asia1" },
  ICN: { code: "ICN", city: "Seoul", country: "Hàn Quốc", lat: 37.4602, lon: 126.4407, aaRegion: "asia1" },
  TPE: { code: "TPE", city: "Đài Bắc", country: "Đài Loan", lat: 25.0777, lon: 121.2328, aaRegion: "asia2" },
  CDG: { code: "CDG", city: "Paris", country: "Pháp", lat: 49.0097, lon: 2.5479, aaRegion: "north-america" },
  AMS: { code: "AMS", city: "Amsterdam", country: "Hà Lan", lat: 52.3105, lon: 4.7683, aaRegion: "north-america" },
};

/** Star Alliance connection points an Aeroplan itinerary to Vietnam actually
 *  uses: Air Canada across the Pacific, then ANA, Asiana or EVA onward. */
const STAR_HUBS = ["NRT", "HND", "ICN", "TPE"];
/** oneworld: Cathay via Hong Kong, Qatar via Doha, JAL via Tokyo. */
const ONEWORLD_HUBS = ["HKG", "DOH", "NRT"];

const AIRPORTS_BY_CODE = new Map<string, Airport>(
  [...ORIGINS, ...DESTINATIONS, ...Object.values(HUBS)].map((a) => [a.code, a])
);

export function airportByCode(code: string): Airport | undefined {
  return AIRPORTS_BY_CODE.get(code);
}

/** Great-circle distance in statute miles — the unit every one of these
 *  programs measures its distance bands in. */
export function greatCircleMiles(a: Airport, b: Airport): number {
  const R = 3958.7613; // Earth radius, statute miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

type Rates = Partial<Record<Cabin, number>>;
type DistanceBand = { upTo: number; rates: Rates };

/** Every model carries its own hubs: the routing is what gets priced, and a
 *  Star Alliance itinerary connects in different places than a oneworld one. */
type PricingModel =
  /** One band lookup on the total distance actually flown, connections
   *  included — so a routing through a hub can tip you into a pricier band. */
  | { kind: "distance-total"; bands: DistanceBand[]; hubs: string[] }
  /** Points set by a fixed origin-region → destination-region table. The
   *  routing does not change the price, but it is still shown so the reader
   *  knows which itinerary the quote assumes. */
  | { kind: "zone"; rates: Record<"asia1" | "asia2", Rates>; hubs: string[] }
  /** Each flown segment is priced on its own distance, then the prices are
   *  added up — quite different from pricing the total distance once. */
  | { kind: "distance-segments"; bands: DistanceBand[]; hubs: string[] }
  /** No chart exists — price is looked up live at booking time. */
  | { kind: "dynamic"; hubs: string[] };

export type Program = {
  id: string;
  name: string;
  /** What the programme calls its points. Avios, for instance, is the
   *  currency shared by British Airways, Qatar, Iberia and Aer Lingus — it is
   *  not the name of any one of their programmes. */
  currency: string;
  logo: string;
  pricing: PricingModel;
  /** How much the number can be relied on, surfaced in the UI.
   *  published  — the airline prints this chart itself.
   *  unpublished — a real fixed chart the airline declines to publish;
   *                reconstructed from reporting, so verify before transferring.
   *  dynamic    — no chart exists at all. */
  confidence: "published" | "unpublished" | "dynamic";
  /** Rough cash surcharge on top of the points, for this kind of route. */
  surcharge: "low" | "medium" | "high";
  /** Matches TRANSFER_PARTNERS[].program so the two datasets stay in step. */
  transferPartnerKey: string | null;
  noteKey: string;
  sourceUrl: string;
  verifiedOn: string;
};

export const PROGRAMS: Program[] = [
  {
    id: "aeroplan",
    name: "Air Canada® Aeroplan®",
    currency: "điểm Aeroplan",
    logo: "/images/logos/partners/aeroplan.jpg",
    pricing: {
      // Aeroplan bands on the CUMULATIVE distance of the segments flown, not
      // the direct origin→destination distance. Routing therefore moves the
      // price: YVR→SGN via Tokyo totals ~7,600 miles and lands a band above
      // the same trip via Hong Kong at ~7,300.
      kind: "distance-total",
      hubs: STAR_HUBS,
      bands: [
        { upTo: 5000, rates: { economy: 32500, premium: 45000, business: 55000, first: 90000 } },
        { upTo: 7500, rates: { economy: 50000, premium: 60000, business: 85000, first: 120000 } },
        { upTo: 11000, rates: { economy: 65000, premium: 85000, business: 102500, first: 140000 } },
        { upTo: Infinity, rates: { economy: 70000, premium: 95000, business: 115000, first: 150000 } },
      ],
    },
    confidence: "published",
    surcharge: "low",
    transferPartnerKey: "Air Canada® Aeroplan®",
    noteKey: "noteAeroplan",
    sourceUrl: "https://www.aircanada.com/ca/en/aco/home/aeroplan/redeem/flight-rewards-chart.html",
    verifiedOn: "2026-08-09",
  },
  {
    id: "aadvantage",
    name: "American Airlines® AAdvantage®",
    currency: "AAdvantage miles",
    logo: "/images/logos/partners/american-airlines.png",
    pricing: {
      kind: "zone",
      hubs: ONEWORLD_HUBS,
      rates: {
        asia1: { economy: 35000, premium: 50000, business: 60000, first: 80000 },
        asia2: { economy: 37500, premium: 50000, business: 70000, first: 110000 },
      },
    },
    confidence: "published",
    surcharge: "low",
    transferPartnerKey: "American Airlines® AAdvantage®",
    noteKey: "noteAadvantage",
    sourceUrl: "https://www.aa.com/i18n/aadvantage-program/miles/redeem/award-travel/partner-airline-award-chart.jsp",
    verifiedOn: "2026-08-09",
  },
  {
    id: "ba-avios",
    name: "British Airways® Club",
    currency: "Avios",
    logo: "/images/logos/partners/british-airways.png",
    pricing: {
      kind: "distance-segments",
      hubs: ONEWORLD_HUBS,
      bands: [
        { upTo: 650, rates: { economy: 4000, business: 7750 } },
        { upTo: 1150, rates: { economy: 6500, business: 13000 } },
        { upTo: 2000, rates: { economy: 8500, business: 17000, first: 25500 } },
        { upTo: 3000, rates: { economy: 10000, business: 22000, first: 34000 } },
        { upTo: 4000, rates: { economy: 13000, business: 29500, first: 44000 } },
        { upTo: 5500, rates: { economy: 16250, business: 47750, first: 68000 } },
        { upTo: 6500, rates: { economy: 21750, business: 56000, first: 85000 } },
        { upTo: Infinity, rates: { economy: 32500, business: 68000, first: 102000 } },
      ],
    },
    confidence: "unpublished",
    surcharge: "medium",
    transferPartnerKey: "British Airways® Avios",
    noteKey: "noteBaAvios",
    sourceUrl: "https://awardtravelfinder.com/award-charts/british-airways",
    verifiedOn: "2026-08-09",
  },
  {
    id: "qatar-avios",
    name: "Qatar Airways® Privilege Club",
    currency: "Avios",
    logo: "/images/logos/partners/qatar-airways.svg",
    pricing: {
      kind: "distance-segments",
      hubs: ONEWORLD_HUBS,
      bands: [
        { upTo: 650, rates: { economy: 4000, business: 7750 } },
        { upTo: 1150, rates: { economy: 6500, business: 13000 } },
        { upTo: 2000, rates: { economy: 8500, business: 17000, first: 25500 } },
        { upTo: 3000, rates: { economy: 10000, business: 22000, first: 34000 } },
        { upTo: 4000, rates: { economy: 13000, business: 29500, first: 44000 } },
        { upTo: 5500, rates: { economy: 16250, business: 47750, first: 68000 } },
        { upTo: 6500, rates: { economy: 21750, business: 56000, first: 85000 } },
        { upTo: Infinity, rates: { economy: 32500, business: 68000, first: 102000 } },
      ],
    },
    confidence: "unpublished",
    surcharge: "medium",
    // No Canadian card transfers to Qatar directly — you route through Avios.
    transferPartnerKey: null,
    noteKey: "noteQatarAvios",
    sourceUrl: "https://awardtravelfinder.com/award-charts/qatar-airways",
    verifiedOn: "2026-08-09",
  },
  {
    id: "asia-miles",
    name: "Cathay Pacific® Asia Miles®",
    currency: "Asia Miles",
    logo: "/images/logos/partners/cathay-pacific.png",
    pricing: {
      // Cathay flies both legs of a Canada→Vietnam routing via Hong Kong, so
      // the (cheaper) Cathay-operated chart applies rather than the partner
      // one. Bands 2 and 3 are the 751–2,750 "Type 1" and "Type 2" splits;
      // Type 2 covers routes touching Bangladesh, India, Indonesia, Japan,
      // Nepal or Sri Lanka. Every Canada→Southeast Asia routing lands in the
      // 7,501+ band anyway, so the split never bites within this tool's scope.
      kind: "distance-total",
      hubs: ["HKG"],
      bands: [
        { upTo: 750, rates: { economy: 7000, premium: 11000, business: 16000 } },
        { upTo: 2750, rates: { economy: 9000, premium: 18000, business: 27000, first: 43000 } },
        { upTo: 5000, rates: { economy: 20000, premium: 39000, business: 60000, first: 90000 } },
        { upTo: 7500, rates: { economy: 27000, premium: 52000, business: 91000, first: 125000 } },
        { upTo: Infinity, rates: { economy: 38000, premium: 78000, business: 119000, first: 160000 } },
      ],
    },
    confidence: "unpublished",
    surcharge: "medium",
    transferPartnerKey: "Cathay Pacific® Asia Miles®",
    noteKey: "noteAsiaMiles",
    sourceUrl: "https://flights.cathaypacific.com/en_CA/redeem-flights/flight-award-chart.html",
    verifiedOn: "2026-08-09",
  },
  {
    id: "flying-blue",
    name: "Air France KLM® Flying Blue®",
    currency: "Flying Blue miles",
    logo: "/images/logos/partners/flying-blue.jpg",
    // Air France and KLM route Canada→Vietnam over their own European hubs.
    pricing: { kind: "dynamic", hubs: ["CDG", "AMS"] },
    confidence: "dynamic",
    surcharge: "high",
    transferPartnerKey: "Air France KLM® Flying Blue®",
    noteKey: "noteFlyingBlue",
    sourceUrl: "https://www.flyingblue.com/en/spend-miles/flight-awards",
    verifiedOn: "2026-08-09",
  },
];

function bandRate(bands: DistanceBand[], miles: number, cabin: Cabin): number | null {
  const band = bands.find((b) => miles <= b.upTo);
  return band?.rates[cabin] ?? null;
}

export type Quote = {
  program: Program;
  /** null when the program publishes nothing usable for this cabin. */
  points: number | null;
  /** Distance the price was derived from, in miles. */
  miles: number;
  /** Airport codes the quote was priced over, e.g. ["YYZ", "HKG", "SGN"]. */
  routing: string[];
};

type PricedRouting = { points: number | null; miles: number; routing: string[] };

/** Cheapest way to string an origin and destination together through one of a
 *  program's hubs. `price` turns a list of segment distances into a points
 *  total, which is where the two hub-based models diverge: one prices every
 *  segment separately and adds the prices up, the other adds the distances up
 *  and prices that once.
 *
 *  Pricing a nonstop is only allowed when the destination is itself one of the
 *  program's hubs. No airline flies Canada→Vietnam nonstop, and a per-segment
 *  program like Avios is markedly cheaper on a fictional nonstop than on the
 *  two real segments — quoting the nonstop would understate every Avios fare
 *  on the routes this tool exists to cover. */
function bestRouting(
  origin: Airport,
  destination: Airport,
  hubCodes: string[],
  price: (segmentMiles: number[]) => number | null
): PricedRouting {
  const candidates: PricedRouting[] = [];

  if (hubCodes.includes(destination.code)) {
    const directMiles = greatCircleMiles(origin, destination);
    candidates.push({
      points: price([directMiles]),
      miles: directMiles,
      routing: [origin.code, destination.code],
    });
  }

  for (const code of hubCodes) {
    const hub = HUBS[code];
    if (!hub || hub.code === destination.code || hub.code === origin.code) continue;
    const legs = [greatCircleMiles(origin, hub), greatCircleMiles(hub, destination)];
    candidates.push({
      points: price(legs),
      miles: legs[0] + legs[1],
      routing: [origin.code, hub.code, destination.code],
    });
  }

  const priced = candidates.filter((c) => c.points !== null);
  if (priced.length > 0) {
    // Cheapest wins; on a tie, the shorter itinerary does. The tie-break also
    // makes this usable for programs whose price ignores routing entirely —
    // pass a constant price and it simply returns the shortest way there.
    return priced.reduce((best, c) => {
      if (c.points !== best.points) return c.points! < best.points! ? c : best;
      return c.miles < best.miles ? c : best;
    });
  }
  // Nothing priced — the cabin has no published rate. Still report the
  // shortest routing so the card can show what itinerary it was reasoning
  // about while explaining the gap.
  return candidates.reduce(
    (best, c) => (c.miles < best.miles ? c : best),
    candidates[0] ?? {
      points: null,
      miles: greatCircleMiles(origin, destination),
      routing: [origin.code, destination.code],
    }
  );
}

/** Price one route in one cabin across every program. Sorted cheapest first,
 *  with the programs that publish nothing pushed to the bottom. */
export function quoteRoute(origin: Airport, destination: Airport, cabin: Cabin): Quote[] {
  const quotes: Quote[] = PROGRAMS.map((program) => {
    switch (program.pricing.kind) {
      case "zone": {
        const region = destination.aaRegion === "asia1" ? "asia1" : "asia2";
        const points = program.pricing.rates[region][cabin] ?? null;
        // The region table sets the price, so every routing costs the same;
        // pick the shortest one purely so the itinerary shown is sensible.
        const shown = bestRouting(origin, destination, program.pricing.hubs, () => 0);
        return { program, points, miles: shown.miles, routing: shown.routing };
      }

      case "distance-total": {
        const { bands } = program.pricing;
        const best = bestRouting(origin, destination, program.pricing.hubs, (legs) =>
          bandRate(bands, legs.reduce((sum, m) => sum + m, 0), cabin)
        );
        return { program, ...best };
      }

      case "distance-segments": {
        const { bands } = program.pricing;
        const best = bestRouting(origin, destination, program.pricing.hubs, (legs) => {
          const perLeg = legs.map((m) => bandRate(bands, m, cabin));
          return perLeg.some((r) => r === null)
            ? null
            : perLeg.reduce((sum, r) => sum! + r!, 0);
        });
        return { program, ...best };
      }

      case "dynamic": {
        const shown = bestRouting(origin, destination, program.pricing.hubs, () => 0);
        return { program, points: null, miles: shown.miles, routing: shown.routing };
      }
    }
  });

  return quotes.sort((a, b) => {
    if (a.points === null && b.points === null) return 0;
    if (a.points === null) return 1;
    if (b.points === null) return -1;
    return a.points - b.points;
  });
}

export function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}
