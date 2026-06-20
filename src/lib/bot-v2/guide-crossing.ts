// THE server-owned Roof Guide → Inspection crossing (Sprint 9 Part E item 1 + Part
// G). This REPLACES GHL workflow 02's opp-creation role: the server now evaluates
// the crossing, performs the §12 Pattern B purge, marks the Guide opp won, and
// creates the Inspection opp — so all three pipeline crossings have ONE owner with a
// uniform purge.
//
// The crossing requires bot-qualified AND zip-approved (the join in Part E):
//   - in-area lead (zip auto-approved)      → cross immediately, NO guide context.
//   - expansion-zone lead (manual zip review needed) → HOLD: send the service-area
//     string, move to Zip Review, do NOT cross. The commitment was already captured
//     by the NEPQ pullback (which precedes this), so the hold lands on an invested
//     lead. On manual clearance the Zip Confirmed stage entry fires the crossing with
//     zipCleared=true (Part G step 5/6).
//
// Critical ordering (enforced in the mission, not here): the NEPQ structured pullback
// is UNIVERSAL and comes FIRST; the service-area check is a POST-commitment gate.

import { prisma } from "@/src/lib/prisma";
import { transitionLead } from "@/src/lib/bot-engine";
import { getZipTier } from "@/src/lib/service-zones";
import {
  resolveGhlOpportunity,
  createGhlOpportunity,
  moveGhlOpportunityStage,
  writeGhlContactCustomField,
} from "@/src/lib/ghl-contacts";
import { sendGhlSms } from "@/src/lib/ghl-sms";
import { writeSystemFields } from "@/src/lib/conversation";
import { purgePipelineTags } from "@/src/lib/bot-v2/pipeline-tags";
import { GUIDE_CONTEXT } from "@/src/lib/bot-v2/guide-context";
import type { Lead } from "@prisma/client";

// The fixed service-area string the held (expansion-zone) lead receives (Part G
// step 4). Kept in Alex's voice; the pullback/commitment is the model's job and has
// already happened by the time this fires.
export const SERVICE_AREA_HOLD_MESSAGE =
  "Before we get you on the schedule, let me make sure you're in our service area — " +
  "I'll check with my team real quick and be right back.";

// Pure decision: does a QUALIFIED guide lead cross now (in-area) or hold for manual
// zip review (expansion / unknown)? Mirrors the legacy routeQualifiedLead tiering.
// Takes the already-resolved zip (see handleGuideQualified for the field resolution —
// a guide lead's zip lives on Lead.zip, NOT Lead.sourceZip).
export function guideQualifiedDecision(zip: string | null | undefined): "cross" | "hold" {
  const tier = zip ? getZipTier(zip) : "out_of_area";
  return tier === "primary" ? "cross" : "hold";
}

// Perform the Guide→Inspection crossing: resolve Guide opp WON → purge Roof Guide
// tags → (optionally set zip-cleared context) → create Inspection opp at New Lead →
// transition to the qualify mission. GHL fires the qualify opener (new_inspection_lead)
// on the New Lead stage entry; qualify reads sr_guide_context to pick its opener.
export async function crossGuideToInspection(
  lead: Lead,
  ghlContactId: string,
  opts: { zipCleared: boolean },
): Promise<void> {
  // 1. resolve the Guide opp WON (Roof Guide pipeline's attributable win = nurture
  //    converted a cold lead to qualified).
  const guideOppId = lead.ghlOpportunityId;
  if (guideOppId && process.env.GHL_STAGE_QUALIFIED) {
    await resolveGhlOpportunity(guideOppId, process.env.GHL_STAGE_QUALIFIED, "won").catch((e) =>
      console.error("[guide-crossing] resolve Guide opp (won) failed:", e),
    );
  }

  // 2. PURGE the Roof Guide tag set (§12 Pattern B) — the Inspection pipeline starts
  //    with a fresh nuance track.
  await purgePipelineTags(ghlContactId, "roof_guide");

  // 3. Zip-cleared context (Part G step 5): set the held flag + sr_guide_context
  //    SILENTLY (no message — the acknowledgment is the qualify opener, step 7).
  if (opts.zipCleared) {
    await writeSystemFields(
      ghlContactId,
      { zipWasHeld: true },
      { currentPhase: "qualify", leadId: lead.id },
    ).catch((e) => console.error("[guide-crossing] writeSystemFields(zipWasHeld) failed:", e));
    await prisma.lead
      .update({ where: { id: lead.id }, data: { srGuideContext: GUIDE_CONTEXT.ZIP_CLEARED } })
      .catch(() => null);
    if (process.env.GHL_FIELD_SR_GUIDE_CONTEXT) {
      await writeGhlContactCustomField(
        ghlContactId,
        process.env.GHL_FIELD_SR_GUIDE_CONTEXT,
        GUIDE_CONTEXT.ZIP_CLEARED,
      ).catch((e) => console.error("[guide-crossing] sr_guide_context write failed:", e));
    }
  }

  // 4. CREATE the Inspection opp at New Lead and point the lead at it.
  if (process.env.GHL_PIPELINE_INSPECTION && process.env.GHL_STAGE_NEW_LEAD) {
    try {
      const inspectionOppId = await createGhlOpportunity({
        ghlContactId,
        contactName: lead.customerName ?? "Homeowner",
        pipelineId: process.env.GHL_PIPELINE_INSPECTION,
        pipelineStageId: process.env.GHL_STAGE_NEW_LEAD,
        sourceName: "inspection:from_guide",
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { ghlOpportunityId: inspectionOppId } });
    } catch (e) {
      console.error("[guide-crossing] create Inspection opp at New Lead failed:", e);
    }
  }

  // 5. Transition DB → qualify mission (srBotStage "qualifying") + sync Conversation
  //    phase. GHL fires new_inspection_lead on the New Lead stage entry → qualify
  //    sends its (zip-aware) opener.
  await transitionLead(
    lead.id,
    ghlContactId,
    "source_free_guide",
    "sr_qualifying",
    lead.status,
    "qualifying",
    { sr_bot_stage: "qualifying", sr_qualify_status: "pending" },
    "QUALIFIED",
  );
}

// nurture QUALIFIED entry point: in-area → cross now; expansion/unknown → hold for
// manual zip review (send the service-area string, move to Zip Review). Injectable
// sendSms mirrors the handler seam (harness passes a no-op).
export async function handleGuideQualified(
  lead: Lead,
  ghlContactId: string,
  deps: { sendSms?: (ghlContactId: string, message: string) => Promise<void> } = {},
): Promise<"cross" | "hold"> {
  const sendSms = deps.sendSms ?? sendGhlSms;
  // Resolve the zip the SAME way intake/from-guide do: a guide-origin lead carries
  // the gate-form zip on Lead.zip, and Lead.sourceZip is only set by the inspection/
  // facebook/waitlist paths. Reading sourceZip alone made EVERY guide lead resolve to
  // out_of_area → manual zip review, even in-area ones (the auto-approve bug).
  const zip = lead.sourceZip?.trim() || lead.zip?.trim() || null;
  const decision = guideQualifiedDecision(zip);

  if (decision === "cross") {
    await crossGuideToInspection(lead, ghlContactId, { zipCleared: false });
    return "cross";
  }

  // HOLD (Part G step 4): the commitment is already captured; add the service-area
  // string and move to Zip Review. Do NOT cross — the zip_confirmed trigger fires
  // the crossing on manual clearance.
  await sendSms(ghlContactId, SERVICE_AREA_HOLD_MESSAGE).catch((e) =>
    console.error("[guide-crossing] hold message failed:", e),
  );
  if (lead.ghlOpportunityId && process.env.GHL_STAGE_ZIP_REVIEW) {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_ZIP_REVIEW).catch((e) =>
      console.error("[guide-crossing] move→Zip Review failed:", e),
    );
  }
  return "hold";
}
