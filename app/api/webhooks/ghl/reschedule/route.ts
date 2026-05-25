// Trigger: sr_reschedule tag added to GHL contact.
// Also covers booking_stall_exhausted leads routed here instead of revival.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isOptOut,
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
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";
import { assembleReschedulePrompt } from "@/src/lib/prompts/qntum/assemblers/reschedule";
import type {
  RescheduleContext,
  RescheduleReason,
  RescheduleLastMessageContext,
} from "@/src/lib/prompts/qntum/types";

type BotMessage = { role: string; content: string; timestamp: string };

function detectRescheduleLastMessageContext(message: string): RescheduleLastMessageContext {
  if (!message) return 'none';
  const t = message.toLowerCase().trim();

  if (/speak (to|with) (someone|manager)|call me|want a human/.test(t)) return 'escalation_needed';
  if (/not (going to|gonna|want to)|don't want|no thanks|not interested|forget it/.test(t)) return 'wont_rebook';
  if (/check (with|my)|need to (ask|check|see)|not sure yet/.test(t)) return 'stall';
  if (/can('t| not)|won't work|not (available|good)|different (time|day)/.test(t)) return 'slot_rejected';
  if (/^(yes|yeah|sure|ok|okay|confirmed|that works|perfect|sounds good)\.?$/.test(t) ||
    /that work|confirmed|book it|let'?s do|go ahead/.test(t)) return 'confirmed';

  return 'none';
}

function stripSignals(text: string): string {
  return text
    .replace(/\[RESCHEDULED:[^\]]*\]/g, '')
    .replace(/\[CHECK_MORE_SLOTS\]/g, '')
    .replace(/\[RE_QUALIFY\]/g, '')
    .replace(/\[DEAD\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .trim();
}

function extractRescheduledSignal(text: string): { date: Date; time: string } | null {
  const match = text.match(/\[RESCHEDULED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/);
  if (!match) return null;
  const [, dateStr, time] = match;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { date: new Date(year, month - 1, day, hour, minute, 0, 0), time };
}

function extractSignal(text: string): 'RESCHEDULED' | 'RE_QUALIFY' | 'DEAD' | 'CHECK_MORE_SLOTS' | 'ESCALATE' | null {
  if (text.includes('[ESCALATE]')) return 'ESCALATE';
  if (/\[RESCHEDULED:/.test(text)) return 'RESCHEDULED';
  if (text.includes('[RE_QUALIFY]')) return 'RE_QUALIFY';
  if (text.includes('[DEAD]')) return 'DEAD';
  if (text.includes('[CHECK_MORE_SLOTS]')) return 'CHECK_MORE_SLOTS';
  return null;
}

function buildConfirmationSms(datetime: Date): string {
  const tz = process.env.BOT_TIMEZONE ?? 'America/Denver';
  const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(datetime);
  const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(datetime);
  return `You're all set — got you down for ${dayLabel} at ${timeLabel.toLowerCase()}. Our inspector will reach out the morning of with a heads up.`;
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
    await logWebhookHit({ source: 'ghl_bot_reschedule', payload: rawBody, success: false, error: 'lead_not_found', idempotencyKey });
    return NextResponse.json({ ok: true, warning: 'lead_not_found' });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: 'opted_out' });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, 'sr_opted_out');
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: 'ghl_bot_reschedule', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? null) : null;
    const zoneStr = zone ?? 'el_paso_central';
    const distanceZone = zone ? isDistanceZone(zone) : false;
    const rawSlots = await getAvailableSlots(zoneStr, distanceZone);

    if (rawSlots.length > 0) {
      const existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });
      if (!existingLock) {
        const [y, m, d] = rawSlots[0].date.split('-').map(Number);
        await createSlotLock({ date: new Date(y, m - 1, d), time: rawSlots[0].time, zone: zoneStr, leadId: lead.id });
      }
    }

    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, 'reschedule');

    const lastInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
    });
    const inspectionFindings =
      lastInspection?.findingsNotes ??
      (lastInspection?.diagnosis ? JSON.stringify(lastInspection.diagnosis) : null);

    const rawLead = lead as unknown as Record<string, unknown>;
    const threadMeta = (await prisma.botThread.findUnique({ where: { id: threadId } }))?.metadata as Record<string, unknown> ?? {};
    const has_pivoted = Boolean(threadMeta.hasPivotedToRevival);

    const from_booking_stall = String(rawLead.rescheduleReason ?? '').includes('booking_stall') ||
      (rawLead.ghlTags as string[] | undefined)?.includes('booking_stall_exhausted') ?? false;

    const rawReason = (rawLead.rescheduleReason as string) ?? 'other';
    const validReasons: RescheduleReason[] = [
      'cancelled_by_homeowner', 'one_legger', 'time_constraint', 'porched',
      'rep_schedule_conflict', 'weather', 'booking_stall_exhausted', 'other',
    ];
    const reschedule_reason: RescheduleReason = validReasons.includes(rawReason as RescheduleReason)
      ? rawReason as RescheduleReason
      : from_booking_stall ? 'booking_stall_exhausted' : 'other';

    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const buildContext = (msgs: BotMessage[], lastMsg: string): RescheduleContext => ({
      bot_type: 'reschedule',
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source_zip: lead.sourceZip ?? '',
      zone: zone ?? '',
      message_history_count: msgs.length,
      last_message_context: detectRescheduleLastMessageContext(lastMsg),
      available_slots: rawSlots.map(s => ({ date: s.date, time: s.time, label: s.label, zone_label: zoneStr })),
      locked_slot: rawSlots[0] ? { date: rawSlots[0].date, time: rawSlots[0].time, label: rawSlots[0].label } : null,
      reschedule_reason,
      inspection_completed: inspectionFindings !== null,
      inspection_findings: inspectionFindings,
      prior_outcome: (rawLead.dispoPrimaryObjection as string | null) ?? null,
      dispo_notes: (rawLead.dispoNotes as string | null) ?? null,
      from_booking_stall,
      has_pivoted_to_revival: has_pivoted,
    });

    // Proactive opener for new thread
    if (isNew || messages.length === 0) {
      const ctx = buildContext([], 'reschedule_triggered');
      const systemPrompt = assembleReschedulePrompt(ctx);
      const openerRaw = await runBot(systemPrompt, [
        { role: 'user', content: 'reschedule_triggered', timestamp: new Date().toISOString() },
      ]);
      if (openerRaw !== null) {
        await sendGhlSms(ghlContactId, stripSignals(openerRaw));
        await appendMessage(threadId, 'assistant', openerRaw);
      }
      if (!inboundMessage || inboundMessage === 'reschedule_triggered') {
        await logWebhookHit({ source: 'ghl_bot_reschedule', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    if (inboundMessage && inboundMessage !== 'reschedule_triggered') {
      await appendMessage(threadId, 'user', inboundMessage);
    }

    const reloadedThread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];

    const context = buildContext(reloadedMessages, inboundMessage);
    const systemPrompt = assembleReschedulePrompt(context);

    const botMessages = reloadedMessages.map(m => ({
      role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: 'ghl_bot_reschedule', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const smsText = stripSignals(rawResponse);
    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, 'assistant', rawResponse);

    // Mark pivot in thread metadata if pivoting
    if (signal === 'RE_QUALIFY' || signal === 'DEAD') {
      if (!has_pivoted) {
        await prisma.botThread.update({
          where: { id: threadId },
          data: { metadata: { ...threadMeta, hasPivotedToRevival: true } },
        });
      }
    }

    if (signal === 'RESCHEDULED') {
      const rescheduled = extractRescheduledSignal(rawResponse);
      if (rescheduled) {
        const validation = await validateSlotBeforeConfirm(lead.id, rescheduled.date, rescheduled.time, zoneStr);
        if (validation.ok) {
          await confirmBooking(lead.id, ghlContactId, rescheduled.date);
          await transitionLead(lead.id, ghlContactId, 'sr_reschedule', 'sr_rescheduled', 'INSPECTION_SCHEDULED', {
            sr_status: 'INSPECTION_SCHEDULED', sr_appointment_at: rescheduled.date.toISOString(), sr_bot_stage: 'silent',
          });
          await sendGhlSms(ghlContactId, buildConfirmationSms(rescheduled.date));
          if (lead.assignedUserId) {
            await notifyRep(lead.assignedUserId, lead.id, `Reschedule confirmed for ${lead.customerName} — ${rescheduled.date.toLocaleDateString()}`);
          }
        }
      }
    } else if (signal === 'RE_QUALIFY') {
      await transitionLead(lead.id, ghlContactId, 'sr_reschedule', null, 'NEW', {
        sr_status: 'NEW', sr_bot_stage: 'booking',
      });
      await addGhlTag(ghlContactId, 'sr_booking');
    } else if (signal === 'DEAD') {
      await transitionLead(lead.id, ghlContactId, 'sr_reschedule', 'sr_dead', 'DEAD', {
        sr_status: 'DEAD', sr_bot_stage: 'silent',
      });
    }

    await logWebhookHit({ source: 'ghl_bot_reschedule', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[reschedule] uncaught error:', message);
    await logWebhookHit({ source: 'ghl_bot_reschedule', payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
