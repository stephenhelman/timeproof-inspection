import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isCancellation,
  getAreaAppointments,
  readBotContextFromDb,
  writeBotContextToDb,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  getGhlContactCustomField,
  writeGhlContactCustomField,
  writeGhlOpportunityCustomField,
  moveGhlOpportunityStage,
} from "@/src/lib/ghl-contacts";
import { assembleQualifyPrompt } from "@/src/lib/prompts/qntum/assemblers/qualify";
import type { BotContext } from "@/src/lib/prompts/qntum/types";
import type { QualifyAssemblerContext } from "@/src/lib/prompts/qntum/assemblers/qualify";
import { getZoneForZip } from "@/src/lib/service-zones";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

const CONVERSATION_LIMIT = 12;

async function mergeSourceFields(
  bot_context: BotContext,
  sourceType: BotContext['source_type'],
  assignedUserId: string | null,
): Promise<BotContext> {
  let repName = bot_context.rep_name;
  if (repName === null && (sourceType === 'door' || sourceType === 'card') && assignedUserId) {
    const user = await prisma.user.findUnique({ where: { id: assignedUserId }, select: { name: true } });
    repName = user?.name ?? null;
  }
  return {
    ...bot_context,
    source_type: bot_context.source_type ?? sourceType,
    rep_name: repName,
  };
}

const QUALIFY_OPENER =
  `Hey {firstName} — this is Alex with Qntum Roofing. ` +
  `Following up on your inspection request. ` +
  `What made you want to get your roof looked at?`;

export async function handleQualifyWebhook(ctx: {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
}): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg } = ctx;
  const rawLead = lead as unknown as Record<string, unknown>;

  // ── Opener triggers ───────────────────────────────────────────────────────────
  if (trigger === 'new_inspection_lead' || trigger === 'scheduling_approved') {
    // Read the prior bot's (nurture) accumulated context BEFORE the qualify thread
    // exists — otherwise the freshly-stamped qualify thread wins the next read and
    // returns EMPTY_BOT_CONTEXT, wiping nurture's motivation/summary. Mirrors the
    // qualify→book hop, where the handoff read precedes book-thread creation.
    const priorContext = await readBotContextFromDb(ghlContactId);

    const { id: threadId, messages } = await getOrCreateThread(ghlContactId, 'qualify');
    if (messages.length === 0) {
      // Seed the new qualify thread with the full prior context so the first
      // inbound turn reads accumulated state instead of empty.
      await writeBotContextToDb(ghlContactId, 'qualify', priorContext);
      const fn = lead.customerName.trim().split(/\s+/)[0];
      const opener = QUALIFY_OPENER.replace('{firstName}', fn);
      await sendGhlSms(ghlContactId, opener);
      await appendMessage(threadId, 'assistant', opener);
    }
    return;
  }

  if (trigger !== 'inbound_sms') return;

  // ── Cancellation check ────────────────────────────────────────────────────────
  if (isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: 'scheduled' },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: { status: 'cancelled', repNotes: 'Cancelled by homeowner via SMS' },
      });
      await transitionLead(lead.id, ghlContactId, 'sr_qualifying', 'sr_cancelled', 'DEMO_NOT_SOLD', 'silent', {
        sr_status: 'DEMO_NOT_SOLD', sr_bot_stage: 'silent',
      });
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendGhlSms(ghlContactId, `No problem, ${fn}. We'll remove you from the schedule. If you ever want to revisit, just reach out.`);
      return;
    }
  }

  // Same handoff-seed pattern as the named-trigger opener above: capture the
  // prior bot's context before the qualify thread is created, so a first-contact
  // inbound (no prior opener trigger) still inherits nurture's accumulated state.
  const inboundPriorContext = await readBotContextFromDb(ghlContactId);

  const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, 'qualify');

  if (isNew || messages.length === 0) {
    await writeBotContextToDb(ghlContactId, 'qualify', inboundPriorContext);
    const fn = lead.customerName.trim().split(/\s+/)[0];
    const opener = QUALIFY_OPENER.replace('{firstName}', fn);
    await sendGhlSms(ghlContactId, opener);
    await appendMessage(threadId, 'assistant', opener);
    if (!inboundMsg || inboundMsg === 'new_lead') return;
  }

  if (inboundMsg && inboundMsg !== 'new_lead') {
    await appendMessage(threadId, 'user', inboundMsg);
  }

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];

  const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? '') : '';
  const leadZone = zone || 'el_paso_central';

  const knownIssues = Array.isArray(lead.knownIssues) ? (lead.knownIssues as string[]) : null;
  const activeIssues = (knownIssues ?? []).filter(i => i !== "I haven't noticed anything");

  type QSrc = QualifyAssemblerContext['source'];
  const rawSource = (rawLead.source as string) ?? null;
  const srcMap: Record<string, QSrc> = {
    'facebook-inspection': 'facebook-inspection', 'facebook-guide': 'facebook-guide',
    'door': 'door', 'card': 'card',
  };
  const source: QSrc = rawSource && rawSource in srcMap
    ? srcMap[rawSource]
    : rawSource === 'facebook' || rawSource === 'ghl_facebook'
      ? 'facebook-inspection'
      : null;

  const nurtureThread = await prisma.botThread.findFirst({ where: { ghlContactId, botType: 'nurture' } });
  const previousBotContext = process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT
    ? await getGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT).catch(() => null)
    : null;

  const sourceTypeMapped: BotContext['source_type'] =
    source === 'door' ? 'door'
    : source === 'card' ? 'card'
    : (source === 'facebook-inspection' || source === 'facebook-guide') ? 'facebook'
    : source !== null ? 'organic'
    : null;

  const bot_context = await mergeSourceFields(
    await readBotContextFromDb(ghlContactId),
    sourceTypeMapped,
    lead.assignedUserId,
  );
  const area_appointments = await getAreaAppointments(leadZone).catch(() => []);

  const assemblerCtx: QualifyAssemblerContext = {
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    zone,
    source,
    has_strong_signal:
      activeIssues.length > 0 ||
      lead.roofAge === '20+ years' ||
      lead.lastInspected === 'Never, as far as I know',
    came_from_nurture: nurtureThread !== null,
    message_history_count: currentMessages.length,
    bot_context: {
      ...bot_context,
      // Surface any time preference carried from nurture if not already set
      time_of_day_preference: bot_context.time_of_day_preference ??
        (previousBotContext?.match(/Time preference: "([^"]+)"/)?.[1] as BotContext['time_of_day_preference'] ?? null),
    },
    area_appointments,
  };

  const systemPrompt = assembleQualifyPrompt(assemblerCtx);
  const botMessages = currentMessages.map(m => ({
    role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
  }));

  const response = await runBot(systemPrompt, botMessages, { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: bot_context });
  if (response === null) {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
    return;
  }

  // Ensure motivation is populated before transitioning
  if (response.stage_change && response.signal === 'QUALIFIED' && response.bot_context.motivation.length === 0) {
    console.warn('[qualify] stage_change fired with empty motivation — scanning thread for issues');
    const issueKeywords = ['shingle', 'stain', 'leak', 'damage', 'old', 'crack', 'water', 'granule', 'hail', 'missing', 'rot'];
    const found = currentMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .filter(msg => issueKeywords.some(kw => msg.toLowerCase().includes(kw)));
    if (found.length > 0) {
      response.bot_context.motivation = found.slice(0, 3);
    }
  }

  await writeBotContextToDb(ghlContactId, 'qualify', response.bot_context);
  // Mirror to GHL — fire and forget
  if (lead.ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
    writeGhlOpportunityCustomField(lead.ghlOpportunityId, process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT, JSON.stringify(response.bot_context)).catch(() => null);
  }

  const atLimit = currentMessages.length >= CONVERSATION_LIMIT;
  if (response.stage_change || atLimit) {
    if (process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
      writeGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT, response.bot_context.summary).catch(() => null);
    }
  }

  if (!response.stage_change && response.message) {
    await sendGhlSms(ghlContactId, response.message);
    await appendMessage(threadId, 'assistant', response.message);
  }

  if (!response.stage_change) {
    if (response.signal === 'SOFT_CLOSE') {
      await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
      await addGhlTag(ghlContactId, 'sr_soft_close').catch(() => null);
    }
    return;
  }

  // ── Stage change handling ─────────────────────────────────────────────────────
  if (response.signal === 'QUALIFIED') {
    if (!lead.ghlOpportunityId) {
      console.warn(`[qualify] lead ${lead.id} has no ghlOpportunityId — pipeline stage move skipped`);
    }

    await updateSrLead(lead.id, { sr_bot_stage: 'booking', sr_qualify_status: 'qualified' });

    if (lead.ghlOpportunityId) {
      await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_BOOKING!).catch(err =>
        console.error('[qualify] moveGhlOpportunityStage BOOKING failed', err),
      );
    }

    await Promise.allSettled([
      addGhlTag(ghlContactId, 'sr_qualified'),
      addGhlTag(ghlContactId, 'sr_booking'),
      removeGhlTag(ghlContactId, 'sr_qualifying'),
    ]);
    // GHL workflow fires qualified_handoff webhook — book bot sends its own opener
  } else if (response.signal === 'NOT_INTERESTED') {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent', sr_status: 'DEAD' });
    await Promise.allSettled([
      addGhlTag(ghlContactId, 'sr_dead'),
      removeGhlTag(ghlContactId, 'sr_qualifying'),
      lead.ghlOpportunityId
        ? moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_DEAD!)
        : Promise.resolve(),
    ]);
  } else if (response.signal === 'SOFT_CLOSE') {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
    await addGhlTag(ghlContactId, 'sr_soft_close').catch(() => null);
  } else if (response.signal === 'ESCALATE') {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
  }
  void srLead;
}
