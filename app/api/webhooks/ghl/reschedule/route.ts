// Trigger: sr_rescheduled tag added to a GHL contact.
// Fired when the homeowner texts to reschedule after receiving a confirmation.
// The bot collects their preferred time and calls /api/lead/[id]/reschedule.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  isOptOut,
  getAvailableSlots,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  parseInboundSms,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";

function buildRescheduleSystemPrompt(leadName: string, slots: { label: string }[]): string {
  const slotStr = slots.map((s) => s.label).join(" | ");
  return `You are Alex, a scheduling assistant for Qntum Roofing.
The homeowner wants to reschedule their roof inspection.
Your job is to find a new time that works for them.
Available slots: ${slotStr || "checking availability now"}
Guidelines:
Offer the slots naturally, not as a numbered list
Keep messages to 2-3 sentences
When they confirm a time, repeat it back and end with [RESCHEDULED: YYYY-MM-DD HH:MM]
If none of the times work, say you'll check for more options and end with [CHECK_MORE_SLOTS]
Never mention zones, geography, or scheduling constraints
Lead name: ${leadName}`;
}

function stripSignals(text: string): string {
  return text
    .replace(/\[RESCHEDULED:[^\]]*\]/g, "")
    .replace(/\[CHECK_MORE_SLOTS\]/g, "")
    .trim();
}

function extractRescheduledSignal(text: string): { date: Date; time: string } | null {
  const match = text.match(/\[RESCHEDULED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/);
  if (!match) return null;
  const [, dateStr, time] = match;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { date: new Date(year, month - 1, day, hour, minute, 0, 0), time };
}

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  let rawBody: unknown = null;
  try { rawBody = await request.json(); } catch { /* fall through */ }

  const parsed = parseInboundSms(rawBody);
  if (!parsed) return NextResponse.json({ ok: true, warning: "unparseable_payload" });

  const { ghlContactId, inboundMessage, idempotencyKey } = parsed;

  if (await isDuplicate(idempotencyKey)) return NextResponse.json({ ok: true, duplicate: true });

  const lead = await loadLead(ghlContactId);
  if (!lead) {
    await logWebhookHit({ source: "ghl_bot_reschedule", payload: rawBody, success: false, error: "lead_not_found", idempotencyKey });
    return NextResponse.json({ ok: true, warning: "lead_not_found" });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: "opted_out" });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, "sr_opted_out");
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: "ghl_bot_reschedule", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const zone = lead.sourceZip ? getZoneForZip(lead.sourceZip) : null;
    const distanceZone = zone ? isDistanceZone(zone) : false;
    const slots = await getAvailableSlots(zone ?? "el_paso_central", distanceZone);

    const { id: threadId, messages } = await getOrCreateThread(ghlContactId, "reschedule");

    if (!messages || messages.length === 0) {
      const opener = await runBot(
        buildRescheduleSystemPrompt(lead.customerName, slots),
        [{ role: "user" as const, content: "reschedule_triggered", timestamp: new Date().toISOString() }]
      );
      if (opener !== null) {
        const clean = stripSignals(opener);
        await sendGhlSms(ghlContactId, clean);
        await appendMessage(threadId, "assistant", opener);
      }
      if (!inboundMessage || inboundMessage === "reschedule_triggered") {
        await logWebhookHit({ source: "ghl_bot_reschedule", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    await appendMessage(threadId, "user", inboundMessage);

    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];
    const botMessages = currentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(buildRescheduleSystemPrompt(lead.customerName, slots), botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: "ghl_bot_reschedule", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const rescheduledSignal = extractRescheduledSignal(rawResponse);
    const smsText = stripSignals(rawResponse);
    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, "assistant", rawResponse);

    if (rescheduledSignal) {
      const { date } = rescheduledSignal;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: "INSPECTION_SCHEDULED",
          appointmentDate: date,
          rescheduleReason: "homeowner_request",
        },
      });
      const inspection = await prisma.inspection.findFirst({
        where: { leadId: lead.id, status: "scheduled" },
        orderBy: { createdAt: "desc" },
      });
      if (inspection) {
        await prisma.inspection.update({ where: { id: inspection.id }, data: { appointmentAt: date } });
      }
    }

    await logWebhookHit({ source: "ghl_bot_reschedule", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reschedule bot] uncaught error:", message);
    await logWebhookHit({ source: "ghl_bot_reschedule", payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
