// Maps GHL Revival pipeline stage names to scope reports Lead fields.
// Stage name must match exactly what is configured in GHL.

export const STAGE_MAP: Record<string, Partial<{
  status: string;
  revivalStatus: string;
  revivalOutcome: string;
}>> = {
  "Recovered":        { status: "REVIVAL_RECOVERED" },
  "Refused":          { status: "DEAD" },
  "Drip - Pending":   { revivalStatus: "PENDING" },
  "Drip - Responded": { status: "REVIVAL_PENDING" },
  "Dead":             { status: "DEAD" },
  "Sold":             { status: "SOLD" },
};
