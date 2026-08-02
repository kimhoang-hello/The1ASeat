// Ghế 1A's own rough benchmark valuations (CAD cents per point), shown next
// to the user's calculated value for comparison. Update as programs change.
export const POINTS_PROGRAMS = [
  { id: "amex-mr", name: "Amex Membership Rewards", centsPerPoint: 1.8 },
  { id: "rbc-avion", name: "RBC Avion", centsPerPoint: 1.6 },
  { id: "aeroplan", name: "Air Canada Aeroplan", centsPerPoint: 1.9 },
] as const;

export type PointsProgramId = (typeof POINTS_PROGRAMS)[number]["id"];
