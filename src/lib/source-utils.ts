// ─────────────────────────────────────────────────────────────
// SOURCE RESOLUTION
// Resolves full sr_source value from base source + action.
//
// Base sources (from localStorage / URL param):
//   facebook-guide, facebook-inspection,
//   card, door, organic
//
// Actions:
//   'guide'       → homeowner submitted the roof guide form
//   'inspection'  → homeowner submitted an inspection request
//
// Final values:
//   facebook-guide        (already has action embedded)
//   facebook-inspection   (already has action embedded)
//   card-guide
//   card-inspection
//   door-guide
//   door-inspection
//   organic-guide
//   organic-inspection
//   manual
// ─────────────────────────────────────────────────────────────

const VALID_BASES = [
  "facebook-guide",
  "facebook-inspection",
  "card",
  "door",
  "organic",
  "manual",
];

export function resolveSource(
  rawSource: string | null | undefined,
  action: "guide" | "inspection"
): string {
  const base = (rawSource ?? "organic").toLowerCase().trim();

  // Already fully qualified — Facebook sources come in complete
  if (base === "facebook-guide" || base === "facebook-inspection") {
    return base;
  }

  // Manual — no action suffix
  if (base === "manual") return "manual";

  // Known base — append action
  if (VALID_BASES.includes(base)) {
    return `${base}-${action}`;
  }

  // Unknown — default to organic + action
  return `organic-${action}`;
}
