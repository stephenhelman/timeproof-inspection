// ============================================================
// SUPERSEDED by central webhook route
// app/api/webhooks/ghl/central/route.ts
//
// This route is preserved for reference and emergency fallback.
// GHL workflows should point to /api/webhooks/ghl/central
// Remove this file after central webhook is confirmed stable.
// ============================================================

// Trigger: sr_booking tag added to GHL contact (qualified_handoff),
//          or inbound SMS while tag is active,
//          or stall_followup from GHL 24hr workflow.

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
import { getZoneForZip, SERVICE_ZONES, isDistanceZone } from "@/src/lib/service-zones";
import { assembleBookPrompt } from "@/src/lib/prompts/qntum/assemblers/book";
import type { BookContext, BookLastMessageContext } from "@/src/lib/prompts/qntum/types";

type BotMessage = { role: string; content: string; timestamp: string };

function detectBookLastMessageContext(message: string): BookLastMessageContext {
  if (!message) return 'none';
  const t = message.toLowerCase().trim();

  if (/speak (to|with) (someone|a person|manager)|call me|want a human/.test(t) ||
    /that('s| is) (ridiculous|unacceptable)|waste of (my )?time/.test(t))
    return 'escalation_needed';

  if (/check (with|my|the)|need to (ask|check|see)|have to (check|see|ask)|schedule|busy|can't (do it|commit)|not sure (yet|about)/.test(t))
    return 'stall';

  if (/^(yes|yeah|yep|sure|confirmed|that works|perfect|ok|okay|sounds good|let'?s do it)\.?$/.test(t) ||
    /that work(s)?|confirmed|all set|book it|let'?s do|go ahead/.test(t))
    return 'confirmed';

  if (/can('t| not)|won't work|not (available|free|good)|different (time|day)|other (time|day)|prefer|earlier|later/.test(t))
    return 'slot_rejected';

  return 'none';
}

function stripSignals(text: string): string {
  return text
    .replace(/\[BOOKED:[^\]]*\]/g, '')
    .replace(/\[CHECK_MORE_SLOTS\]/g, '')
    .replace(/\[SLOT_CONFLICT\]/g, '')
    .replace(/\[STALL\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .trim();
}

function extractBookedSignal(text: string): { date: Date; time: string } | null {
  const match = text.match(/\[BOOKED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/);
  if (!match) return null;
  const [, dateStr, time] = match;
  const timezone = process.env.BOT_TIMEZONE ?? 'America/Denver';
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  // The signal uses Mountain Time wall-clock values. Convert to UTC for DB storage.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzOffset = ((): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(guess);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    return h * 60 + m - (hour * 60 + minute);
  })();
  return { date: new Date(guess.getTime() - tzOffset * 60 * 1000), time };
}

function buildConfirmationSms(datetime: Date): string {
  const tz = process.env.BOT_TIMEZONE ?? 'America/Denver';
  const dayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
  }).format(datetime);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  }).format(datetime);
  return `You're all set — got you down for ${dayLabel} at ${timeLabel.toLowerCase()}. Our inspector will reach out the morning of with a heads up.`;
}

function buildRepNotification(
  lead: { customerName: string; phone: string | null; id: string },
  datetime: Date,
  zone: string | null
): string {
  const tz = process.env.BOT_TIMEZONE ?? 'America/Denver';
  const zoneMeta = zone ? SERVICE_ZONES[zone] : null;
  const dayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
  }).format(datetime);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  }).format(datetime);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.scopereports.com';
  return (
    `New inspection booked!\n` +
    `Homeowner: ${lead.customerName}\n` +
    `Date/Time: ${dayLabel} at ${timeLabel.toLowerCase()}\n` +
    `Zone:      ${zoneMeta?.label ?? zone ?? 'unknown'}\n` +
    `Phone:     ${lead.phone ?? 'not on file'}\n` +
    `${appUrl}/leads/${lead.id}`
  );
}

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  let rawBody: unknown = null;
  try { rawBody = await request.json(); } catch { /* fall through */ }

  const parsed = parseInboundSms(rawBody);
  if (!parsed) return NextResponse.json({ ok: true, warning: 'unparseable_payload' });

  const { ghlContactId, inboundMessage, idempotencyKey } = parsed;

  if (await isDuplicate(idempotencyKey)) return NextResponse.json({ ok: true, duplicate: true });

  const lead = await loadLead(ghlContactId);
  if (!lead) {
    await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: false, error: 'lead_not_found', idempotencyKey });
    return NextResponse.json({ ok: true, warning: 'lead_not_found' });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: 'opted_out' });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, 'sr_opted_out');
      await transitionLead(lead.id, ghlContactId, 'sr_booking', 'sr_dead', 'DEAD', 'silent', {
        sr_status: 'DEAD', sr_bot_stage: 'silent', sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    if (isCancellation(inboundMessage)) {
      const activeInspection = await prisma.inspection.findFirst({
        where: { leadId: lead.id, status: 'scheduled' },
      });
      if (activeInspection) {
        await prisma.inspection.update({
          where: { id: activeInspection.id },
          data: { status: 'cancelled', repNotes: 'Cancelled by homeowner via SMS before inspection' },
        });
        await transitionLead(lead.id, ghlContactId, 'sr_booking', 'sr_cancelled', 'DEMO_NOT_SOLD', 'silent', {
          sr_status: 'DEMO_NOT_SOLD', sr_bot_stage: 'silent',
        });
        const fn = lead.customerName.trim().split(/\s+/)[0];
        await sendGhlSms(ghlContactId, `No problem, ${fn}. We've cancelled your inspection. If things change, reach out anytime.`);
        await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    await purgeExpiredSlotLocks();

    const leadZone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? null) : null;
    const distanceZone = leadZone ? isDistanceZone(leadZone) : false;
    const zone = leadZone ?? 'el_paso_central';

    const existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });

    let rawSlots: Array<{ date: string; time: string; label: string }> = [];
    if (!existingLock || inboundMessage === 'qualified_handoff' || inboundMessage === 'stall_followup') {
      rawSlots = await getAvailableSlots(zone, distanceZone, 'any');
      if (rawSlots.length > 0) {
        const [y, m, d] = rawSlots[0].date.split('-').map(Number);
        await createSlotLock({ date: new Date(y, m - 1, d), time: rawSlots[0].time, zone, leadId: lead.id });
      }
    }

    const { id: threadId, messages } = await getOrCreateThread(ghlContactId, 'book');

    // Determine trigger type
    type Trigger = BookContext['trigger'];
    const triggerMap: Record<string, Trigger> = {
      qualified_handoff: 'qualified_handoff',
      stall_followup: 'stall_followup',
    };
    const trigger: Trigger = triggerMap[inboundMessage] ?? 'inbound_sms';

    // Build BookContext
    const lockedSlotRaw = existingLock
      ? { date: existingLock.date?.toString() ?? '', time: existingLock.time ?? '', label: rawSlots[0]?.label ?? '' }
      : null;

    const knownIssues = Array.isArray(lead.knownIssues) ? (lead.knownIssues as string[]) : [];
    const activeIssues = knownIssues.filter(i => i !== "I haven't noticed anything");

    // Reload messages
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const lastUserMsg = [...currentMessages].reverse().find(m => m.role === 'user');

    const context: BookContext = {
      bot_type: 'book',
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source_zip: lead.sourceZip ?? '',
      zone: leadZone ?? '',
      message_history_count: currentMessages.length,
      last_message_context: detectBookLastMessageContext(lastUserMsg?.content ?? inboundMessage),
      available_slots: rawSlots.map(s => ({ date: s.date, time: s.time, label: s.label, zone_label: zone })),
      locked_slot: lockedSlotRaw,
      qualify_summary: {
        problem_confirmed: activeIssues.length > 0,
        specific_issue: activeIssues[0]?.toLowerCase() ?? null,
        roof_age: lead.roofAge ?? null,
        decision_maker_confirmed: lead.decisionMakerHome === 'Yes',
      },
      trigger,
      address_collected:  false,
      confirmed_address:  null,
      time_preference:    'any',
    };

    const systemPrompt = assembleBookPrompt(context);

    // For qualified_handoff — run with empty messages (proactive opener)
    if (trigger === 'qualified_handoff' && (messages.length === 0)) {
      const openerMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> = [
        { role: 'user', content: 'qualified_handoff', timestamp: new Date().toISOString() },
      ];
      const openerRaw = await runBot(systemPrompt, openerMessages);
      if (openerRaw !== null) {
        const openerClean = stripSignals(openerRaw);
        await sendGhlSms(ghlContactId, openerClean);
        await appendMessage(threadId, 'assistant', openerRaw);
      }
      await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // Append inbound message
    if (inboundMessage && !['qualified_handoff', 'stall_followup'].includes(inboundMessage)) {
      await appendMessage(threadId, 'user', inboundMessage);
    }

    // Stall followup — run with synthetic trigger
    if (trigger === 'stall_followup') {
      const stalledThread = await prisma.botThread.findUnique({ where: { id: threadId } });
      const stalledMessages = (stalledThread?.messages as BotMessage[]) ?? [];
      const botMessages = stalledMessages.map(m => ({
        role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
      }));
      botMessages.push({ role: 'user', content: 'stall_followup', timestamp: new Date().toISOString() });
      const rawResponse = await runBot(systemPrompt, botMessages);
      if (rawResponse !== null) {
        const smsText = stripSignals(rawResponse);
        await sendGhlSms(ghlContactId, smsText);
        await appendMessage(threadId, 'assistant', rawResponse);
        if (rawResponse.includes('[STALL]')) {
          await addGhlTag(ghlContactId, 'booking_stall_exhausted');
          await addGhlTag(ghlContactId, 'sr_follow_up');
        }
      }
      await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // Normal inbound reply
    const reloadedThread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
    const botMessages = reloadedMessages.map(m => ({
      role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const bookedSignal = extractBookedSignal(rawResponse);
    const checkMore = rawResponse.includes('[CHECK_MORE_SLOTS]');
    const stall = rawResponse.includes('[STALL]');

    if (bookedSignal) {
      const { date, time } = bookedSignal;
      const validation = await validateSlotBeforeConfirm(lead.id, date, time, zone);

      if (!validation.ok) {
        const newSlots = await getAvailableSlots(zone, distanceZone, 'any');
        const freshContext: BookContext = { ...context, available_slots: newSlots.map(s => ({ date: s.date, time: s.time, label: s.label, zone_label: zone })) };
        const retryResponse = await runBot(assembleBookPrompt(freshContext), botMessages);
        const cleanRetry = stripSignals(retryResponse ?? '');
        await sendGhlSms(ghlContactId, cleanRetry);
        if (retryResponse) await appendMessage(threadId, 'assistant', retryResponse);
      } else {
        const slotLabel = context.locked_slot?.label ?? '';
        await confirmBooking(lead.id, ghlContactId, date, slotLabel);
        await transitionLead(lead.id, ghlContactId, 'sr_booking', 'sr_appointment_set', 'INSPECTION_SCHEDULED', 'silent', {
          sr_status: 'INSPECTION_SCHEDULED', sr_appointment_at: date.toISOString(), sr_bot_stage: 'silent',
        });
        if (lead.assignedUserId) {
          const repMsg = buildRepNotification({ customerName: lead.customerName, phone: lead.phone, id: lead.id }, date, leadZone);
          await notifyRep(lead.assignedUserId, lead.id, repMsg);
        }
        const confirmMsg = slotLabel
          ? `You're all set — got you down for ${slotLabel}. Our inspector will reach out the morning of with a heads up. See you then!`
          : buildConfirmationSms(date);
        await sendGhlSms(ghlContactId, confirmMsg);
        await appendMessage(threadId, 'assistant', rawResponse);
      }
    } else if (stall) {
      const smsText = stripSignals(rawResponse);
      await sendGhlSms(ghlContactId, smsText);
      await appendMessage(threadId, 'assistant', rawResponse);
      await addGhlTag(ghlContactId, 'booking_stall');
    } else if (checkMore) {
      const smsText = stripSignals(rawResponse);
      await sendGhlSms(ghlContactId, smsText);
      await appendMessage(threadId, 'assistant', rawResponse);
    } else {
      const smsText = stripSignals(rawResponse);
      await sendGhlSms(ghlContactId, smsText);
      await appendMessage(threadId, 'assistant', rawResponse);
    }

    await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[book] uncaught error:', message);
    await logWebhookHit({ source: 'ghl_bot_book', payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
