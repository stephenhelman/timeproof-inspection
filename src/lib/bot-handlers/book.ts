import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isCancellation,
  purgeExpiredSlotLocks,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  confirmBooking,
  notifyRep,
  formatAppointmentDatetime,
  getAreaAppointments,
  readBotContextFromDb,
  writeBotContextToDb,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  writeGhlContactCustomField,
  writeGhlOpportunityCustomField,
  moveGhlOpportunityStage,
  updateGhlContact,
} from "@/src/lib/ghl-contacts";
import { createAppointmentWithInspection, deriveZoneForLead } from "@/src/lib/appointment-service";
import { assembleBookPrompt } from "@/src/lib/prompts/qntum/assemblers/book";
import type { BotContext } from "@/src/lib/prompts/qntum/types";
import type { BookAssemblerContext } from "@/src/lib/prompts/qntum/assemblers/book";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";
import { detectTimePreference, type TimeOfDay } from "@/src/lib/time-utils";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

const CONVERSATION_LIMIT = 20;

const BOOKED_SLOT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

// Homeowner is rejecting the offered slot(s) / asking for a different time.
// Mirrors detectRescheduleLastMessageContext's slot_rejected pattern.
const SLOT_REJECTION_RE = /can('t| not)|won't work|not (available|good)|different (time|day)|none of (those|these)|doesn'?t work|does not work|something (else|later|earlier)/i;

async function handleStallExhaustedWebhook(lead: Lead, ghlContactId: string): Promise<void> {
  await updateSrLead(lead.id, { sr_bot_stage: 'revival', sr_status: 'DEMO_NOT_SOLD' });
  if (lead.ghlOpportunityId) {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_FOLLOW_UP_ACTIVE!).catch(err =>
      console.error('[book/stall_exhausted] moveStage failed:', err),
    );
  }
  await Promise.allSettled([
    addGhlTag(ghlContactId, 'sr_follow_up'),
    removeGhlTag(ghlContactId, 'booking_stall'),
  ]);
}

async function handleAppointmentConfirmedWebhook(lead: Lead, srLead: SrLead, ghlContactId: string): Promise<void> {
  void ghlContactId;

  const assignedUserId = lead.assignedUserId ?? process.env.GHL_DEFAULT_ASSIGNEE_ID ?? null;
  if (!assignedUserId) {
    console.error('[book/appt_confirmed] no assignedUserId — cannot create Appointment');
    return;
  }

  // srAppointmentAt is written by transitionLead just before this webhook fires.
  // Fall back to now() only if it's somehow missing.
  const scheduledAt = srLead.srAppointmentAt ?? new Date();
  const zone = deriveZoneForLead(lead.sourceZip ?? null);

  try {
    const { appointmentId, inspectionId } = await createAppointmentWithInspection({
      leadId: lead.id,
      assignedUserId,
      scheduledAt,
      zone,
      createdBy: 'ALEX',
    });
    console.log(`[book/appt_confirmed] appointment ${appointmentId} + inspection ${inspectionId} created for lead ${lead.id}`);
  } catch (err) {
    console.error('[book/appt_confirmed] createAppointmentWithInspection failed:', err);
  }
}

export async function handleBookWebhook(ctx: {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
}): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;
  const rawLead = lead as unknown as Record<string, unknown>;

  // ── Named trigger dispatch ────────────────────────────────────────────────────
  if (trigger === 'stall_exhausted') {
    await handleStallExhaustedWebhook(lead, ghlContactId);
    return;
  }
  if (trigger === 'appointment_confirmed') {
    await handleAppointmentConfirmedWebhook(lead, ctx.srLead, ghlContactId);
    return;
  }

  // ── Cancellation check ────────────────────────────────────────────────────────
  if (trigger === 'inbound_sms' && isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: 'scheduled' },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: { status: 'cancelled', repNotes: 'Cancelled via SMS' },
      });
      await transitionLead(lead.id, ghlContactId, 'sr_booking', 'sr_cancelled', 'DEMO_NOT_SOLD', 'silent', {
        sr_status: 'DEMO_NOT_SOLD', sr_bot_stage: 'silent',
      });
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendGhlSms(ghlContactId, `No problem, ${fn}. We've cancelled your inspection. If things change, reach out anytime.`);
      return;
    }
  }

  // ── Book bot conversation ─────────────────────────────────────────────────────
  await purgeExpiredSlotLocks();

  const leadZone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? null) : null;
  const distanceZone = leadZone ? isDistanceZone(leadZone) : false;
  const zone = leadZone ?? 'el_paso_central';

  // Read context from DB — immediately consistent, no race condition
  const bot_context = await readBotContextFromDb(ghlContactId);
  console.info('[book] readBotContextFromDb result — motivation:', bot_context.motivation, 'summary:', bot_context.summary?.slice(0, 80));

  const area_appointments = await getAreaAppointments(zone).catch(() => []);

  // Address: prefer bot_context.address (Claude-accumulated) over lead record
  const existingAddress = bot_context.address ?? (rawLead.address as string | null) ?? null;
  const addressCollected = !!(existingAddress && existingAddress.trim().length > 0);

  // Sync address to lead record if bot_context has one but lead doesn't
  if (bot_context.address && !lead.address) {
    await prisma.lead.update({ where: { id: lead.id }, data: { address: bot_context.address } }).catch(() => null);
    if (lead.ghlContactId) {
      await updateGhlContact(lead.ghlContactId, { address1: bot_context.address }).catch(() => null);
    }
  }

  // Effective time-of-day preference. Prefer what the homeowner stated in THIS
  // message (deterministic parse) over stored context, so a stated/restated
  // preference influences slot selection on the same turn rather than next turn.
  // Fold the free-text appointment_time_preference into the enum too, so the two
  // fields can never diverge from the value getAvailableSlots actually reads.
  const detectedPref = trigger === 'inbound_sms' ? detectTimePreference(inboundMsg) : null;
  const storedPref: TimeOfDay | null =
    bot_context.time_of_day_preference
    ?? (bot_context.appointment_time_preference
          ? detectTimePreference(bot_context.appointment_time_preference)?.preference ?? null
          : null);
  const timePreference: TimeOfDay = detectedPref?.preference ?? storedPref ?? 'any';
  const specificStartHour = detectedPref?.startHour;

  // A slot rejection or a preference change must invalidate the previously
  // offered slot and re-query — never reuse the stale lock. Otherwise the
  // re-offer turn would run against an empty slot list and Alex would defer.
  const slotRejected = trigger === 'inbound_sms' && SLOT_REJECTION_RE.test(inboundMsg);
  const preferenceChanged = !!detectedPref && detectedPref.preference !== storedPref;

  // Slot fetching
  const existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });
  const needsFreshSlots =
    !existingLock ||
    trigger === 'qualified_handoff' ||
    trigger === 'stall_followup' ||
    slotRejected ||
    preferenceChanged;
  let rawSlots: Array<{ date: string; time: string; label: string }> = [];
  if (addressCollected && needsFreshSlots) {
    rawSlots = await getAvailableSlots(zone, distanceZone, timePreference, specificStartHour);
    if (rawSlots.length > 0) {
      const [y, m, d] = rawSlots[0].date.split('-').map(Number);
      await createSlotLock({
        date: new Date(y, m - 1, d),
        time: rawSlots[0].time,
        zone,
        leadId: lead.id,
        label: rawSlots[0].label || rawSlots[0].time,
      });
    }
  }

  const { id: threadId } = await getOrCreateThread(ghlContactId, 'book');
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];

  const knownIssues = Array.isArray(lead.knownIssues) ? (lead.knownIssues as string[]) : [];
  const activeIssues = knownIssues.filter(i => i !== "I haven't noticed anything");

  const assemblerCtx: BookAssemblerContext = {
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    zone: leadZone ?? '',
    available_slots: rawSlots.map(s => ({ date: s.date, time: s.time, label: s.label, zone_label: zone })),
    qualify_summary: {
      problem_confirmed: activeIssues.length > 0,
      specific_issue: activeIssues[0]?.toLowerCase() ?? null,
      roof_age: lead.roofAge ?? null,
      decision_maker_confirmed: lead.decisionMakerHome === 'Yes',
    },
    message_history_count: currentMessages.length,
    bot_context,
    area_appointments,
  };

  // ── Qualified handoff opener ──────────────────────────────────────────────────
  if (trigger === 'qualified_handoff') {
    const openerCtx: BookAssemblerContext = { ...assemblerCtx, message_history_count: 0 };
    const systemPrompt = assembleBookPrompt(openerCtx);
    const openerResponse = await runBot(systemPrompt, [
      { role: 'user', content: 'qualified_handoff', timestamp: new Date().toISOString() },
    ], { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: bot_context });
    if (openerResponse !== null) {
      await writeBotContextToDb(ghlContactId, 'book', openerResponse.bot_context);
      console.info('[book] writeBotContextToDb complete — motivation:', openerResponse.bot_context.motivation);
      // Mirror to GHL — fire and forget
      if (lead.ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
        writeGhlOpportunityCustomField(lead.ghlOpportunityId, process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT, JSON.stringify(openerResponse.bot_context)).catch(() => null);
      }
      if (!openerResponse.stage_change && openerResponse.message) {
        await sendGhlSms(ghlContactId, openerResponse.message);
        await appendMessage(threadId, 'assistant', openerResponse.message);
      }
    }
    return;
  }

  if (inboundMsg && trigger !== 'stall_followup') {
    await appendMessage(threadId, 'user', inboundMsg);
  }

  // ── Stall followup ────────────────────────────────────────────────────────────
  if (trigger === 'stall_followup') {
    const stalledThread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const stalledMessages = (stalledThread?.messages as BotMessage[]) ?? [];
    const systemPrompt = assembleBookPrompt(assemblerCtx);
    const botMessages = [
      ...stalledMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp })),
      { role: 'user' as const, content: 'stall_followup', timestamp: new Date().toISOString() },
    ];
    const response = await runBot(systemPrompt, botMessages, { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: bot_context });
    if (response === null) {
      await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
      return;
    }
    await writeBotContextToDb(ghlContactId, 'book', response.bot_context);
    console.info('[book] writeBotContextToDb complete — motivation:', response.bot_context.motivation);
    if (lead.ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
      writeGhlOpportunityCustomField(lead.ghlOpportunityId, process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT, JSON.stringify(response.bot_context)).catch(() => null);
    }
    if (!response.stage_change && response.message) {
      await sendGhlSms(ghlContactId, response.message);
      await appendMessage(threadId, 'assistant', response.message);
    }
    if (response.signal === 'STALL') {
      await addGhlTag(ghlContactId, 'booking_stall_exhausted');
      await addGhlTag(ghlContactId, 'sr_follow_up');
    } else if (response.signal === 'BOOKED' && response.booked_slot) {
      await handleBooked(response.booked_slot, response.bot_context, lead, ghlContactId, zone, distanceZone);
    }
    return;
  }

  // ── Main inbound_sms conversation ─────────────────────────────────────────────
  const reloadedThread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
  const freshBotCtx = await readBotContextFromDb(ghlContactId);

  const freshCtx: BookAssemblerContext = { ...assemblerCtx, message_history_count: reloadedMessages.length, bot_context: freshBotCtx };
  const systemPrompt = assembleBookPrompt(freshCtx);
  const botMessages = reloadedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp }));

  const response = await runBot(systemPrompt, botMessages, { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: freshBotCtx });
  if (response === null) {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
    return;
  }

  await writeBotContextToDb(ghlContactId, 'book', response.bot_context);
  console.info('[book] writeBotContextToDb complete — motivation:', response.bot_context.motivation,
    'time_of_day_preference:', response.bot_context.time_of_day_preference,
    'appointment_time_preference:', response.bot_context.appointment_time_preference);
  if (lead.ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
    writeGhlOpportunityCustomField(lead.ghlOpportunityId, process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT, JSON.stringify(response.bot_context)).catch(() => null);
  }

  const atLimit = reloadedMessages.length >= CONVERSATION_LIMIT;
  if (response.stage_change || atLimit) {
    if (process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
      writeGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT, response.bot_context.summary).catch(() => null);
    }
  }

  // Handle address accumulation in bot_context
  if (response.bot_context.address && response.bot_context.address !== freshBotCtx.address) {
    const newAddr = response.bot_context.address;
    await prisma.lead.update({ where: { id: lead.id }, data: { address: newAddr } }).catch(() => null);
    if (lead.ghlContactId) {
      await updateGhlContact(lead.ghlContactId, { address1: newAddr }).catch(() => null);
    }
  }

  if (!response.stage_change && response.message) {
    await sendGhlSms(ghlContactId, response.message);
    await appendMessage(threadId, 'assistant', response.message);
  }

  if (response.signal === 'BOOKED' && response.booked_slot) {
    await handleBooked(response.booked_slot, response.bot_context, lead, ghlContactId, zone, distanceZone);
    return;
  }

  if (response.signal === 'STALL') {
    await addGhlTag(ghlContactId, 'booking_stall');
    return;
  }

  if (response.stage_change) {
    if (response.signal === 'NOT_INTERESTED') {
      await updateSrLead(lead.id, { sr_bot_stage: 'silent', sr_status: 'DEAD' });
      await Promise.allSettled([
        addGhlTag(ghlContactId, 'sr_dead'),
        removeGhlTag(ghlContactId, 'sr_booking'),
        lead.ghlOpportunityId
          ? moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_DEAD!)
          : Promise.resolve(),
      ]);
    } else if (response.signal === 'SOFT_CLOSE') {
      await addGhlTag(ghlContactId, 'sr_soft_close');
      await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
    } else if (response.signal === 'ESCALATE') {
      await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
      await addGhlTag(ghlContactId, 'sr_escalation').catch(() => null);
      // Send the homeowner Alex's closing message (the main send block above is
      // skipped because ESCALATE is a stage_change) so they aren't left hanging
      // after a rejection while the rep is notified out of band.
      if (response.message) {
        await sendGhlSms(ghlContactId, response.message);
        await appendMessage(threadId, 'assistant', response.message);
      }
      // Real human handoff — this is the non-revival exit when Alex genuinely
      // can't serve a slot. Without it, ESCALATE would just silence the bot.
      if (lead.assignedUserId) {
        await notifyRep(
          lead.assignedUserId,
          lead.id,
          `${lead.customerName} needs a hand booking — Alex couldn't lock a time. Reach out to schedule.`,
        ).catch(err => console.error('[book] notifyRep ESCALATE failed:', err));
      }
    }
  }
}

async function handleBooked(
  bookedSlot: string,
  botCtx: BotContext,
  lead: Lead,
  ghlContactId: string,
  zone: string,
  distanceZone: boolean,
): Promise<void> {
  void distanceZone;

  if (!BOOKED_SLOT_RE.test(bookedSlot)) {
    console.error(`[book] BOOKED signal has invalid booked_slot format: "${bookedSlot}"`);
    return;
  }

  const [datePart, timePart] = bookedSlot.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Convert MT wall-clock to UTC
  const tz = process.env.BOT_TIMEZONE ?? 'America/Denver';
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const off = ((): number => {
    const pts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(guess);
    const h = parseInt(pts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(pts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return h * 60 + m - (hour * 60 + minute);
  })();
  const appointmentDate = new Date(guess.getTime() - off * 60 * 1000);

  console.info('[book] booked_slot raw value from Claude:', bookedSlot);
  const formattedDatetime = formatAppointmentDatetime(bookedSlot);

  const validation = await validateSlotBeforeConfirm(lead.id, appointmentDate, timePart, zone);
  if (!validation.ok) {
    console.warn('[book] slot conflict on confirm:', validation.reason);
    return;
  }

  try {
    await confirmBooking(lead.id, ghlContactId, appointmentDate, formattedDatetime, botCtx.address ?? undefined);
  } catch (err) {
    console.error('[book] confirmBooking failed:', err);
    return;
  }

  await transitionLead(lead.id, ghlContactId, 'sr_booking', 'sr_appointment_set', 'INSPECTION_SCHEDULED', 'silent', {
    sr_status: 'INSPECTION_SCHEDULED', sr_appointment_at: appointmentDate.toISOString(), sr_bot_stage: 'silent',
  });

  if (lead.ghlOpportunityId) {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_APPOINTMENT_SET!).catch(err =>
      console.error('[book] moveStage APPOINTMENT_SET failed:', err),
    );
  }

  if (lead.assignedUserId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.scopereports.com';
    const repMsg =
      `New inspection booked!\n\n` +
      `Homeowner: ${lead.customerName}\n` +
      `Address:   ${botCtx.address ?? 'not provided'}\n` +
      `Date/Time: ${formattedDatetime}\n` +
      `Phone:     ${lead.phone ?? 'not on file'}\n\n` +
      `Summary: ${botCtx.summary}\n\n` +
      `${appUrl}/leads/${lead.id}`;
    await notifyRep(lead.assignedUserId, lead.id, repMsg).catch(err =>
      console.error('[book] notifyRep failed:', err),
    );
  }
}
