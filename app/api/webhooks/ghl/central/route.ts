// ── CENTRAL GHL WEBHOOK ───────────────────────────────────────────────────────
// THE single activation surface. Every GHL workflow webhook routes here.
//
// §8 (unified handoff): the STAGE (srBotStage on the SrLead) is the single source
// of truth for WHICH bot/mission's turn it is. The `trigger` (customData.trigger)
// only says WHY central was called — it NEVER selects the bot. The resolution is
// the pure ./bot-v2/activation-routing table (resolveActivation); this route just
// runs the resulting ActivationRoute. So every trigger below — inbound_sms, the
// Alex stage handoffs, AND the Jordan *_activate/*_triggered activations — all
// dispatch by stage. A trigger and stage can never disagree about the bot, because
// the trigger is no longer consulted for that decision (§8: "stage wins").
//
// TRIGGERS (all dispatch by STAGE; the trigger is forwarded to the handler only so
// it knows opener-vs-reply):
//   inbound_sms           → homeowner replied — answer in the current stage's bot
//   new_guide_lead        → guide form submitted   (stage nurture   → nurture opener)
//   new_inspection_lead   → new inspection lead     (stage qualifying→ qualify opener)
//   scheduling_approved   → ZIP review approved     (stage qualifying→ qualify)
//   qualified_handoff     → qualify complete        (stage booking   → booking opener)
//   stall_followup        → 24hr stall              (stage booking   → follow up)
//   stall_exhausted       → stall expired           (stage booking   → move to revival)
//   appointment_confirmed → appt datetime set       (stage booking   → create appt)
//   revival_activate / follow_up_triggered      (stage revival    → revival opener)
//   reschedule_activate / reschedule_triggered  (stage reschedule → reschedule opener)
//   finance_activate / credit_fail_triggered    (stage finance    → finance opener)
//
// ONE trigger is examined BEFORE stage routing — NOT as a trigger-based bot
// shortcut, but because it targets a lead the server PARKED in "silent" (after a
// non-finance recovery SOFT_CLOSE), where the stage no longer names a mission:
//   reengage       → proactive per-mission re-engagement (mission + attempt in
//                    customData; the handler re-derives the mission from the lead's
//                    CURRENT stage and uses the hint only as a parked-lead fallback)
// SPRINT 9 (Part A): finance_retry is no longer a pre-stage exception. Finance
// SOFT_CLOSE now moves the opp to the Finance Retry Pending STAGE (srBotStage stays
// "finance"), so finance_retry dispatches by STAGE to the finance mission like
// everything else — the documented §8 finance exception is gone.
//
// SPRINT 8: the universal "nurture_drip" path is REMOVED. Re-engagement is now
// per-mission, context-driven (trigger=reengage), and GHL owns cadence/stop via the
// guard-tag pattern. The B3 *_activate trigger names are accepted as aliases of the
// legacy *_triggered names so the new dumb stage-change activation workflows work.
//
// ── SPRINT 5 — ONE ENGINE FOR ALL SIX MISSIONS ───────────────────────────────
// Every phase now dispatches to a single composed-prompt JSON engine
// (runComposedBotTurn) through its thin bot-handler: Alex owns nurture/qualify/
// book, Jordan owns revival/reschedule/finance. The old inline Jordan logic, the
// dedicated ghl/revival|reschedule|finance routes, and the string-mode regex
// signal parsing (extractSignal / stripAnySignals) are DELETED — there is exactly
// one Jordan implementation now (L1 dissolved). Git is the revert path.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import { transitionLead, isOptOut } from "@/src/lib/bot-engine";
import { crossGuideToInspection } from "@/src/lib/bot-v2/guide-crossing";
import { BOOKING_PENDING_TAG } from "@/src/lib/bot-v2/booking-pending";
import {
  validateWebhookSecret,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getSrLeadFromDb } from "@/src/lib/ghl-custom-object";
import type { Lead, SrLead } from "@prisma/client";
import { handleNurtureWebhook } from "@/src/lib/bot-handlers/nurture";
import { handleQualifyWebhook } from "@/src/lib/bot-handlers/qualify";
import { handleBookWebhook } from "@/src/lib/bot-handlers/book";
import { handleRevivalWebhook } from "@/src/lib/bot-handlers/revival";
import { handleRescheduleWebhook } from "@/src/lib/bot-handlers/reschedule";
import { handleFinanceWebhook } from "@/src/lib/bot-handlers/finance";
import { handleReengageWebhook } from "@/src/lib/bot-handlers/reengage";
import { resolveActivation, type Mission } from "@/src/lib/bot-v2/activation-routing";

// ── Context type ──────────────────────────────────────────────────────────────

interface CentralWebhookContext {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
  // Re-engagement (trigger=reengage) carries the mission + attempt number (Part A).
  mission: string | null;
  attempt: number;
  // §8: sr_dispo_context is a contact field, so GHL returns it with EVERY webhook
  // (Sprint 8 adds it to customData). The durable raw nuance; null until then,
  // in which case the Jordan handlers fall back to the Lead.srDispoContext mirror.
  srDispoContext: string | null;
  // Sprint 9 Part G: sr_guide_context rides every webhook just like sr_dispo_context.
  // "zip_cleared" for a held-then-cleared expansion-zone lead; qualify reads it (with
  // the Lead.srGuideContext mirror as the fallback) to pick its opener.
  srGuideContext: string | null;
  idempotencyKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawBody: any;
}

// The shape every bot-handler takes — one engine, one call signature.
function handlerArgs(ctx: CentralWebhookContext): {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
  srDispoContext: string | null;
  srGuideContext: string | null;
} {
  return {
    lead: ctx.lead,
    srLead: ctx.srLead,
    ghlContactId: ctx.ghlContactId,
    trigger: ctx.trigger,
    inboundMsg: ctx.inboundMsg,
    srDispoContext: ctx.srDispoContext,
    srGuideContext: ctx.srGuideContext,
  };
}

// §8: dispatch by MISSION (which is chosen by STAGE in resolveActivation — never by
// the trigger). One call signature for all six handlers; the trigger rides along in
// handlerArgs so each handler knows opener-vs-reply. Alex owns nurture/qualify/book,
// Jordan owns revival/reschedule/finance — one composed-prompt engine underneath.
async function dispatchMission(
  mission: Mission,
  ctx: CentralWebhookContext,
): Promise<void> {
  const args = handlerArgs(ctx);
  switch (mission) {
    case "nurture":
      return handleNurtureWebhook(args);
    case "qualify":
      return handleQualifyWebhook(args);
    case "book":
      return handleBookWebhook(args);
    case "revival":
      return handleRevivalWebhook(args);
    case "reschedule":
      return handleRescheduleWebhook(args);
    case "finance":
      return handleFinanceWebhook(args);
  }
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Validate secret
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);

  // 2. Parse — ALL fields from customData
  const data = rawBody?.customData ?? rawBody ?? {};
  const ghlContactId: string | null = data.contact_id ?? data.contactId ?? null;
  const trigger: string = data.trigger ?? "inbound_sms";
  const inboundMsg: string = data.message ?? "";
  // Re-engagement params (Part A): the mission whose guard tag fired + the attempt #.
  const mission: string | null = data.mission ?? null;
  const attempt: number = data.attempt ? parseInt(data.attempt) : 1;
  // §8 dispo nuance — rides every webhook once Sprint 8 adds it to customData.
  const srDispoContext: string | null = data.sr_dispo_context ?? null;
  // Sprint 9 Part G guide nuance — rides every webhook (mirrors sr_dispo_context).
  const srGuideContext: string | null = data.sr_guide_context ?? null;

  if (!ghlContactId) {
    console.error(
      "[central] no contact_id in payload",
      JSON.stringify(rawBody).slice(0, 500),
    );
    return new Response("OK", { status: 200 });
  }

  // 3. Idempotency check
  // inbound_sms: key from contactId + message only — duplicate GHL fires produce the same key
  // All other triggers: include timestamp — proactive triggers can legitimately fire multiple times
  const idempotencyKey =
    trigger === "inbound_sms"
      ? createHash("sha256")
          .update(`${ghlContactId}:inbound:${inboundMsg}`)
          .digest("hex")
      : createHash("sha256")
          .update(`${ghlContactId}:${trigger}:${Date.now()}`)
          .digest("hex");

  if (await isDuplicate(idempotencyKey)) {
    return new Response("OK", { status: 200 });
  }

  // 4. Load Lead
  const lead = await loadLead(ghlContactId);
  if (!lead) {
    console.warn("[central] no lead for contact", ghlContactId);
    await logWebhookHit({
      source: "ghl_central",
      payload: rawBody,
      success: false,
      error: "lead_not_found",
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  // 5. Load SrLead (self-heals from GHL if missing)
  const srLead = await getSrLeadFromDb(lead.id, ghlContactId);
  if (!srLead) {
    console.warn("[central] no SrLead for lead", lead.id);
    return new Response("OK", { status: 200 });
  }

  // 6. Check opted out
  if (srLead.srOptedOut || lead.botOptedOut) {
    return new Response("OK", { status: 200 });
  }

  // 7. Opt-out keyword on inbound SMS
  if (trigger === "inbound_sms" && isOptOut(inboundMsg)) {
    await addGhlTag(ghlContactId, "sr_opted_out").catch((e) =>
      console.error(e),
    );
    await transitionLead(
      lead.id,
      ghlContactId,
      null,
      "sr_dead",
      "DEAD",
      "silent",
      {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
        sr_opted_out: true,
      },
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: { botOptedOut: true },
    });
    return new Response("OK", { status: 200 });
  }

  // 7b. Booking Pending reply-exit (Sprint 9 Part B). The bot sends SMS server-side,
  // so GHL has no native "wait for reply" step — reply-detection is server-side and
  // expressed as a tag check. A genuine homeowner inbound means they're no longer
  // silently pending (they're in live conversation), so remove booking_pending. The
  // GHL automation's `goto` then restarts the silence timer; it never nudges an
  // active lead. Best-effort; covers both Inspection and Revival Booking Pending.
  if (trigger === "inbound_sms" && inboundMsg) {
    await removeGhlTag(ghlContactId, BOOKING_PENDING_TAG).catch((e) =>
      console.error("[central] booking_pending reply-exit removal failed:", e),
    );
  }

  // 7c. Zip Confirmed crossing (Sprint 9 Part G). A human reviewer cleared the zip
  // and the held lead entered the Zip Confirmed stage. This is the server-owned
  // Roof Guide → Inspection crossing for a held lead: it SILENTLY sets the held flag
  // + sr_guide_context=zip_cleared (no message — the acknowledgment is the qualify
  // opener) and fires the crossing. A human-added tag/stage entry is a reliable
  // trigger (the §8 "don't trigger on server-added tags" caveat does not apply).
  if (trigger === "zip_confirmed") {
    try {
      await crossGuideToInspection(lead, ghlContactId, { zipCleared: true });
    } catch (err) {
      console.error("[central] zip_confirmed crossing failed:", err);
    }
    await logWebhookHit({ source: "ghl_central", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return new Response("OK", { status: 200 });
  }

  // 8. Route on srBotStage
  const context: CentralWebhookContext = {
    lead,
    srLead,
    ghlContactId,
    trigger,
    inboundMsg,
    mission,
    attempt,
    srDispoContext,
    srGuideContext,
    idempotencyKey,
    rawBody,
  };

  try {
    // §8 dispatch: the trigger says WHY, the STAGE says WHICH bot. resolveActivation
    // is the single, pure decision (unit-tested in harness/activation-routing-test).
    // Every trigger — inbound_sms, Alex stage handoffs, AND the Jordan *_activate /
    // *_triggered activations — resolves to a mission BY STAGE; the trigger is never
    // consulted to pick the bot. The two parked-lead re-engagement triggers
    // (reengage, finance_retry) are handled first ONLY because their lead sits in
    // "silent" and the stage can't name a mission (see activation-routing.ts).
    const route = resolveActivation(trigger, srLead.srBotStage);

    switch (route.kind) {
      case "reengage":
        // Per-mission re-engagement (Part A): GHL's guarded sequence fired. Generate
        // THIS attempt's opener for the lead's CURRENT mission. Composes the mission
        // prompt with a re-engagement task framing; null signal; does NOT touch the
        // heat cooldown clock (outbound, not inbound). The handler re-derives the
        // mission from the lead's stage; `mission` is the parked-lead fallback.
        await handleReengageWebhook({
          lead: context.lead,
          srLead: context.srLead,
          ghlContactId: context.ghlContactId,
          mission: context.mission,
          attempt: context.attempt,
          srDispoContext: context.srDispoContext,
        });
        break;

      case "mission":
        // The §8 happy path: one engine, six missions — Alex stages → Alex persona +
        // mission; Jordan stages → Jordan persona + mission. Chosen entirely by stage.
        await dispatchMission(route.mission, context);
        break;

      case "silent":
        // Lead intentionally inactive — nothing to do.
        break;

      case "unknown":
        console.warn("[central] unknown srBotStage", route.srBotStage);
        break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logWebhookHit({
      source: "ghl_central",
      payload: rawBody,
      success: false,
      error: message,
      leadId: lead.id,
      idempotencyKey,
    });
    // Always 200 — never let GHL retry
    return new Response("OK", { status: 200 });
  }

  await logWebhookHit({
    source: "ghl_central",
    payload: rawBody,
    success: true,
    leadId: lead.id,
    idempotencyKey,
  });
  return new Response("OK", { status: 200 });
}
