// THE single source of truth for the sr_dispo_context vocabulary (ARCHITECTURE
// §8). sr_dispo_context is the ONE generalized contact field that carries the
// nuance of "how it happened" — scoped by the lead's current mission STAGE. The
// dispo handler WRITES exactly these strings; the Jordan mission handlers READ
// them and derive their Conversation fields from (stage + sr_dispo_context).
//
// One field, scoped by stage — a lead is in exactly one mission at a time, so it
// needs exactly one nuance value at a time. Empty/null is safe: only missions
// that need it read it, and an Alex (never-dispo'd) lead has none.
//
//   Reschedule stage           → no_show | door | soft | simple
//   Demo-Not-Sold/Revival stage → think_about_it | price | urgency | insurance | other
//   Finance stage              → the objection that led there, or empty
//
// These are a FIXED vocabulary. Do not let them drift — change here, in one
// place, and both the writer (dispo) and readers (Jordan) move together.

// ── Reschedule-stage context ────────────────────────────────────────────────
export const RESCHEDULE_DISPO_CONTEXT = ["no_show", "door", "soft", "simple"] as const;
export type RescheduleDispoContext = (typeof RESCHEDULE_DISPO_CONTEXT)[number];

// ── Revival-stage (demo-not-sold) context — mirrors the dispo objection list ──
// `booking_stall` (Sprint 9 Part D) is the non-commitment context the server writes
// when an Inspection Booking Pending lead EXHAUSTS (Alex first-booking, never picked
// a time) and crosses to Revival. Jordan's opener excavates "you qualified but
// something's holding you back from a time — what is it really?"
export const REVIVAL_DISPO_CONTEXT = [
  "think_about_it",
  "price",
  "urgency",
  "insurance",
  "other",
  "booking_stall",
] as const;
export type RevivalDispoContext = (typeof REVIVAL_DISPO_CONTEXT)[number];

// Finance-stage context: the objection string that led to the decline, or empty
// (the stage itself says "finance"). No fixed enum — free objection or "".

// ── Reschedule sub-case derivation ──────────────────────────────────────────
//
// The reschedule handler derives Conversation.rescheduleSubCase from
// sr_dispo_context. Note the door→porched_door, soft→porched_soft mapping: the
// rep-set Porched toggle (door vs soft) becomes the structured sub-case, replacing
// the old infer-from-freeform-notes heuristic. Returns null when the context is
// not a reschedule-stage value (caller falls back to the legacy heuristic).
export function rescheduleSubCaseFromDispoContext(
  ctx: string | null | undefined,
): "no_show" | "porched_door" | "porched_soft" | "simple" | null {
  switch (ctx) {
    case "no_show":
      return "no_show";
    case "door":
      return "porched_door";
    case "soft":
      return "porched_soft";
    case "simple":
      return "simple";
    default:
      return null;
  }
}
