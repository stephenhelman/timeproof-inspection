// THE single authoritative definition of the model-authored / system-authored
// seam (ARCHITECTURE.md §5 + §7). Every piece of code that needs to know which
// Conversation fields the model may write — the harness engine's stateDelta
// filter AND the DB write layer's applyModelStateDelta — imports from here.
//
// One source of truth. If a field's authorship changes, it changes in exactly
// one place. This file is intentionally Prisma-free so the Sprint 0 harness can
// import it without pulling in the database client.

// MODEL-AUTHORED — the model emits these in the contract's `state` block and
// owns them (ARCHITECTURE §5). This is the ALLOWLIST: applyModelStateDelta
// accepts only these and silently drops everything else.
export const MODEL_AUTHORED_FIELDS = [
  "nepqPhase",
  "consequenceSurfaced",
  "gateProblem",
  "gateDecisionMaker",
  "motivation",
  "urgency",
  "objectionsSurfaced",
  "primaryObjection",
  "decisionMakers",
  "timePrefs",
  "address",
  "selectedSlot",
  "summary",
] as const;

// SYSTEM-AUTHORED — written ONLY by app code (stage changes, GHL payloads, heat
// eval, rep-note derivation, lead creation). The model is structurally incapable
// of writing these: they are not in the allowlist above, so applyModelStateDelta
// drops them. Listed explicitly so writeSystemFields can type its input and so
// the seam test can assert these specific fields never leak through the model
// path (ARCHITECTURE §7 "authorship seam").
export const SYSTEM_AUTHORED_FIELDS = [
  // routing / phase
  "currentPhase",
  "phaseHistory",
  // source
  "sourceType",
  "sourceChannel",
  "funnelConcerns",
  "repName",
  // recovery context
  "consequenceLikelySurfaced",
  "affordabilityIsReal",
  "rescheduleSubCase",
  "daysSinceAppointment",
  // heat / tier selection
  "heatState",
  "heatLastInbound",
  "heatPeakReached",
  // booking / zip timed-stage hygiene (Sprint 9)
  "bookingPendingAttempts",
  "zipWasHeld",
  // meta
  "lastSignal",
  "lastModelTier",
  // identity / linkage
  "leadId",
] as const;

export type ModelAuthoredField = (typeof MODEL_AUTHORED_FIELDS)[number];
export type SystemAuthoredField = (typeof SYSTEM_AUTHORED_FIELDS)[number];

const MODEL_AUTHORED_SET: ReadonlySet<string> = new Set(MODEL_AUTHORED_FIELDS);
const SYSTEM_AUTHORED_SET: ReadonlySet<string> = new Set(SYSTEM_AUTHORED_FIELDS);

export function isModelAuthored(field: string): boolean {
  return MODEL_AUTHORED_SET.has(field);
}

export function isSystemAuthored(field: string): boolean {
  return SYSTEM_AUTHORED_SET.has(field);
}

/**
 * The seam, as a pure function: keep only model-authored keys from an arbitrary
 * object, dropping everything else (system-authored fields, unknown junk, DB-
 * managed columns). Returns the kept subset AND the dropped keys so callers can
 * log/assert what was rejected. This is the structural guarantee that replaces
 * the old fragile "preserve and enrich, never overwrite" prompt instruction.
 */
export function partitionStateDelta(delta: Record<string, unknown>): {
  modelAuthored: Record<string, unknown>;
  droppedKeys: string[];
} {
  const modelAuthored: Record<string, unknown> = {};
  const droppedKeys: string[] = [];
  for (const key of Object.keys(delta)) {
    if (MODEL_AUTHORED_SET.has(key)) modelAuthored[key] = delta[key];
    else droppedKeys.push(key);
  }
  return { modelAuthored, droppedKeys };
}
