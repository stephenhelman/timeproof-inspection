// THE single source of truth for each pipeline's tag set (ARCHITECTURE §12
// Pattern B — "tags are pipeline-scoped working state; crossing a pipeline
// boundary purges them"). Defined in ONE place so every server-owned crossing
// purges a consistent set and no automation ever reads stale cross-pipeline tags.
//
// What lives here: the WITHIN-pipeline working/nuance/guard tags — the ones the
// bot and GHL automations apply DURING a pipeline to gate behavior (booking
// guards, re-engagement guards, soft-close guards). These MUST NOT leak into the
// next pipeline.
//
// What does NOT live here: durable cross-lifecycle context (DB + sr_dispo_context /
// sr_guide_context on the contact) and the crossing REPORTING tags the server adds
// at dispo time (no_show, porched, sr_demo_not_sold, …). Reporting tags record the
// OUTCOME of the crossing and are written AFTER the purge, so they survive — they
// are intentionally absent from these sets.
//
// The purge rule (Part E): in the same atomic transition as a crossing —
//   resolve outgoing opp → purge(outgoing pipeline's tags) → create incoming opp.
// Each crossing purges ONLY the pipeline being LEFT.

import { removeGhlTag } from "@/src/lib/ghl-sms";

// ── Roof Guide pipeline (Alex nurture) working tags ──────────────────────────
export const ROOF_GUIDE_TAGS = [
  "source_free_guide",
  "sr_nurture_reengage",
  "sr_soft_close",
] as const;

// ── Inspection pipeline (Alex qualify/book) working tags ─────────────────────
// CRITICAL (Part B early-exit guard): `sr_appointment_set` is in this set so the
// Inspection→Revival crossing PURGES it. A Jordan recovery lead would otherwise
// carry a stale sr_appointment_set from their prior appointment, and the Booking
// Pending early-exit guard (sr_appointment_set present → exit) would wrongly fire
// before they ever rebooked. The purge is what makes that guard truthful.
export const INSPECTION_TAGS = [
  "sr_qualified",
  "sr_qualifying",
  "sr_booking",
  "booking_pending",
  "sr_appointment_set",
  "sr_cancelled",
  "sr_soft_close",
] as const;

// ── Revival pipeline (Jordan revival/reschedule/finance) working tags ────────
export const REVIVAL_TAGS = [
  "sr_follow_up",
  "sr_revival_reengage",
  "sr_reschedule_reengage",
  "sr_finance_reengage",
  "sr_finance_ready",
  "sr_credit_fail",
  "sr_rebooked",
  "sr_rebook_soft",
  "sr_rescheduled",
  "booking_pending",
  "sr_soft_close",
] as const;

export type Pipeline = "roof_guide" | "inspection" | "revival";

// The tag set for a pipeline (the set purged when LEAVING it).
export function pipelineTagSet(pipeline: Pipeline): readonly string[] {
  switch (pipeline) {
    case "roof_guide":
      return ROOF_GUIDE_TAGS;
    case "inspection":
      return INSPECTION_TAGS;
    case "revival":
      return REVIVAL_TAGS;
  }
}

// Purge the LEFT pipeline's tag set from a contact. Best-effort per tag (a missing
// tag is not an error); never throws so a crossing's atomic DB work is never rolled
// back by a GHL tag hiccup. Returns the tags it attempted to remove (for logging).
export async function purgePipelineTags(
  ghlContactId: string,
  pipeline: Pipeline,
): Promise<readonly string[]> {
  const tags = pipelineTagSet(pipeline);
  await Promise.allSettled(
    tags.map((t) =>
      removeGhlTag(ghlContactId, t).catch((e) =>
        console.error(`[pipeline-tags] purge ${pipeline} tag "${t}" failed:`, e),
      ),
    ),
  );
  return tags;
}
