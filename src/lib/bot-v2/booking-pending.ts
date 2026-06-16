// Booking Pending — Pattern A applied to booking (ARCHITECTURE §12), with the
// lifecycle-aware exhaustion routing of Sprint 9 Part D as DATA (pure, testable),
// mirroring planDispo / resolveActivation.
//
// The mechanism is shared across both pipelines — a lead offered times goes quiet,
// the server moves the opp to a Booking Pending STAGE, a GHL automation nudges on
// each silence checkpoint, and an UNANSWERED nudge increments a CUMULATIVE counter.
// What differs is only the EXHAUSTION DESTINATION, which depends on WHERE the lead
// is in their lifecycle (which the pipeline tells you):
//   - inspection (Alex first-booking, never picked a first time) → cross to Revival
//     with sr_dispo_context=booking_stall (one failure, real recovery value).
//   - revival   (Jordan rebooking, failed to commit AGAIN)       → Exhausted stage
//     (DORMANT — recovery spent for now, NOT hard-dead).
//
// The bot adds the `booking_pending` tag when it offers times; the inbound handler
// removes it on reply (the reply-exit). The counter is the seriousness metric and
// feeds the future serial-no-show signal — so it is CUMULATIVE, never reset on a
// re-stall.

import { INSPECTION_TAGS, type Pipeline } from "@/src/lib/bot-v2/pipeline-tags";

// The waiting-state tag the bot adds when it offers times. A normal pending state
// (awaiting commitment), NOT a failure — hence `pending`, not `stall`.
export const BOOKING_PENDING_TAG = "booking_pending";

// Exhaust after N unanswered nudges. More robust than fixed elapsed time and
// slow-responder-safe (a reply restarts the silence timer but an unanswered nudge
// still increments the count). Tunable; start at 3.
export const BOOKING_PENDING_MAX_ATTEMPTS = 3;

// Which Booking Pending STAGE the opp moves to on stall, by pipeline. Reads env at
// call time so test/runtime envs apply (same convention as planDispo).
export function bookingPendingStage(pipeline: "inspection" | "revival"): string | undefined {
  return pipeline === "inspection"
    ? process.env.GHL_STAGE_BOOKING_PENDING_INSPECTION
    : process.env.GHL_STAGE_BOOKING_PENDING_REVIVAL;
}

// Cumulative-attempts exhaustion test. The counter is never reset on re-stall, so
// a serial almost-books-then-bails lead exhausts faster.
export function bookingPendingExhausted(attempts: number): boolean {
  return attempts >= BOOKING_PENDING_MAX_ATTEMPTS;
}

// The lifecycle-aware exhaustion routing plan (Part D). Pure: reads env stage ids
// at call time, no side effects. The handler executes it (resolve → purge → create
// for the inspection crossing; resolve → move-to-Exhausted for the revival case).
export interface BookingExhaustionPlan {
  pipeline: "inspection" | "revival";
  // The pipeline being LEFT, whose tags the crossing purges (Pattern B). For the
  // dormant-Exhausted case there is no pipeline crossing (the lead stays in Revival),
  // so this is null and no purge happens.
  purgePipeline: Pipeline | null;
  purgeTags: readonly string[] | null;
  // Inspection → Revival crossing (one failure, real recovery value).
  crossToRevival: boolean;
  revivalStage?: string;          // resolved env stage VALUE for the new Revival opp
  srDispoContext?: string | null; // "booking_stall" — the non-commitment nuance
  botStage?: string;              // new srBotStage after the crossing
  // Revival → Exhausted (dormant, NOT hard-dead).
  toExhausted: boolean;
  exhaustedStage?: string;        // resolved env stage VALUE
  dormant?: boolean;              // true = dormant (resurface-able), never hard-dead
  exitSignal: string;             // recorded in Conversation.phaseHistory[].exitSignal
}

export function planBookingExhaustion(pipeline: "inspection" | "revival"): BookingExhaustionPlan {
  if (pipeline === "inspection") {
    // Alex first-booking exhausted: mark Inspection opp LOST → purge Inspection
    // tags → create Revival opp at Follow-Up Active with booking_stall context.
    return {
      pipeline,
      purgePipeline: "inspection",
      purgeTags: INSPECTION_TAGS,
      crossToRevival: true,
      revivalStage: process.env.GHL_STAGE_FOLLOW_UP_ACTIVE,
      srDispoContext: "booking_stall",
      botStage: "revival",
      toExhausted: false,
      exitSignal: "BOOKING_EXHAUSTED_INSPECTION",
    };
  }
  // Jordan rebooking exhausted AGAIN: mark Revival opp LOST → move to Exhausted
  // (dormant). No pipeline crossing (stays in Revival), so no tag purge. Hard-dead
  // is reserved for opt-out/compliance — exhaustion is dormant and resurface-able.
  return {
    pipeline,
    purgePipeline: null,
    purgeTags: null,
    crossToRevival: false,
    toExhausted: true,
    exhaustedStage: process.env.GHL_STAGE_EXHAUSTED,
    dormant: true,
    botStage: "silent",
    exitSignal: "BOOKING_EXHAUSTED_REVIVAL",
  };
}

// Map a lead's current mission/phase to the Booking-Pending pipeline. Alex's book
// mission is the Inspection pipeline; Jordan's recovery missions are Revival.
export function bookingPipelineForPhase(phase: string): "inspection" | "revival" {
  return phase === "book" || phase === "booking" || phase === "qualify" || phase === "qualifying"
    ? "inspection"
    : "revival";
}
