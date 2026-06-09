// ── CENTRAL GHL WEBHOOK ───────────────────────────────────────────────────────
// All GHL workflow webhooks route here.
// Routing is determined by srBotStage on the SrLead DB record.
// The trigger field (from customData.trigger) determines what to do in that stage.
//
// TRIGGERS:
//   inbound_sms           → homeowner replied — run bot conversation
//   new_guide_lead        → guide form submitted — send nurture opener
//   new_inspection_lead   → new inspection lead — send qualify opener
//   scheduling_approved   → ZIP review approved — activate qualify
//   qualified_handoff     → qualify complete — send booking opener
//   stall_followup        → 24hr stall — fetch slots, follow up
//   stall_exhausted       → stall expired — move to revival
//   nurture_drip          → soft-close drip — send drip message
//   follow_up_triggered   → revival activation
//   reschedule_triggered  → reschedule activation
//   credit_fail_triggered → finance activation
//   finance_retry         → 7-day finance retry
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
import { addGhlTag } from "@/src/lib/ghl-sms";
import { transitionLead, isOptOut } from "@/src/lib/bot-engine";
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

// ── Context type ──────────────────────────────────────────────────────────────

interface CentralWebhookContext {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
  dripPosition: number | null;
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
} {
  return {
    lead: ctx.lead,
    srLead: ctx.srLead,
    ghlContactId: ctx.ghlContactId,
    trigger: ctx.trigger,
    inboundMsg: ctx.inboundMsg,
  };
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
  const dripPosition: number | null = data.drip_position
    ? parseInt(data.drip_position)
    : null;

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

  // 8. Route on srBotStage
  const context: CentralWebhookContext = {
    lead,
    srLead,
    ghlContactId,
    trigger,
    inboundMsg,
    dripPosition,
    idempotencyKey,
    rawBody,
  };

  try {
    // Named ACTIVATION triggers — always return early, bypass srBotStage routing.
    // Each routes through the same composed-prompt engine as inbound_sms; the
    // handler sets the appropriate recovery context (affordabilityIsReal,
    // rescheduleSubCase, …) before running the turn.
    switch (trigger) {
      case "inbound_sms":
        // Route based on srBotStage as normal
        break;

      case "follow_up_triggered":
        await handleRevivalWebhook(handlerArgs(context));
        return new Response("OK", { status: 200 });

      case "reschedule_triggered":
        await handleRescheduleWebhook(handlerArgs(context));
        return new Response("OK", { status: 200 });

      case "credit_fail_triggered":
      case "finance_retry":
        await handleFinanceWebhook(handlerArgs(context));
        return new Response("OK", { status: 200 });

      default:
        // Unknown trigger — fall through to srBotStage routing
        break;
    }

    // inbound_sms and unknown triggers: route on srBotStage. One engine, six
    // missions — Alex stages → Alex persona + mission; Jordan stages → Jordan
    // persona + mission.
    switch (srLead.srBotStage) {
      case "nurture":
        await handleNurtureWebhook({
          lead: context.lead,
          srLead: context.srLead,
          ghlContactId: context.ghlContactId,
          trigger: context.trigger,
          inboundMsg: context.inboundMsg,
          dripPosition: context.dripPosition,
        });
        break;
      case "qualifying":
        await handleQualifyWebhook(handlerArgs(context));
        break;
      case "booking":
        await handleBookWebhook(handlerArgs(context));
        break;
      case "revival":
        await handleRevivalWebhook(handlerArgs(context));
        break;
      case "reschedule":
        await handleRescheduleWebhook(handlerArgs(context));
        break;
      case "finance":
        await handleFinanceWebhook(handlerArgs(context));
        break;
      case "silent":
        break;
      default:
        console.warn("[central] unknown srBotStage", srLead.srBotStage);
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
