// Sprint 9 — timed-event stages, universal booking, tag hygiene, server-owned
// crossings. Pure-logic test (no DB, no GHL) of the new decision modules, mirroring
// dispo-routing-test / activation-routing-test.
//
//   npm run sprint9:test
//
// Proves the testable cores of every part:
//   - Pattern B: each pipeline's tag set is defined in one place; the Inspection set
//     includes sr_appointment_set (so the purge makes the Booking Pending early-exit
//     guard truthful) and booking_pending; a crossing purges ONLY the left pipeline.
//   - Pattern A / Part D: cumulative-attempts exhaustion; lifecycle-aware routing
//     (inspection → Revival w/ booking_stall; revival → Exhausted dormant).
//   - Part A: dispo crossings declare the Inspection purge; finance retry stage.
//   - Part G: sr_guide_context vocabulary + the zip-aware qualify opener selection.
//
// Exit code is non-zero if any assertion fails.

// Stage env the pure planners read at call time (same convention as planDispo).
process.env.GHL_STAGE_FOLLOW_UP_ACTIVE ??= "stage_follow_up_active";
process.env.GHL_STAGE_EXHAUSTED ??= "stage_exhausted";
process.env.GHL_STAGE_BOOKING_PENDING_INSPECTION ??= "stage_booking_pending_inspection";
process.env.GHL_STAGE_BOOKING_PENDING_REVIVAL ??= "stage_booking_pending_revival";

import {
  ROOF_GUIDE_TAGS,
  INSPECTION_TAGS,
  REVIVAL_TAGS,
  pipelineTagSet,
} from "@/src/lib/bot-v2/pipeline-tags";
import {
  BOOKING_PENDING_TAG,
  BOOKING_PENDING_MAX_ATTEMPTS,
  bookingPendingExhausted,
  bookingPendingStage,
  planBookingExhaustion,
  bookingPipelineForPhase,
} from "@/src/lib/bot-v2/booking-pending";
import {
  GUIDE_CONTEXT,
  isZipCleared,
  qualifyOpenerKind,
  qualifyOpenerInstruction,
} from "@/src/lib/bot-v2/guide-context";
import { REVIVAL_DISPO_CONTEXT } from "@/src/lib/bot-v2/dispo-context";
import { planDispo, type DispoPlan } from "@/src/lib/bot-v2/dispo-plan";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    pass++;
    console.log(`  [PASS] ${label}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(t: string): void {
  console.log(`\n${"─".repeat(70)}\n  ${t}\n${"─".repeat(70)}`);
}
function plan(outcome: Parameters<typeof planDispo>[0], fork: Record<string, unknown> = {}): DispoPlan {
  const p = planDispo(outcome, fork);
  if ("error" in p) throw new Error(`unexpected planDispo error: ${p.error}`);
  return p;
}

// ── Part B / Pattern B — pipeline tag sets + purge scoping ────────────────────
section("Pattern B — pipeline tag sets (purge targets the LEFT pipeline only)");
check("ROOF_GUIDE_TAGS is non-empty", ROOF_GUIDE_TAGS.length > 0);
check("INSPECTION_TAGS includes sr_appointment_set (makes the early-exit guard truthful)", INSPECTION_TAGS.includes("sr_appointment_set"));
check("INSPECTION_TAGS includes booking_pending", INSPECTION_TAGS.includes("booking_pending"));
check("REVIVAL_TAGS includes booking_pending", REVIVAL_TAGS.includes("booking_pending"));
check("REVIVAL_TAGS includes the rebook flags", REVIVAL_TAGS.includes("sr_rebooked") && REVIVAL_TAGS.includes("sr_rebook_soft"));
check("pipelineTagSet(inspection) === INSPECTION_TAGS", pipelineTagSet("inspection") === INSPECTION_TAGS);
check("pipelineTagSet(revival) === REVIVAL_TAGS", pipelineTagSet("revival") === REVIVAL_TAGS);
check("pipelineTagSet(roof_guide) === ROOF_GUIDE_TAGS", pipelineTagSet("roof_guide") === ROOF_GUIDE_TAGS);
// The purge purges ONLY the left set — Inspection purge must NOT name a purely-Revival tag.
check("Inspection purge does NOT remove sr_follow_up (a Revival-only tag)", !(INSPECTION_TAGS as readonly string[]).includes("sr_follow_up"));
check("Revival purge does NOT remove sr_qualified (an Inspection-only tag)", !(REVIVAL_TAGS as readonly string[]).includes("sr_qualified"));

// ── Part B — booking_pending tag rename + cumulative exhaustion ───────────────
section("Part B — booking_pending tag + cumulative attempts exhaustion");
check("the waiting tag is booking_pending (renamed from booking_stall)", BOOKING_PENDING_TAG === "booking_pending");
check(`exhaustion threshold N = ${BOOKING_PENDING_MAX_ATTEMPTS}`, BOOKING_PENDING_MAX_ATTEMPTS >= 1);
check("attempts below N → not exhausted", !bookingPendingExhausted(BOOKING_PENDING_MAX_ATTEMPTS - 1));
check("attempts == N → exhausted", bookingPendingExhausted(BOOKING_PENDING_MAX_ATTEMPTS));
check("attempts > N (cumulative, never reset) → still exhausted", bookingPendingExhausted(BOOKING_PENDING_MAX_ATTEMPTS + 5));
check("bookingPendingStage(inspection) resolves the Inspection stage", bookingPendingStage("inspection") === process.env.GHL_STAGE_BOOKING_PENDING_INSPECTION);
check("bookingPendingStage(revival) resolves the Revival stage", bookingPendingStage("revival") === process.env.GHL_STAGE_BOOKING_PENDING_REVIVAL);
check("book mission → inspection pipeline", bookingPipelineForPhase("book") === "inspection");
check("revival mission → revival pipeline", bookingPipelineForPhase("revival") === "revival");
check("reschedule mission → revival pipeline", bookingPipelineForPhase("reschedule") === "revival");

// ── Part D — lifecycle-aware exhaustion routing ───────────────────────────────
section("Part D — lifecycle-aware exhaustion routing");
const insp = planBookingExhaustion("inspection");
check("inspection exhaustion → crosses to Revival", insp.crossToRevival === true);
check("inspection exhaustion → NOT toExhausted", insp.toExhausted === false);
check("inspection exhaustion → revivalStage = Follow-Up Active", insp.revivalStage === process.env.GHL_STAGE_FOLLOW_UP_ACTIVE);
check("inspection exhaustion → sr_dispo_context = booking_stall", insp.srDispoContext === "booking_stall");
check("inspection exhaustion → botStage revival", insp.botStage === "revival");
check("inspection exhaustion → purges the Inspection tag set", insp.purgePipeline === "inspection" && insp.purgeTags === INSPECTION_TAGS);

const rev = planBookingExhaustion("revival");
check("revival exhaustion → Exhausted stage", rev.toExhausted === true && rev.exhaustedStage === process.env.GHL_STAGE_EXHAUSTED);
check("revival exhaustion → DORMANT, never hard-dead", rev.dormant === true);
check("revival exhaustion → does NOT cross to Revival again", rev.crossToRevival === false);
check("revival exhaustion → no pipeline crossing, so no purge", rev.purgePipeline === null && rev.purgeTags === null);
check("booking_stall is a valid Revival context (so Jordan can seed the excavation)", (REVIVAL_DISPO_CONTEXT as readonly string[]).includes("booking_stall"));

// ── Part E / Pattern B — dispo crossings declare the Inspection purge ─────────
section("Part E — dispo crossings declare purgePipeline = inspection (resolve→purge→create)");
check("no_show → purge inspection", plan("no_show").purgePipeline === "inspection");
check("porched → purge inspection", plan("porched", { porchedContext: "door" }).purgePipeline === "inspection");
check("demo_not_sold (objection) → purge inspection", plan("demo_not_sold", { dispoPrimaryObjection: "price" }).purgePipeline === "inspection");
check("finance_decline → purge inspection", plan("demo_not_sold", { dispoPrimaryObjection: "finance_decline" }).purgePipeline === "inspection");
check("reschedule office → purge inspection", plan("reschedule", { reschedulePath: "office" }).purgePipeline === "inspection");
check("SOLD → no crossing, no purge", plan("sold").purgePipeline === null);
check("Book Now → no crossing, no purge", plan("reschedule", { reschedulePath: "manual" }).purgePipeline === null);

// ── Part G — sr_guide_context vocabulary + zip-aware qualify opener ───────────
section("Part G — zip hold: sr_guide_context + qualify opener selection");
check("GUIDE_CONTEXT.ZIP_CLEARED === 'zip_cleared'", GUIDE_CONTEXT.ZIP_CLEARED === "zip_cleared");
check("isZipCleared('zip_cleared') → true", isZipCleared("zip_cleared"));
check("isZipCleared(null) → false (empty is safe)", !isZipCleared(null));
check("qualifyOpenerKind(zip_cleared) → zip_cleared", qualifyOpenerKind("zip_cleared") === "zip_cleared");
check("qualifyOpenerKind(empty) → normal", qualifyOpenerKind(null) === "normal");
const heldOpener = qualifyOpenerInstruction("zip_cleared");
const normalOpener = qualifyOpenerInstruction(null);
check("held opener mentions 'good news' + 'service your area'", /good news/i.test(heldOpener) && /service your area/i.test(heldOpener));
check("normal opener is the source-aware opener (no zip acknowledgment)", !/good news/i.test(normalOpener) && /source-aware/i.test(normalOpener));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(70)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log("═".repeat(70));
if (fail > 0) process.exit(1);
