import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isOptOut,
  isCancellation,
  purgeExpiredSlotLocks,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  confirmBooking,
  notifyRep,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  parseInboundSms,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { SERVICE_ZONES, isDistanceZone } from "@/src/lib/service-zones";

type Slot = { date: string; time: string; label: string };

function buildBookingSystemPrompt(leadName: string, slots: Slot[]): string {
  const slotStr = slots.map((s) => s.label).join(" | ");
  return `You are Alex, a scheduling assistant for Qntum Roofing.
The homeowner has already been qualified and is ready to book
their free roof inspection.
Your only job is to find a time that works for them.
Available slots: ${slotStr || "checking for availability now"}
Guidelines:

Offer the slots naturally, not as a numbered list
If none of the offered times work, say you'll check for more
options and end your message with [CHECK_MORE_SLOTS]
When they confirm a time, repeat it back clearly and end with
[BOOKED: YYYY-MM-DD HH:MM] (use 24h time in the signal)
If a slot is no longer available, apologize naturally and
offer alternatives — end with [SLOT_CONFLICT]
Keep messages short — 2-3 sentences max
Never explain why certain times aren't available
Never mention geography, zones, or scheduling constraints

Lead name: ${leadName}`;
}

function stripSignals(text: string): string {
  return text
    .replace(/\[BOOKED:[^\]]*\]/g, "")
    .replace(/\[CHECK_MORE_SLOTS\]/g, "")
    .replace(/\[SLOT_CONFLICT\]/g, "")
    .trim();
}

function extractBookedSignal(text: string): { date: Date; time: string } | null {
  const match = text.match(/\[BOOKED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/);
  if (!match) return null;
  const [, dateStr, time] = match;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return { date, time };
}

function buildConfirmationSms(datetime: Date, zone: string | null): string {
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  const zoneMeta = zone ? SERVICE_ZONES[zone] : null;
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: tz,
  }).format(datetime);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
  }).format(datetime);
  void zoneMeta; // zone label used in rep notification, not homeowner SMS
  return (
    `You're all set! Your inspection is confirmed for ${dayLabel} at ${timeLabel.toLowerCase()}.\n` +
    `Our inspector will reach out the morning of with a heads up. See you then!`
  );
}

function buildRepNotification(
  lead: { customerName: string; phone: string | null; id: string },
  datetime: Date,
  zone: string | null
): string {
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  const zoneMeta = zone ? SERVICE_ZONES[zone] : null;
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: tz,
  }).format(datetime);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
  }).format(datetime);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
  return (
    `New inspection booked!\n` +
    `Homeowner: ${lead.customerName}\n` +
    `Date/Time: ${dayLabel} at ${timeLabel.toLowerCase()}\n` +
    `Zone:      ${zoneMeta?.label ?? zone ?? "unknown"}\n` +
    `Phone:     ${lead.phone ?? "not on file"}\n` +
    `${appUrl}/leads/${lead.id}`
  );
}

export async function POST(request: NextRequest) {
  // 1. Validate secret
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  // 2. Parse body
  let rawBody: unknown = null;
  try { rawBody = await request.json(); } catch { /* fall through */ }

  const parsed = parseInboundSms(rawBody);
  if (!parsed) {
    return NextResponse.json({ ok: true, warning: "unparseable_payload" });
  }

  const { ghlContactId, inboundMessage, idempotencyKey } = parsed;

  // 3. Idempotency check
  if (await isDuplicate(idempotencyKey)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 4. Load lead
  const lead = await loadLead(ghlContactId);
  if (!lead) {
    console.warn(`[book] no lead found for ghlContactId=${ghlContactId}`);
    await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: false, error: "lead_not_found", idempotencyKey });
    return NextResponse.json({ ok: true, warning: "lead_not_found" });
  }

  try {
    // 5. DND / opted-out check
    if (lead.botOptedOut) {
      return NextResponse.json({ ok: true, skipped: "opted_out" });
    }

    // 6. Opt-out keyword
    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, "sr_opted_out");
      await transitionLead(lead.id, ghlContactId, "sr_booking", "sr_dead", "DEAD", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
        sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // 7. Cancellation check
    if (isCancellation(inboundMessage)) {
      const activeInspection = await prisma.inspection.findFirst({
        where: { leadId: lead.id, status: "scheduled" },
      });
      if (activeInspection) {
        await prisma.inspection.update({
          where: { id: activeInspection.id },
          data: { status: "cancelled", repNotes: "Cancelled by homeowner via SMS before inspection" },
        });
        await transitionLead(lead.id, ghlContactId, "sr_booking", "sr_cancelled", "DEMO_NOT_SOLD", {
          sr_status: "DEMO_NOT_SOLD",
          sr_bot_stage: "silent",
        });
        const fn = lead.customerName.trim().split(/\s+/)[0];
        await sendGhlSms(
          ghlContactId,
          `No problem, ${fn}. We've cancelled your inspection. If things change, reach out anytime.`
        );
        await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    // 8. Purge expired slot locks
    await purgeExpiredSlotLocks();

    // 9. Load or create thread
    const { id: threadId, messages } = await getOrCreateThread(ghlContactId, "book");

    // 10. Append inbound
    await appendMessage(threadId, "user", inboundMessage);

    // 11. Check last assistant message for pending signals
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const hasCheckMore = lastAssistant?.content?.includes("[CHECK_MORE_SLOTS]");
    const hasConflict = lastAssistant?.content?.includes("[SLOT_CONFLICT]");

    // 12. Get available slots if no active lock or if CHECK_MORE_SLOTS/SLOT_CONFLICT
    const leadZone = lead.sourceZip
      ? (await import("@/src/lib/service-zones")).getZoneForZip(lead.sourceZip)
      : null;
    const distanceZone = leadZone ? isDistanceZone(leadZone) : false;

    const existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });
    let slots: Slot[] = [];

    if (!existingLock || hasCheckMore || hasConflict) {
      slots = await getAvailableSlots(leadZone ?? "el_paso_central", distanceZone);
      if (slots.length > 0) {
        const [dateStr, time, zone] = [slots[0].date, slots[0].time, leadZone ?? "el_paso_central"];
        const [y, m, d] = dateStr.split("-").map(Number);
        await createSlotLock({ date: new Date(y, m - 1, d), time, zone, leadId: lead.id });
      }
    }

    // 13. Build system prompt
    const systemPrompt = buildBookingSystemPrompt(lead.customerName, slots);

    // Reload messages
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];

    // 14. Run bot
    const botMessages = currentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    const rawResponse = await runBot(systemPrompt, botMessages);

    // 15. Null = escalated — notification already sent by bot-engine
    if (rawResponse === null) {
      await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const bookedSignal = extractBookedSignal(rawResponse);
    const checkMore = rawResponse.includes("[CHECK_MORE_SLOTS]");
    const slotConflict = rawResponse.includes("[SLOT_CONFLICT]");

    if (bookedSignal) {
      const { date, time } = bookedSignal;
      const zone = leadZone ?? "el_paso_central";
      const validation = await validateSlotBeforeConfirm(lead.id, date, time, zone);

      if (!validation.ok) {
        // Re-offer slots
        const newSlots = await getAvailableSlots(zone, distanceZone);
        const newSystemPrompt = buildBookingSystemPrompt(lead.customerName, newSlots);
        const retryResponse = await runBot(newSystemPrompt, botMessages);
        const cleanRetry = stripSignals(retryResponse ?? "");
        await sendGhlSms(ghlContactId, cleanRetry);
        if (retryResponse) await appendMessage(threadId, "assistant", retryResponse);
      } else {
        // Confirm booking
        await confirmBooking(lead.id, ghlContactId, date);
        await transitionLead(
          lead.id,
          ghlContactId,
          "sr_booking",
          "sr_appointment_set",
          "INSPECTION_SCHEDULED",
          {
            sr_status: "INSPECTION_SCHEDULED",
            sr_appointment_at: date.toISOString(),
            sr_bot_stage: "silent",
          }
        );

        // Notify rep
        if (lead.assignedUserId) {
          const repMsg = buildRepNotification(
            { customerName: lead.customerName, phone: lead.phone, id: lead.id },
            date,
            leadZone
          );
          await notifyRep(lead.assignedUserId, lead.id, repMsg);
        }

        // Confirmation SMS to homeowner
        const confirmSms = buildConfirmationSms(date, leadZone);
        await sendGhlSms(ghlContactId, confirmSms);
        await appendMessage(threadId, "assistant", rawResponse);
        await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    } else if (checkMore || slotConflict) {
      // Re-fetch and re-offer — response already handles messaging
      const cleanResponse = stripSignals(rawResponse);
      await sendGhlSms(ghlContactId, cleanResponse);
      await appendMessage(threadId, "assistant", rawResponse);
    } else {
      // Normal conversational response
      const cleanResponse = stripSignals(rawResponse);
      await sendGhlSms(ghlContactId, cleanResponse);
      await appendMessage(threadId, "assistant", rawResponse);
    }

    await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[book] uncaught error:", message);
    await logWebhookHit({ source: "ghl_bot_book", payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
