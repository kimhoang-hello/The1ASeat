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

// No carrier sells a First cabin between Canada and Asia, so the option is
// deliberately absent rather than shown empty.
export type Cabin = "economy" | "premium" | "business";

export const CABINS: { id: Cabin; labelKey: string }[] = [
  { id: "economy", labelKey: "cabinEconomy" },
  { id: "premium", labelKey: "cabinPremium" },
  { id: "business", labelKey: "cabinBusiness" },
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

  // Vietnam and Southeast Asia. Nha Trang (CXR), Phú Quốc (PQC) and Phnom
  // Penh (PNH) are deliberately absent — no carrier in this tool's set flies
  // them from a hub it also reaches from Canada, so any quote would price an
  // itinerary nobody can book.
  SGN: { code: "SGN", city: "TP. Hồ Chí Minh", country: "Việt Nam", lat: 10.8188, lon: 106.652, aaRegion: "asia2" },
  HAN: { code: "HAN", city: "Hà Nội", country: "Việt Nam", lat: 21.2212, lon: 105.8072, aaRegion: "asia2" },
  DAD: { code: "DAD", city: "Đà Nẵng", country: "Việt Nam", lat: 16.0439, lon: 108.1994, aaRegion: "asia2" },
  BKK: { code: "BKK", city: "Bangkok", country: "Thái Lan", lat: 13.69, lon: 100.7501, aaRegion: "asia2" },
  SIN: { code: "SIN", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915, aaRegion: "asia2" },
  KUL: { code: "KUL", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.7099, aaRegion: "asia2" },
  MNL: { code: "MNL", city: "Manila", country: "Philippines", lat: 14.5086, lon: 121.0194, aaRegion: "asia2" },

  // Asian gateways — pickable as destinations and used as connecting hubs.
  HKG: { code: "HKG", city: "Hong Kong", country: "Hong Kong", lat: 22.308, lon: 113.9185, aaRegion: "asia2" },
  TPE: { code: "TPE", city: "Đài Bắc", country: "Đài Loan", lat: 25.0777, lon: 121.2328, aaRegion: "asia2" },
  ICN: { code: "ICN", city: "Seoul", country: "Hàn Quốc", lat: 37.4602, lon: 126.4407, aaRegion: "asia1" },
  NRT: { code: "NRT", city: "Tokyo Narita", country: "Nhật Bản", lat: 35.772, lon: 140.3929, aaRegion: "asia1" },
  HND: { code: "HND", city: "Tokyo Haneda", country: "Nhật Bản", lat: 35.5494, lon: 139.7798, aaRegion: "asia1" },
  PEK: { code: "PEK", city: "Bắc Kinh", country: "Trung Quốc", lat: 40.0799, lon: 116.6031, aaRegion: "asia2" },
  PVG: { code: "PVG", city: "Thượng Hải", country: "Trung Quốc", lat: 31.1443, lon: 121.8083, aaRegion: "asia2" },

  // European hubs — connection points only, never selectable.
  DOH: { code: "DOH", city: "Doha", country: "Qatar", lat: 25.2731, lon: 51.6081 },
  CDG: { code: "CDG", city: "Paris", country: "Pháp", lat: 49.0097, lon: 2.5479 },
  AMS: { code: "AMS", city: "Amsterdam", country: "Hà Lan", lat: 52.3105, lon: 4.7683 },
};

const pick = (...codes: string[]): Airport[] => codes.map((c) => AIRPORTS[c]);

export const ORIGINS = pick("YYZ", "YVR", "YUL", "YYC", "YOW", "YEG", "YWG", "YHZ");

export const DESTINATIONS = pick(
  "SGN", "HAN", "DAD",
  "BKK", "SIN", "KUL", "MNL",
  "HKG", "TPE", "ICN", "NRT", "HND", "PEK", "PVG"
);

/** An airline in one of these programmes, with the two facts that decide
 *  whether a routing is real: where in Canada it departs, and which airports
 *  in this tool's scope it actually serves.
 *
 *  Networks were read off flightconnections.com on 2026-08-09 (its own data is
 *  dated 08-02-2026) rather than assumed. Several assumptions this file used
 *  to make were simply wrong: Asiana no longer flies to Canada at all, Qatar
 *  has no Doha–Da Nang and no Taipei, Cathay has dropped Da Nang, KLM does not
 *  serve Vietnam, and Air France reaches Saigon but not Hanoi. */
export type Carrier = {
  code: string;
  name: string;
  logo: string;
  /** Canadian airports this carrier flies its own long-haul from. Anywhere
   *  else needs an Air Canada feeder first, which adds real distance — and on
   *  a chart banded by distance flown, ignoring it understates the price. */
  gateways: string[];
  /** Airports in this tool's scope that the carrier serves at all. */
  network: string[];
};

const CARRIERS: Record<string, Carrier> = {
  AC: {
    code: "AC",
    name: "Air Canada®",
    logo: "/images/logos/partners/air-canada.svg",
    // Transpacific departure points only. Air Canada reaches every other
    // Canadian city as the domestic feeder, but its Asia flying leaves from
    // Vancouver and Toronto — listing Montréal or Calgary here would invent
    // nonstops like YUL–PVG, and listing Halifax would invent YHZ–ICN.
    gateways: ["YVR", "YYZ"],
    network: ["BKK", "SIN", "MNL", "HKG", "ICN", "NRT", "HND", "PEK", "PVG"],
  },
  BR: {
    code: "BR",
    name: "EVA Air®",
    logo: "/images/logos/partners/eva-air.svg",
    gateways: ["YYZ", "YVR"],
    network: ["TPE", "SGN", "HAN", "DAD", "BKK", "SIN", "KUL", "MNL", "HKG", "ICN", "NRT", "HND", "PEK", "PVG"],
  },
  OZ: {
    code: "OZ",
    name: "Asiana Airlines®",
    logo: "/images/logos/partners/asiana.svg",
    // Asiana pulled out of Canada; it can only ever be the onward carrier now.
    gateways: [],
    network: ["ICN", "SGN", "HAN", "DAD", "BKK", "SIN", "MNL", "HKG", "TPE", "NRT", "HND", "PEK", "PVG"],
  },
  NH: {
    code: "NH",
    name: "ANA®",
    logo: "/images/logos/partners/ana.svg",
    gateways: ["YVR"],
    network: ["NRT", "HND", "SGN", "HAN", "BKK", "SIN", "KUL", "MNL", "HKG", "PEK", "PVG"],
  },
  CA: {
    code: "CA",
    name: "Air China®",
    logo: "/images/logos/partners/air-china.svg",
    gateways: ["YYZ", "YVR"],
    network: ["PEK", "PVG", "SGN", "HAN", "BKK", "SIN", "KUL", "MNL", "HKG", "TPE", "ICN", "NRT", "HND"],
  },
  CX: {
    code: "CX",
    name: "Cathay Pacific®",
    logo: "/images/logos/partners/cathay-pacific.png",
    gateways: ["YYZ", "YVR"],
    network: ["HKG", "SGN", "HAN", "BKK", "SIN", "KUL", "MNL", "TPE", "ICN", "NRT", "HND", "PEK", "PVG"],
  },
  QR: {
    code: "QR",
    name: "Qatar Airways®",
    logo: "/images/logos/partners/qatar-airways.svg",
    gateways: ["YYZ", "YUL"],
    network: ["DOH", "SGN", "HAN", "BKK", "SIN", "KUL", "MNL", "HKG", "ICN", "NRT", "HND", "PVG"],
  },
  JL: {
    code: "JL",
    name: "Japan Airlines®",
    logo: "/images/logos/partners/japan-airlines.svg",
    gateways: ["YVR"],
    network: ["NRT", "HND", "SGN", "HAN", "BKK", "SIN", "KUL", "MNL", "HKG", "TPE", "PEK", "PVG"],
  },
  AF: {
    code: "AF",
    name: "Air France®",
    logo: "/images/logos/partners/air-france.png",
    gateways: ["YYZ", "YVR", "YUL", "YOW"],
    network: ["CDG", "SGN", "BKK", "SIN", "MNL", "HKG", "ICN", "HND", "PEK", "PVG"],
  },
  KL: {
    code: "KL",
    name: "KLM®",
    logo: "/images/logos/partners/klm.svg",
    gateways: ["YYZ", "YVR", "YUL", "YYC", "YEG"],
    network: ["AMS", "BKK", "SIN", "KUL", "MNL", "HKG", "TPE", "ICN", "NRT", "PEK", "PVG"],
  },
  VN: {
    code: "VN",
    name: "Vietnam Airlines®",
    logo: "/images/logos/partners/vietnam-airlines.svg",
    // SkyTeam, so Flying Blue can book it — and it is how you actually reach
    // Hanoi or Da Nang from Europe, since Air France and KLM do not.
    gateways: [],
    network: ["CDG", "AMS", "SGN", "HAN", "DAD", "BKK", "SIN", "KUL", "MNL", "HKG", "TPE", "ICN", "NRT", "HND", "PEK", "PVG"],
  },
};

/** The feeder to a gateway is always Air Canada in practice. */
const FEEDER = CARRIERS.AC;

/** A connection: who flies Canada→hub, and who flies hub→destination. Both
 *  halves are checked against the carriers' real networks before the option
 *  is offered. */
type HubRoute = { hub: string; inbound: string; onward: string };

/** Star Alliance, for Aeroplan. EVA flies Taipei end to end; Asiana no longer
 *  serves Canada so Seoul needs Air Canada inbound; ANA covers Tokyo from
 *  Vancouver; Air China covers Beijing, and Air Canada reaches Shanghai. */
const STAR_ROUTES: HubRoute[] = [
  { hub: "TPE", inbound: "BR", onward: "BR" },
  { hub: "ICN", inbound: "AC", onward: "OZ" },
  { hub: "NRT", inbound: "NH", onward: "NH" },
  { hub: "HND", inbound: "NH", onward: "NH" },
  { hub: "PEK", inbound: "CA", onward: "CA" },
  { hub: "PVG", inbound: "AC", onward: "CA" },
];
/** oneworld: Cathay over Hong Kong, Qatar over Doha, JAL over Tokyo. */
const ONEWORLD_ROUTES: HubRoute[] = [
  { hub: "HKG", inbound: "CX", onward: "CX" },
  { hub: "DOH", inbound: "QR", onward: "QR" },
  { hub: "NRT", inbound: "JL", onward: "JL" },
];
/** Cathay flies both legs of its own itineraries via Hong Kong. */
const CATHAY_ROUTES: HubRoute[] = [{ hub: "HKG", inbound: "CX", onward: "CX" }];
/** SkyTeam. Air France and KLM cover part of Asia themselves; everywhere they
 *  do not reach — Hanoi and Da Nang especially — Vietnam Airlines does. */
const SKYTEAM_ROUTES: HubRoute[] = [
  { hub: "CDG", inbound: "AF", onward: "AF" },
  { hub: "CDG", inbound: "AF", onward: "VN" },
  { hub: "AMS", inbound: "KL", onward: "KL" },
  { hub: "AMS", inbound: "KL", onward: "VN" },
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
  /** Air Canada's published median of what members actually paid in this band.
   *  NOT a ceiling — on the shortest band the business median runs three times
   *  the floor — so it is shown as a median and never as the top of a range. */
  median?: Rates;
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

/** A route the published chart gets wrong, or one worth annotating. Matched
 *  on origin and destination, and optionally narrowed to a single hub. */
export type RouteOverride = {
  origins: string[];
  destinations: string[];
  hub?: string;
  /** Replaces the chart price for the matching routings. */
  rates?: Rates;
  /** Note shown on the card for this route only. */
  noteKey?: string;
  /** "highlight" for a rate that contradicts the programme's own chart;
   *  "info" — the default — for one that simply explains where the number
   *  comes from. */
  tone?: "highlight" | "info";
};

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
  /** Whether a chart figure still holds when the itinerary needs an Air
   *  Canada domestic feeder. Only Aeroplan prices those as one award; on the
   *  others the domestic hop is a separate ticket or repriced, so no number
   *  shown here would be trustworthy. */
  pricesWithFeeder: boolean;
  /** Real-world corrections that beat the published chart on named routes. */
  overrides?: RouteOverride[];
  /** Carriers whose own metal this programme prices dynamically rather than
   *  from its chart. An itinerary flown entirely by these shows no number. */
  dynamicCarriers?: string[];
  /** Carriers that fly Canada→destination nonstop and are bookable here, so
   *  the option is worth showing even though no chart covers it. */
  nonstopCarriers?: string[];
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
          rates: { economy: 32500, business: 55000 },
          startingAt: { economy: 32500, premium: 45000, business: 55000 },
          median: { economy: 49500, premium: 94200, business: 171600 },
        },
        {
          upTo: 7500,
          rates: { economy: 50000, business: 85000 },
          startingAt: { economy: 45000, premium: 60000, business: 85000 },
          median: { economy: 55000, premium: 100600, business: 120000 },
        },
        {
          upTo: 11000,
          rates: { economy: 65000, business: 102500 },
          startingAt: { economy: 50000, premium: 85000, business: 85000 },
          median: { economy: 60000, premium: 103100, business: 100000 },
        },
        {
          upTo: Infinity,
          rates: { economy: 70000, business: 115000 },
          startingAt: { economy: 70000, premium: 95000, business: 105000 },
          median: { economy: 75000, premium: 127100, business: 115000 },
        },
      ],
    },
    confidence: "published",
    surcharge: "low",
    pricesWithFeeder: true,
    // Air Canada's own metal prices dynamically off the chart's floor, so a
    // wholly Air Canada itinerary gets no fixed number — but it is still a
    // real way to fly the route, and often the only nonstop.
    dynamicCarriers: ["AC"],
    nonstopCarriers: ["AC"],
    overrides: [
      // Aeroplan prices Toronto–Taipei well below what the distance band
      // implies; EVA sells it as a short-haul-style redemption in practice.
      // This one genuinely contradicts the published chart, so it is flagged.
      { origins: ["YYZ"], destinations: ["TPE"], noteKey: "noteAeroplanYyzTpe", tone: "highlight" },
    ],
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
        asia1: { economy: 35000, premium: 50000, business: 60000 },
        asia2: { economy: 37500, premium: 50000, business: 70000 },
      },
    },
    confidence: "published",
    surcharge: "low",
    pricesWithFeeder: false,
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
        { upTo: 2750, rates: { economy: 9000, premium: 18000, business: 27000 } },
        { upTo: 5000, rates: { economy: 20000, premium: 39000, business: 60000 } },
        { upTo: 7500, rates: { economy: 27000, premium: 52000, business: 91000 } },
        { upTo: Infinity, rates: { economy: 38000, premium: 78000, business: 119000 } },
      ],
    },
    confidence: "unpublished",
    surcharge: "medium",
    pricesWithFeeder: false,
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
    pricesWithFeeder: false,
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
    pricesWithFeeder: false,
    overrides: [
      // Qatar prices its own metal by route rather than by chart. These are
      // simply what those routes cost — normal Privilege Club pricing, not a
      // special case — confirmed from real bookings rather than derived.
      {
        origins: ["YYZ", "YUL"],
        destinations: ["SGN", "HAN", "BKK"],
        hub: "DOH",
        rates: { economy: 47500, business: 95000 },
        noteKey: "noteQatarDohFixed",
      },
    ],
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
    pricesWithFeeder: false,
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
  /** The itinerary opens with an Air Canada domestic hop to reach a gateway. */
  needsFeeder: boolean;
  /** Flown entirely on metal this programme prices dynamically, so there is
   *  no chart figure to show — distinct from a gap in the chart. */
  dynamicPrice: boolean;
  /** What the airline publishes about that dynamic price: the floor it starts
   *  at, and the median members actually paid. Absent when nothing is
   *  published. */
  dynamicFrom?: number;
  dynamicMedian?: number;
  /** True for the option this program would price cheapest. */
  isBest: boolean;
};

export type Quote = {
  program: Program;
  /** The cheapest option's price, or null when nothing can be quoted. */
  points: number | null;
  /** The headline number is a floor on a dynamic fare, not a fixed rate. */
  startingAt: boolean;
  /** Note that applies only to this origin/destination pair, and how loudly
   *  to say it. */
  routeNoteKey?: string;
  routeNoteTone?: "highlight" | "info";
  /** Every routing this program can fly, cheapest first. */
  options: RoutingOption[];
};

/** The cabin being priced. Set for the duration of one quoteRoute call so the
 *  override lookup inside routingOptions can read it without threading an
 *  extra parameter through every pricing model. */
let currentCabin: Cabin = "business";

/** Build every routing a program can actually fly, and price each one.
 *
 *  A routing only exists when both halves are real: the inbound carrier must
 *  reach the hub from Canada, and the onward carrier must serve both the hub
 *  and the destination. That single check is what keeps Qatar out of Da Nang
 *  and Asiana out of Toronto.
 *
 *  `price` turns a list of segment distances into a points total, which is
 *  where the models diverge: one adds the distances up and prices that once,
 *  another ignores distance entirely. */
function routingOptions(
  origin: Airport,
  destination: Airport,
  hubs: HubRoute[],
  price: (segmentMiles: number[]) => Priced,
  pricesWithFeeder: boolean,
  overrides: RouteOverride[] = [],
  dynamicCarriers: string[] = [],
  nonstopCarriers: string[] = [],
  /** What the airline publishes about its own dynamic pricing at a given
   *  distance. Only the distance-banded programmes have anything to say. */
  dynamicGuide: (miles: number) => { from?: number; median?: number } = () => ({})
): RoutingOption[] {
  const options: RoutingOption[] = [];

  // Nonstops the programme can book but no chart covers — Air Canada's own
  // transpacific flying, in practice.
  for (const code of nonstopCarriers) {
    const carrier = CARRIERS[code];
    if (!carrier || !carrier.network.includes(destination.code)) continue;

    const stops: Airport[] = [origin];
    const carriers: Carrier[] = [];
    const needsFeeder = !carrier.gateways.includes(origin.code);
    if (needsFeeder) {
      const gateway = carrier.gateways
        .map((c) => AIRPORTS[c])
        .filter(Boolean)
        .sort(
          (a, b) =>
            greatCircleMiles(origin, a) + greatCircleMiles(a, destination) -
            (greatCircleMiles(origin, b) + greatCircleMiles(b, destination))
        )[0];
      if (!gateway || gateway.code === origin.code) continue;
      stops.push(gateway);
      carriers.push(FEEDER);
    }
    if (carriers.at(-1)?.code !== carrier.code) carriers.push(carrier);
    stops.push(destination);

    const legs = stops.slice(1).map((to, i) => greatCircleMiles(stops[i], to));
    const miles = legs.reduce((sum, m) => sum + m, 0);
    const guide = dynamicGuide(miles);
    options.push({
      routing: stops.map((a) => a.code),
      miles,
      points: null,
      startingAt: false,
      needsFeeder,
      dynamicPrice: true,
      dynamicFrom: guide.from,
      dynamicMedian: guide.median,
      carriers,
      isBest: false,
    });
  }

  for (const route of hubs) {
    const hub = AIRPORTS[route.hub];
    const inbound = CARRIERS[route.inbound];
    const onward = CARRIERS[route.onward];
    if (!hub || !inbound || !onward) continue;
    if (hub.code === origin.code) continue;

    // The inbound carrier has to reach the hub from Canada at all.
    if (!inbound.network.includes(hub.code) || inbound.gateways.length === 0) continue;

    // Onward only matters when the hub is not itself the destination.
    const nonstopToHub = hub.code === destination.code;
    if (!nonstopToHub) {
      if (!onward.network.includes(hub.code)) continue;
      if (!onward.network.includes(destination.code)) continue;
    }

    const stops: Airport[] = [origin];
    const carriers: Carrier[] = [];

    // Where this carrier's own metal can pick you up. From anywhere else the
    // journey really begins with an Air Canada hop, and that distance counts.
    const needsFeeder = !inbound.gateways.includes(origin.code);
    if (needsFeeder) {
      const gateway = inbound.gateways
        .map((code) => AIRPORTS[code])
        .filter(Boolean)
        .sort(
          (a, b) =>
            greatCircleMiles(origin, a) + greatCircleMiles(a, hub) -
            (greatCircleMiles(origin, b) + greatCircleMiles(b, hub))
        )[0];
      if (!gateway || gateway.code === origin.code) continue;
      stops.push(gateway);
      carriers.push(FEEDER);
    }

    if (carriers.at(-1)?.code !== inbound.code) carriers.push(inbound);
    if (!nonstopToHub) {
      stops.push(hub);
      if (onward.code !== inbound.code) carriers.push(onward);
    }
    stops.push(destination);

    const legs = stops.slice(1).map((to, i) => greatCircleMiles(stops[i], to));
    const priced = price(legs);

    // A named real-world rate beats whatever the chart says.
    const override = overrides.find(
      (o) =>
        o.rates &&
        o.origins.includes(origin.code) &&
        o.destinations.includes(destination.code) &&
        (o.hub === undefined || o.hub === hub.code)
    );
    let points = override?.rates ? override.rates[currentCabin] ?? null : priced.points;
    let startingAt = override?.rates ? false : priced.startingAt;

    // Outside Aeroplan, a domestic feeder means the published figure no longer
    // describes what you would actually be charged.
    if (needsFeeder && !pricesWithFeeder) {
      points = null;
      startingAt = false;
    }

    // Flown entirely on metal the programme prices dynamically — the chart
    // never applied to it. Air Canada nonstops to its own Asian hubs land here.
    const allDynamic =
      dynamicCarriers.length > 0 && carriers.every((c) => dynamicCarriers.includes(c.code));
    if (allDynamic) {
      points = null;
      startingAt = false;
    }

    const totalMiles = legs.reduce((sum, m) => sum + m, 0);
    const guide = allDynamic ? dynamicGuide(totalMiles) : {};

    options.push({
      routing: stops.map((a) => a.code),
      miles: totalMiles,
      points,
      startingAt,
      needsFeeder,
      dynamicPrice: allDynamic,
      dynamicFrom: guide.from,
      dynamicMedian: guide.median,
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

  // Two hub routes can produce the same string of airports — Air France to
  // Saigon and Air France handing over to Vietnam Airlines, for instance. Keep
  // whichever survived the sort first; it is the cheaper or simpler of the two.
  //
  // Chart-priced and dynamically-priced flying stay separate even on identical
  // airports, because they are different answers: Vancouver–Tokyo on ANA has a
  // chart rate, the same pair on Air Canada does not, and collapsing them hid
  // the Air Canada option entirely.
  const seen = new Set<string>();
  const unique = options.filter((o) => {
    const key = `${o.routing.join("-")}${o.dynamicPrice ? "|dynamic" : ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length > 0 && unique[0].points !== null) unique[0].isBest = true;
  return unique;
}

/** Price one route in one cabin across every program. Sorted cheapest first,
 *  with the programs that cannot be quoted pushed to the bottom. */
export function quoteRoute(origin: Airport, destination: Airport, cabin: Cabin): Quote[] {
  currentCabin = cabin;

  const quotes: Quote[] = PROGRAMS.map((program) => {
    const { pricesWithFeeder, overrides, dynamicCarriers, nonstopCarriers } = program;
    let options: RoutingOption[];

    switch (program.pricing.kind) {
      case "zone": {
        // The region table sets the price, so every routing costs the same.
        const region = destination.aaRegion ?? "asia2";
        const points = program.pricing.rates[region][cabin] ?? null;
        options = routingOptions(
          origin, destination, program.pricing.hubs,
          () => ({ points, startingAt: false }),
          pricesWithFeeder, overrides, dynamicCarriers, nonstopCarriers
        );
        break;
      }

      case "distance-total": {
        const { bands } = program.pricing;
        options = routingOptions(
          origin, destination, program.pricing.hubs,
          (legs) => bandRate(bands, legs.reduce((sum, m) => sum + m, 0), cabin),
          pricesWithFeeder, overrides, dynamicCarriers, nonstopCarriers,
          (miles) => {
            const band = bands.find((b) => miles <= b.upTo);
            return { from: band?.startingAt?.[cabin], median: band?.median?.[cabin] };
          }
        );
        break;
      }

      case "unquotable":
        options = routingOptions(
          origin, destination, program.pricing.hubs,
          () => ({ points: null, startingAt: false }),
          pricesWithFeeder, overrides, dynamicCarriers, nonstopCarriers
        );
        break;
    }

    const note = overrides?.find(
      (o) =>
        o.noteKey &&
        o.origins.includes(origin.code) &&
        o.destinations.includes(destination.code)
    );

    return {
      program,
      points: options[0]?.points ?? null,
      startingAt: options[0]?.startingAt ?? false,
      routeNoteKey: note?.noteKey,
      routeNoteTone: note?.tone ?? "info",
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
