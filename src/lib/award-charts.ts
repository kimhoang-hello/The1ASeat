// Award chart data for Canada → Vietnam / Southeast Asia, covering the six
// programs a Canadian cardholder can actually reach with Amex Membership
// Rewards or RBC Avion (see transfer-partners.ts for the transfer legs).
//
// Only three of the six can be quoted at all. That is the honest state of the
// industry in 2026, and the page says so rather than inventing numbers:
//
//  - Aeroplan — PUBLISHED, straight from Air Canada's own PDF (document
//    version 2026-04, the chart in force from 1 June 2026), page 5 "Between
//    North America and Pacific zones". The PDF is Akamai-blocked to plain
//    curl; it needs browser request headers.
//    The chart has TWO columns and they are not interchangeable. "All other
//    partners" is fixed and guaranteed, and publishes only Economy, Business
//    and First — there is NO partner Premium Economy rate. "Air Canada and/or
//    Select Partners" (United, Emirates, Flydubai, Etihad, Canadian North,
//    Calm Air, Bearskin, PAL) is dynamic and publishes a "Starting at" floor
//    plus a median. Premium Economy exists only in that second column, which
//    is why those numbers are modelled as `startingAt` and rendered with a
//    "from" prefix. An earlier version of this file took the Premium Economy
//    figures from the dynamic column and presented them as fixed partner
//    rates, which is exactly the error this split now prevents.
//    The PDF also settles two things reporting got muddled: band edges are
//    0-5,000 / 5,001-7,500 / 7,501-11,000 / 11,001+, and points are "based on
//    the actual distance flown between origin and destination". A partner
//    booking fee applies to any itinerary containing a partner segment.
//  - AAdvantage — PUBLISHED. Partner chart, agreed by awardfares.com
//    (updated 2026-08-06) and 10xtravel.com, which also confirms Vietnam sits
//    in Asia Region 2 alongside China, Hong Kong, Taiwan and the rest of
//    Southeast Asia. AA-operated metal is dynamic and excluded.
//
//  - Asia Miles — UNPUBLISHED but real and verifiable. Cathay withdrew its
//    chart; its official "Flight awards charts" page now carries only the
//    upgrade, companion and partner charts. Rates below are the 1 May 2026
//    revision from suitesmile.com, cross checked against mainlymiles.com and
//    milelion.com — all three agree that the 7,501+ business rate went to
//    119,000. Do NOT trust awardtravelfinder.com here: it still serves the
//    pre-May-2026 chart at 115,000. These are the Cathay-operated rates,
//    which is right for Canada→Vietnam because Cathay flies both legs via
//    Hong Kong; its partner-operated chart runs a few thousand higher.
//    australianfrequentflyer.com.au independently confirms every cell used
//    here including Premium Economy at 52,000 and 78,000.
//
//  - British Airways Club and Qatar Privilege Club — NOT QUOTABLE. An earlier
//    version of this file published a distance chart topping out at 68,000
//    Avios in business, taken from awardtravelfinder.com. That chart is stale
//    by years. The Points Guy and 10xtravel both describe nine bands topping
//    out at 7,001+ and roughly 154,500 Avios in business — over double. On top
//    of that, BA devalued partner awards again on 15 Dec 2025 (~10%), prices
//    vary by peak/off-peak date, and there is now a SEPARATE chart per
//    operating partner plus a multi-carrier chart. No public source
//    reconstructs all of that reliably, so this tool refuses to guess and
//    tells the reader to price it on ba.com instead.
//
//  - Flying Blue — NO CHART AT ALL. Fully dynamic, confirmed by
//    awardfares.com/blog/flying-blue-guide (updated 2026-04-09).
//
// Sources re-verified 2026-08-09. When a program changes, update the rates AND
// its verifiedOn date so the page can show readers how fresh the number is.

export type Cabin = "economy" | "premium" | "business" | "first";

export const CABINS: { id: Cabin; labelKey: string }[] = [
  { id: "economy", labelKey: "cabinEconomy" },
  { id: "premium", labelKey: "cabinPremium" },
  { id: "business", labelKey: "cabinBusiness" },
  { id: "first", labelKey: "cabinFirst" },
];

/** AAdvantage's two Asia regions. Only meaningful for destinations — an
 *  origin or a European connecting hub never needs one. */
type AaRegion = "asia1" | "asia2";

export type Airport = {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  aaRegion?: AaRegion;
};

/** One definition per airport. Several of these are both a destination a
 *  reader can pick and a hub some program connects through, so they must not
 *  be declared twice — the coordinates would eventually drift apart. */
const AIRPORTS: Record<string, Airport> = {
  // Canadian origins
  YYZ: { code: "YYZ", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248 },
  YVR: { code: "YVR", city: "Vancouver", country: "Canada", lat: 49.1967, lon: -123.1815 },
  YUL: { code: "YUL", city: "Montréal", country: "Canada", lat: 45.4657, lon: -73.7455 },
  YYC: { code: "YYC", city: "Calgary", country: "Canada", lat: 51.1139, lon: -114.0203 },
  YOW: { code: "YOW", city: "Ottawa", country: "Canada", lat: 45.3225, lon: -75.6692 },
  YEG: { code: "YEG", city: "Edmonton", country: "Canada", lat: 53.3097, lon: -113.5801 },
  YWG: { code: "YWG", city: "Winnipeg", country: "Canada", lat: 49.91, lon: -97.2399 },
  YHZ: { code: "YHZ", city: "Halifax", country: "Canada", lat: 44.8808, lon: -63.5086 },

  // Vietnam and Southeast Asia. Nha Trang (CXR) and Phú Quốc (PQC) are
  // deliberately absent: no oneworld or Star Alliance carrier serves them, and
  // Vietnam Airlines is SkyTeam, so none of these programs can ticket them
  // without a domestic add-on they do not sell. Quoting them would price an
  // itinerary nobody can book.
  SGN: { code: "SGN", city: "TP. Hồ Chí Minh", country: "Việt Nam", lat: 10.8188, lon: 106.652, aaRegion: "asia2" },
  HAN: { code: "HAN", city: "Hà Nội", country: "Việt Nam", lat: 21.2212, lon: 105.8072, aaRegion: "asia2" },
  DAD: { code: "DAD", city: "Đà Nẵng", country: "Việt Nam", lat: 16.0439, lon: 108.1994, aaRegion: "asia2" },
  BKK: { code: "BKK", city: "Bangkok", country: "Thái Lan", lat: 13.69, lon: 100.7501, aaRegion: "asia2" },
  SIN: { code: "SIN", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915, aaRegion: "asia2" },
  KUL: { code: "KUL", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.7099, aaRegion: "asia2" },
  MNL: { code: "MNL", city: "Manila", country: "Philippines", lat: 14.5086, lon: 121.0194, aaRegion: "asia2" },
  PNH: { code: "PNH", city: "Phnom Penh", country: "Campuchia", lat: 11.5466, lon: 104.8441, aaRegion: "asia2" },

  // Asian gateways — pickable as destinations and used as connecting hubs.
  HKG: { code: "HKG", city: "Hong Kong", country: "Hong Kong", lat: 22.308, lon: 113.9185, aaRegion: "asia2" },
  TPE: { code: "TPE", city: "Đài Bắc", country: "Đài Loan", lat: 25.0777, lon: 121.2328, aaRegion: "asia2" },
  ICN: { code: "ICN", city: "Seoul", country: "Hàn Quốc", lat: 37.4602, lon: 126.4407, aaRegion: "asia1" },
  NRT: { code: "NRT", city: "Tokyo Narita", country: "Nhật Bản", lat: 35.772, lon: 140.3929, aaRegion: "asia1" },
  HND: { code: "HND", city: "Tokyo Haneda", country: "Nhật Bản", lat: 35.5494, lon: 139.7798, aaRegion: "asia1" },
  PEK: { code: "PEK", city: "Bắc Kinh", country: "Trung Quốc", lat: 40.0799, lon: 116.6031, aaRegion: "asia2" },

  // European hubs — connection points only, never selectable.
  DOH: { code: "DOH", city: "Doha", country: "Qatar", lat: 25.2731, lon: 51.6081 },
  CDG: { code: "CDG", city: "Paris", country: "Pháp", lat: 49.0097, lon: 2.5479 },
  AMS: { code: "AMS", city: "Amsterdam", country: "Hà Lan", lat: 52.3105, lon: 4.7683 },
};

const pick = (...codes: string[]): Airport[] => codes.map((c) => AIRPORTS[c]);

export const ORIGINS = pick("YYZ", "YVR", "YUL", "YYC", "YOW", "YEG", "YWG", "YHZ");

export const DESTINATIONS = pick(
  "SGN", "HAN", "DAD",
  "BKK", "SIN", "KUL", "MNL", "PNH",
  "HKG", "TPE", "ICN", "NRT", "HND"
);

/** The airline actually flying the Asian portion of a routing. Shown so a
 *  reader can tell YYZ–TPE–SGN on EVA apart from YYZ–ICN–SGN on Asiana
 *  instead of seeing two anonymous airport strings. */
export type Carrier = {
  code: string;
  name: string;
  logo: string;
  /** Canadian airports this carrier flies its own long-haul from. Anywhere
   *  else needs an Air Canada feeder first, which adds real distance — and on
   *  a chart banded by distance flown, ignoring it understates the price. */
  gateways: string[];
};

// Gateway sets, not timetables. Seasonal frequencies move around; what is
// stable is which Canadian cities each carrier serves at all. EVA, Asiana and
// Cathay reach both Toronto and Vancouver; ANA, JAL and Air China are
// Vancouver-only; Qatar flies the eastern cities; the two European carriers
// spread widest.
const CARRIERS: Record<string, Carrier> = {
  BR: { code: "BR", name: "EVA Air®", logo: "/images/logos/partners/eva-air.svg", gateways: ["YYZ", "YVR"] },
  OZ: { code: "OZ", name: "Asiana Airlines®", logo: "/images/logos/partners/asiana.svg", gateways: ["YYZ", "YVR"] },
  NH: { code: "NH", name: "ANA®", logo: "/images/logos/partners/ana.svg", gateways: ["YVR"] },
  CA: { code: "CA", name: "Air China®", logo: "/images/logos/partners/air-china.svg", gateways: ["YVR"] },
  CX: { code: "CX", name: "Cathay Pacific®", logo: "/images/logos/partners/cathay-pacific.png", gateways: ["YYZ", "YVR"] },
  QR: { code: "QR", name: "Qatar Airways®", logo: "/images/logos/partners/qatar-airways.svg", gateways: ["YYZ", "YUL"] },
  JL: { code: "JL", name: "Japan Airlines®", logo: "/images/logos/partners/japan-airlines.svg", gateways: ["YVR"] },
  AF: { code: "AF", name: "Air France®", logo: "/images/logos/partners/air-france.png", gateways: ["YYZ", "YVR", "YUL"] },
  KL: { code: "KL", name: "KLM®", logo: "/images/logos/partners/klm.svg", gateways: ["YYZ", "YVR", "YYC"] },
};

/** The feeder to a gateway is always Air Canada in practice. */
const FEEDER: Carrier = {
  code: "AC",
  name: "Air Canada®",
  logo: "/images/logos/partners/air-canada.svg",
  gateways: [],
};

/** A connecting hub plus the partner that flies it. */
type HubRoute = { hub: string; carrier: string };

/** Star Alliance options for Aeroplan. EVA and Asiana fly Canada nonstop and
 *  onward to Vietnam themselves; ANA only serves Vancouver, and Air China
 *  routes over Beijing. */
const STAR_ROUTES: HubRoute[] = [
  { hub: "TPE", carrier: "BR" },
  { hub: "ICN", carrier: "OZ" },
  { hub: "NRT", carrier: "NH" },
  { hub: "HND", carrier: "NH" },
  { hub: "PEK", carrier: "CA" },
];
/** oneworld: Cathay over Hong Kong, Qatar over Doha, JAL over Tokyo. */
const ONEWORLD_ROUTES: HubRoute[] = [
  { hub: "HKG", carrier: "CX" },
  { hub: "DOH", carrier: "QR" },
  { hub: "NRT", carrier: "JL" },
];
/** Cathay flies both legs of its own itineraries via Hong Kong. */
const CATHAY_ROUTES: HubRoute[] = [{ hub: "HKG", carrier: "CX" }];
/** SkyTeam, over Air France and KLM's own European hubs. */
const SKYTEAM_ROUTES: HubRoute[] = [
  { hub: "CDG", carrier: "AF" },
  { hub: "AMS", carrier: "KL" },
];

export function airportByCode(code: string): Airport | undefined {
  return AIRPORTS[code];
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
type DistanceBand = {
  upTo: number;
  /** Fixed rates — what the programme guarantees. */
  rates: Rates;
  /** Published floors for cabins the fixed table does not cover, where the
   *  real price is dynamic and starts here. Kept separate so the UI can say
   *  "from" rather than passing a floor off as a guaranteed rate. */
  startingAt?: Rates;
};

/** Every model carries its own hubs: the routing is what gets priced, and a
 *  Star Alliance itinerary connects in different places than a oneworld one. */
type PricingModel =
  /** One band lookup on the total distance actually flown, connections
   *  included — so a routing through a hub can tip you into a pricier band. */
  | { kind: "distance-total"; bands: DistanceBand[]; hubs: HubRoute[] }
  /** Points set by a fixed origin-region → destination-region table. The
   *  routing does not change the price, but it is still shown so the reader
   *  knows which itinerary the quote assumes. */
  | { kind: "zone"; rates: Record<AaRegion, Rates>; hubs: HubRoute[] }
  /** No number can be quoted ahead of time. `labelKey` distinguishes a program
   *  with no chart at all from one whose chart exists but cannot be pinned
   *  down — they are different problems and deserve different wording. */
  | { kind: "unquotable"; hubs: HubRoute[]; labelKey: string; hintKey: string };

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
   *  published   — the airline prints this chart itself.
   *  unpublished — a real fixed chart the airline declines to publish,
   *                reconstructed from agreeing reports.
   *  unquotable  — no number can be shown; see the note for why. */
  confidence: "published" | "unpublished" | "unquotable";
  /** Rough cash surcharge on top of the points, for this kind of route. */
  surcharge: "low" | "medium" | "high";
  /** Matches TRANSFER_PARTNERS[].program so the two datasets stay in step. */
  transferPartnerKey: string | null;
  /** Overrides the transfer cell when the route to this program is
   *  indirect rather than simply absent. */
  transferNoteKey?: string;
  noteKey: string;
  sourceUrl: string;
  verifiedOn: string;
};

/** British Airways and Qatar share this: Avios, oneworld hubs, and the same
 *  reason for being unquotable. */
const AVIOS_PRICING = {
  kind: "unquotable",
  hubs: ONEWORLD_ROUTES,
  labelKey: "noPublicChart",
  hintKey: "noPublicChartHint",
} as const;

export const PROGRAMS: Program[] = [
  {
    id: "aeroplan",
    name: "Air Canada® Aeroplan®",
    currency: "Aeroplan",
    logo: "/images/logos/partners/aeroplan.jpg",
    pricing: {
      // Aeroplan bands on the CUMULATIVE distance of the segments flown, not
      // the direct origin→destination distance, capped by a routing rule of no
      // more than double the nonstop distance. Routing therefore moves the
      // price: YVR→SGN via Seoul totals ~7,300 miles and lands a band below
      // the same trip via Tokyo at ~7,600.
      kind: "distance-total",
      hubs: STAR_ROUTES,
      // `rates` is the official "All other partners" column: fixed, guaranteed,
      // and with no Premium Economy row at all. `startingAt` is the "Air Canada
      // and/or Select Partners" column, which is dynamic and only publishes a
      // floor — that is where Aeroplan's Premium Economy numbers actually live.
      bands: [
        {
          upTo: 5000,
          rates: { economy: 32500, business: 55000, first: 90000 },
          startingAt: { economy: 32500, premium: 45000, business: 55000, first: 90000 },
        },
        {
          upTo: 7500,
          rates: { economy: 50000, business: 85000, first: 120000 },
          startingAt: { economy: 45000, premium: 60000, business: 85000, first: 110000 },
        },
        {
          upTo: 11000,
          rates: { economy: 65000, business: 102500, first: 140000 },
          startingAt: { economy: 50000, premium: 85000, business: 85000, first: 130000 },
        },
        {
          upTo: Infinity,
          rates: { economy: 70000, business: 115000, first: 150000 },
          startingAt: { economy: 70000, premium: 95000, business: 105000, first: 150000 },
        },
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
      hubs: ONEWORLD_ROUTES,
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
    id: "asia-miles",
    name: "Cathay Pacific® Asia Miles®",
    currency: "Asia Miles",
    logo: "/images/logos/partners/cathay-pacific.png",
    pricing: {
      // Bands 2 and 3 are the 751–2,750 "Type 1"/"Type 2" split, where Type 2
      // covers routes touching Bangladesh, India, Indonesia, Japan, Nepal or
      // Sri Lanka. Every Canada→Southeast Asia routing lands in the 7,501+
      // band anyway, so the split never bites within this tool's scope.
      kind: "distance-total",
      hubs: CATHAY_ROUTES,
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
    id: "ba-avios",
    name: "British Airways® Club",
    currency: "Avios",
    logo: "/images/logos/partners/british-airways.png",
    pricing: AVIOS_PRICING,
    confidence: "unquotable",
    surcharge: "medium",
    transferPartnerKey: "British Airways® Avios",
    noteKey: "noteBaAvios",
    sourceUrl: "https://www.britishairways.com/content/the-british-airways-club",
    verifiedOn: "2026-08-09",
  },
  {
    id: "qatar-avios",
    name: "Qatar Airways® Privilege Club",
    currency: "Avios",
    logo: "/images/logos/partners/qatar-airways.svg",
    pricing: AVIOS_PRICING,
    confidence: "unquotable",
    surcharge: "medium",
    // No Canadian card transfers to Qatar directly, but Avios are poolable,
    // so the route in is via British Airways.
    transferPartnerKey: null,
    transferNoteKey: "transferViaAvios",
    noteKey: "noteQatarAvios",
    sourceUrl: "https://www.qatarairways.com/en/privilegeclub.html",
    verifiedOn: "2026-08-09",
  },
  {
    id: "flying-blue",
    name: "Air France KLM® Flying Blue®",
    currency: "Flying Blue miles",
    logo: "/images/logos/partners/flying-blue.jpg",
    pricing: {
      kind: "unquotable",
      hubs: SKYTEAM_ROUTES,
      // Same wording as the two Avios programmes: from the reader's side the
      // outcome is identical — no number to compare before transferring. The
      // reason it cannot be quoted differs, and the note explains that.
      labelKey: "noPublicChart",
      hintKey: "noPublicChartHint",
    },
    confidence: "unquotable",
    surcharge: "high",
    transferPartnerKey: "Air France KLM® Flying Blue®",
    noteKey: "noteFlyingBlue",
    sourceUrl: "https://www.flyingblue.com/en/spend-miles/flight-awards",
    verifiedOn: "2026-08-09",
  },
];

type Priced = { points: number | null; startingAt: boolean };

function bandRate(bands: DistanceBand[], miles: number, cabin: Cabin): Priced {
  const band = bands.find((b) => miles <= b.upTo);
  const fixed = band?.rates[cabin];
  if (fixed !== undefined) return { points: fixed, startingAt: false };
  const floor = band?.startingAt?.[cabin];
  if (floor !== undefined) return { points: floor, startingAt: true };
  return { points: null, startingAt: false };
}

/** One way of flying the route on one program: which airline, which stop, how
 *  far, and what it costs. A program usually offers several. */
export type RoutingOption = {
  routing: string[];
  miles: number;
  points: number | null;
  /** Carriers flying this itinerary in order — normally just the partner,
   *  plus an Air Canada feeder when the origin has no long-haul service. */
  carriers: Carrier[];
  /** The number is a published floor on a dynamic fare, not a fixed rate. */
  startingAt: boolean;
  /** True for the option this program would price cheapest. */
  isBest: boolean;
};

export type Quote = {
  program: Program;
  /** The cheapest option's price, or null when nothing can be quoted. */
  points: number | null;
  /** The headline number is a floor on a dynamic fare, not a fixed rate. */
  startingAt: boolean;
  /** Every routing this program can fly, cheapest first. */
  options: RoutingOption[];
};

/** Build every routing a program offers and price each one. `price` turns a
 *  list of segment distances into a points total, which is where the models
 *  diverge: one adds the distances up and prices that once, another ignores
 *  distance entirely.
 *
 *  A nonstop is only offered when the destination is itself one of the
 *  program's hubs. No airline flies Canada→Vietnam nonstop, and quoting that
 *  fictional segment would understate the fare on any distance-priced chart. */
function routingOptions(
  origin: Airport,
  destination: Airport,
  hubs: HubRoute[],
  price: (segmentMiles: number[]) => Priced
): RoutingOption[] {
  const options: RoutingOption[] = [];

  for (const { hub: hubCode, carrier: carrierCode } of hubs) {
    const hub = AIRPORTS[hubCode];
    const carrier = CARRIERS[carrierCode];
    if (!hub || !carrier || hub.code === origin.code) continue;

    // Where this carrier's own metal can pick you up. From anywhere else the
    // journey really begins with an Air Canada hop, and that distance counts.
    const stops: Airport[] = [origin];
    const carriers: Carrier[] = [];

    if (!carrier.gateways.includes(origin.code)) {
      const gateway = carrier.gateways
        .map((code) => AIRPORTS[code])
        .filter(Boolean)
        .sort(
          (a, b) =>
            greatCircleMiles(origin, a) + greatCircleMiles(a, hub) -
            (greatCircleMiles(origin, b) + greatCircleMiles(b, hub))
        )[0];
      if (!gateway) continue;
      stops.push(gateway);
      carriers.push(FEEDER);
    }

    // When the destination is the hub itself, the carrier flies it nonstop.
    if (hub.code !== destination.code) stops.push(hub);
    stops.push(destination);
    carriers.push(carrier);

    const legs = stops.slice(1).map((to, i) => greatCircleMiles(stops[i], to));
    const priced = price(legs);
    options.push({
      routing: stops.map((a) => a.code),
      miles: legs.reduce((sum, m) => sum + m, 0),
      points: priced.points,
      startingAt: priced.startingAt,
      carriers,
      isBest: false,
    });
  }

  // Cheapest first; unpriced options fall to the bottom, and equal prices are
  // broken by the shorter itinerary so the top option is also the quickest.
  options.sort((a, b) => {
    if (a.points === null && b.points === null) return a.miles - b.miles;
    if (a.points === null) return 1;
    if (b.points === null) return -1;
    return a.points === b.points ? a.miles - b.miles : a.points - b.points;
  });

  if (options.length > 0 && options[0].points !== null) options[0].isBest = true;
  return options;
}

/** Price one route in one cabin across every program. Sorted cheapest first,
 *  with the programs that cannot be quoted pushed to the bottom. */
export function quoteRoute(origin: Airport, destination: Airport, cabin: Cabin): Quote[] {
  const quotes: Quote[] = PROGRAMS.map((program) => {
    let options: RoutingOption[];

    switch (program.pricing.kind) {
      case "zone": {
        // The region table sets the price, so every routing costs the same.
        const region = destination.aaRegion ?? "asia2";
        const points = program.pricing.rates[region][cabin] ?? null;
        options = routingOptions(origin, destination, program.pricing.hubs, () => ({
          points,
          startingAt: false,
        }));
        break;
      }

      case "distance-total": {
        const { bands } = program.pricing;
        options = routingOptions(origin, destination, program.pricing.hubs, (legs) =>
          bandRate(bands, legs.reduce((sum, m) => sum + m, 0), cabin)
        );
        break;
      }

      case "unquotable":
        options = routingOptions(origin, destination, program.pricing.hubs, () => ({
          points: null,
          startingAt: false,
        }));
        break;
    }

    return {
      program,
      points: options[0]?.points ?? null,
      startingAt: options[0]?.startingAt ?? false,
      options,
    };
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
