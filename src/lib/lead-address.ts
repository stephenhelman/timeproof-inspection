// Canonical "do we already know this lead's address" resolution.
//
// A Lead carries the address in two places: the bot-collected `address` (set by the
// book bot when the homeowner gives it over SMS) and the gate-form/canonical
// components `streetAddress/city/state` (written at intake — e.g. a guide lead). The
// bot-collected field is NULL until book runs, so for a guide-origin lead the durable
// address lives only in the components. This resolves the best known address from
// either, mirroring the resolution the appointment service already uses
// (appointment-service.ts) so a re-engagement/booking read-seed names the SAME
// address the appointment would.
//
// Returns null unless we have at least a STREET — a partial "City, ST" is not enough
// to skip asking, and seeding it would make the model think it has the full address.
export function resolveLeadAddress(lead: {
  address?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  const botCollected = lead.address?.trim();
  if (botCollected) return botCollected;

  const street = lead.streetAddress?.trim();
  if (!street) return null;

  return [street, lead.city?.trim(), lead.state?.trim()].filter(Boolean).join(", ");
}
