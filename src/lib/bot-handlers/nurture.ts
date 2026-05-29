import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  getAreaAppointments,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  getGhlOpportunityCustomField,
  writeGhlContactCustomField,
  writeGhlOpportunityCustomField,
} from "@/src/lib/ghl-contacts";
import { assembleNurturePrompt } from "@/src/lib/prompts/qntum/assemblers/nurture";
import { EMPTY_BOT_CONTEXT } from "@/src/lib/prompts/qntum/types";
import type { BotContext } from "@/src/lib/prompts/qntum/types";
import type { NurtureAssemblerContext } from "@/src/lib/prompts/qntum/assemblers/nurture";
import { getZoneForZip, getZipTier } from "@/src/lib/service-zones";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

const CONVERSATION_LIMIT = 15;

async function readBotContext(ghlOpportunityId: string | null): Promise<BotContext> {
  if (!ghlOpportunityId || !process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) return EMPTY_BOT_CONTEXT;
  const raw = await getGhlOpportunityCustomField(ghlOpportunityId, process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT).catch(() => null);
  if (!raw) return EMPTY_BOT_CONTEXT;
  try { return JSON.parse(raw) as BotContext; } catch { return EMPTY_BOT_CONTEXT; }
}

async function writeBotContext(ghlOpportunityId: string | null, ctx: BotContext): Promise<void> {
  if (!ghlOpportunityId || !process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) return;
  await writeGhlOpportunityCustomField(
    ghlOpportunityId,
    process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT,
    JSON.stringify(ctx),
  ).catch(err => console.warn('[nurture] writeBotContext failed:', err));
}

export async function handleNurtureWebhook(ctx: {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
  dripPosition: number | null;
}): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg, dripPosition } = ctx;
  const rawLead = lead as unknown as Record<string, unknown>;
  const ghlOpportunityId = (rawLead.ghlOpportunityId as string | null) ?? null;

  const sourceRaw = (rawLead.guideSource as string) ?? (rawLead.source as string) ?? 'organic';
  const srcMap: Record<string, NurtureAssemblerContext['source']> = {
    'facebook-guide': 'facebook-guide', 'door': 'door', 'card': 'card', 'organic': 'organic',
  };
  const source: NurtureAssemblerContext['source'] = srcMap[sourceRaw] ?? 'organic';

  const leadZone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? 'el_paso_central') : 'el_paso_central';

  const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, 'nurture');

  // ── nurture_drip branch ──────────────────────────────────────────────────────
  if (trigger === 'nurture_drip' && dripPosition !== null) {
    const pos = dripPosition as 1 | 2 | 3 | 4;
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const bot_context = await readBotContext(ghlOpportunityId);
    const area_appointments = await getAreaAppointments(leadZone).catch(() => []);

    const assemblerCtx: NurtureAssemblerContext = {
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source,
      rep: (rawLead.rep as string | null) ?? null,
      message_history_count: currentMessages.length,
      is_drip: true,
      drip_sequence_position: pos,
      bot_context,
      area_appointments,
    };

    const systemPrompt = assembleNurturePrompt(assemblerCtx);
    const botMessages = [
      ...currentMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp })),
      { role: 'user' as const, content: '[drip_trigger]', timestamp: new Date().toISOString() },
    ];

    const response = await runBot(systemPrompt, botMessages, { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: bot_context });
    if (response === null) {
      await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
      return;
    }

    await writeBotContext(ghlOpportunityId, response.bot_context);

    const atLimit = currentMessages.length >= CONVERSATION_LIMIT;
    if (response.stage_change || atLimit) {
      if (process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
        await writeGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT, response.bot_context.summary).catch(() => null);
      }
    }

    if (!response.stage_change && response.message) {
      await sendGhlSms(ghlContactId, response.message);
      await appendMessage(threadId, 'assistant', response.message);
    }

    if (response.stage_change) {
      await handleSignal(response.signal, lead, ghlContactId, srLead, leadZone);
    } else if (response.signal === 'SOFT_CLOSE' || pos === 4) {
      await addGhlTag(ghlContactId, 'sr_nurture_exhausted');
    }

    return;
  }

  // ── new_guide_lead / inbound_sms branch ─────────────────────────────────────

  if (inboundMsg && inboundMsg !== 'new_guide_lead') {
    await appendMessage(threadId, 'user', inboundMsg);
  }

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];

  const bot_context = await readBotContext(ghlOpportunityId);
  const area_appointments = await getAreaAppointments(leadZone).catch(() => []);

  const assemblerCtx: NurtureAssemblerContext = {
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source,
    rep: (rawLead.rep as string | null) ?? null,
    message_history_count: currentMessages.length,
    is_drip: false,
    drip_sequence_position: null,
    bot_context,
    area_appointments,
  };

  // Opener for new thread
  if (isNew || messages.length === 0) {
    const systemPrompt = assembleNurturePrompt(assemblerCtx);
    const openerResponse = await runBot(systemPrompt, [
      { role: 'user', content: 'new_guide_lead', timestamp: new Date().toISOString() },
    ], { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: bot_context });

    if (openerResponse !== null) {
      await writeBotContext(ghlOpportunityId, openerResponse.bot_context);
      if (!openerResponse.stage_change && openerResponse.message) {
        await sendGhlSms(ghlContactId, openerResponse.message);
        await appendMessage(threadId, 'assistant', openerResponse.message);
      }
    }

    if (!inboundMsg || inboundMsg === 'new_guide_lead') return;
  }

  // Reload thread after potential opener write
  const freshThread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const freshMessages = (freshThread?.messages as BotMessage[]) ?? [];
  const freshBotContext = await readBotContext(ghlOpportunityId);

  const freshCtx: NurtureAssemblerContext = {
    ...assemblerCtx,
    message_history_count: freshMessages.length,
    bot_context: freshBotContext,
  };

  const systemPrompt = assembleNurturePrompt(freshCtx);
  const botMessages = freshMessages.map(m => ({
    role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
  }));

  const response = await runBot(systemPrompt, botMessages, { isJsonMode: true, maxTokens: 600, ghlContactId, previousContext: freshBotContext });
  if (response === null) {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
    return;
  }

  await writeBotContext(ghlOpportunityId, response.bot_context);

  const atLimit = freshMessages.length >= CONVERSATION_LIMIT;
  if (response.stage_change || atLimit) {
    if (process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
      await writeGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT, response.bot_context.summary).catch(() => null);
    }
  }

  if (!response.stage_change && response.message) {
    await sendGhlSms(ghlContactId, response.message);
    await appendMessage(threadId, 'assistant', response.message);
  }

  if (response.stage_change) {
    await handleSignal(response.signal, lead, ghlContactId, srLead, leadZone);
  } else if (response.signal === 'SOFT_CLOSE') {
    await addGhlTag(ghlContactId, 'sr_soft_close');
  }
}

async function handleSignal(
  signal: string | null,
  lead: Lead,
  ghlContactId: string,
  srLead: SrLead,
  leadZone: string,
): Promise<void> {
  void leadZone;
  if (signal === 'QUALIFIED') {
    const tier = srLead.srTier ?? lead.sourceTier ?? 'out_of_area';
    await addGhlTag(ghlContactId, 'zip_check_pending');
    if (tier === 'primary') {
      await removeGhlTag(ghlContactId, 'zip_check_pending');
      await addGhlTag(ghlContactId, 'zip_approved');
      await addGhlTag(ghlContactId, 'sr_qualifying');
    } else {
      await removeGhlTag(ghlContactId, 'zip_check_pending');
      await addGhlTag(ghlContactId, 'zip_review_pending');
      await sendGhlSms(
        ghlContactId,
        "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
      );
    }
  } else if (signal === 'NOT_INTERESTED') {
    await transitionLead(lead.id, ghlContactId, 'source_free_guide', 'sr_dead', 'DEAD', 'silent', {
      sr_status: 'DEAD', sr_bot_stage: 'silent',
    });
  } else if (signal === 'SOFT_CLOSE') {
    await addGhlTag(ghlContactId, 'sr_soft_close');
  } else if (signal === 'ESCALATE') {
    await updateSrLead(lead.id, { sr_bot_stage: 'silent' }).catch(() => null);
  }
}
