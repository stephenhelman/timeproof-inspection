// ── DEDICATED BOOK WEBHOOK ROUTE ─────────────────────────────────────────────
// Triggers:
//   qualified_handoff     — qualify bot emitted [QUALIFIED]; book bot opens
//   stall_followup        — 24hr stall follow-up
//   stall_exhausted       — stall expired; move to revival
//   appointment_confirmed — GHL workflow fires after sr_appointment_datetime set
//   inbound_sms           — homeowner reply (srBotStage === 'booking')
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag } from "@/src/lib/ghl-sms";
import {
  transitionLead,
  isOptOut,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getSrLeadFromDb } from "@/src/lib/ghl-custom-object";
import { handleBookWebhook } from "@/src/lib/bot-handlers/book";

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);
  const data = rawBody?.customData ?? rawBody ?? {};
  const ghlContactId: string | null = data.contact_id ?? data.contactId ?? null;
  const trigger: string = data.trigger ?? "inbound_sms";
  const inboundMsg: string = data.message ?? "";

  if (!ghlContactId) {
    console.error(
      "[book] no contact_id in payload",
      JSON.stringify(rawBody).slice(0, 500),
    );
    return new Response("OK", { status: 200 });
  }

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

  const lead = await loadLead(ghlContactId);
  if (!lead) {
    console.warn("[book] no lead for contact", ghlContactId);
    await logWebhookHit({
      source: "ghl_bot_book",
      payload: rawBody,
      success: false,
      error: "lead_not_found",
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  const srLead = await getSrLeadFromDb(lead.id, ghlContactId);
  if (!srLead) {
    console.warn("[book] no SrLead for lead", lead.id);
    await logWebhookHit({
      source: "ghl_bot_book",
      payload: rawBody,
      success: false,
      error: "sr_lead_not_found",
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  if (srLead.srOptedOut || lead.botOptedOut) {
    return new Response("OK", { status: 200 });
  }

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
      { sr_status: "DEAD", sr_bot_stage: "silent", sr_opted_out: true },
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: { botOptedOut: true },
    });
    await logWebhookHit({
      source: "ghl_bot_book",
      payload: rawBody,
      success: true,
      leadId: lead.id,
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  try {
    await handleBookWebhook({ lead, srLead, ghlContactId, trigger, inboundMsg });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[book] uncaught error:", message);
    await logWebhookHit({
      source: "ghl_bot_book",
      payload: rawBody,
      success: false,
      error: message,
      leadId: lead.id,
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  await logWebhookHit({
    source: "ghl_bot_book",
    payload: rawBody,
    success: true,
    leadId: lead.id,
    idempotencyKey,
  });
  return new Response("OK", { status: 200 });
}
