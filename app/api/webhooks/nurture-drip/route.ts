// Trigger: GHL cadence workflow fires this on sr_soft_close schedule.
// Receives: { lead_id: string, drip_position: 1 | 2 | 3 | 4 }
// Protected by: x-ghl-secret header

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  getAreaAppointments,
} from "@/src/lib/bot-engine";
import { validateWebhookSecret } from "@/src/lib/bot-webhook-utils";
import { getZipTier, getZoneForZip } from "@/src/lib/service-zones";
import {
  getGhlOpportunityCustomField,
  writeGhlOpportunityCustomField,
  writeGhlContactCustomField,
} from "@/src/lib/ghl-contacts";
import { assembleNurturePrompt } from "@/src/lib/prompts/qntum/assemblers/nurture";
import { EMPTY_BOT_CONTEXT } from "@/src/lib/prompts/qntum/types";
import type { BotContext } from "@/src/lib/prompts/qntum/types";
import type { NurtureAssemblerContext } from "@/src/lib/prompts/qntum/assemblers/nurture";

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  let body: unknown = null;
  try { body = await request.json(); } catch { /* fall through */ }

  const bodyData = (body as Record<string, unknown>) ?? {};
  const data = (bodyData.customData as Record<string, unknown>) ?? bodyData;
  const { lead_id, drip_position } = data;

  if (!lead_id || typeof lead_id !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing_lead_id' }, { status: 400 });
  }
  if (!drip_position || ![1, 2, 3, 4].includes(Number(drip_position))) {
    return NextResponse.json({ ok: false, error: 'invalid_drip_position' }, { status: 400 });
  }

  const pos = Number(drip_position) as 1 | 2 | 3 | 4;

  const lead = await prisma.lead.findUnique({ where: { id: lead_id } });
  if (!lead) {
    console.warn(`[nurture-drip] lead not found: ${lead_id}`);
    return NextResponse.json({ ok: true, warning: 'lead_not_found' });
  }

  if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: 'opted_out' });
  if (!lead.ghlContactId) return NextResponse.json({ ok: true, warning: 'no_ghl_contact_id' });

  const activeStatuses = ['NEW', 'INSPECTION_SCHEDULED', 'QUOTED', 'SOLD'];
  if (activeStatuses.includes(lead.status as string)) {
    return NextResponse.json({ ok: true, skipped: 'lead_reactivated' });
  }

  const ghlContactId = lead.ghlContactId;

  try {
    const { id: threadId } = await getOrCreateThread(ghlContactId, 'nurture');
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];

    // Read bot_context from GHL opportunity field
    const rawLead = lead as unknown as Record<string, unknown>;
    const ghlOpportunityId = (rawLead.ghlOpportunityId as string | null) ?? null;
    let bot_context: BotContext = EMPTY_BOT_CONTEXT;
    if (ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
      const raw = await getGhlOpportunityCustomField(ghlOpportunityId, process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT).catch(() => null);
      if (raw) {
        try { bot_context = JSON.parse(raw) as BotContext; } catch { /* use empty */ }
      }
    }

    const leadZone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? 'el_paso_central') : 'el_paso_central';
    const area_appointments = await getAreaAppointments(leadZone).catch(() => []);

    const sourceRaw = (rawLead.source as string) ?? 'facebook-guide';
    const srcMap: Record<string, NurtureAssemblerContext['source']> = {
      'facebook-guide': 'facebook-guide', 'door': 'door', 'card': 'card', 'organic': 'organic',
    };
    const source: NurtureAssemblerContext['source'] = srcMap[sourceRaw] ?? 'facebook-guide';

    const context: NurtureAssemblerContext = {
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

    const systemPrompt = assembleNurturePrompt(context);
    const botMessages = [
      ...currentMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp })),
      { role: 'user' as const, content: '[drip_trigger]', timestamp: new Date().toISOString() },
    ];

    const response = await runBot(systemPrompt, botMessages, {
      isJsonMode: true,
      maxTokens: 600,
      ghlContactId,
      previousContext: bot_context,
    });

    if (response === null) return NextResponse.json({ ok: true });

    // Write updated bot_context back to GHL opportunity field
    if (ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
      await writeGhlOpportunityCustomField(
        ghlOpportunityId,
        process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT,
        JSON.stringify(response.bot_context),
      ).catch(err => console.warn('[nurture-drip] writeGhlOpportunityCustomField failed:', err));
    }

    // stage_change: true — next bot sends opener; no SMS from this bot
    if (response.stage_change) {
      if (process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
        await writeGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT, response.bot_context.summary).catch(() => null);
      }
    } else if (response.message) {
      await sendGhlSms(ghlContactId, response.message);
      await appendMessage(threadId, 'assistant', response.message);
    }

    if (response.signal === 'QUALIFIED') {
      const zip = lead.sourceZip ?? '';
      const tier = zip ? getZipTier(zip) : null;
      await addGhlTag(ghlContactId, 'zip_check_pending');
      if (tier === 'primary') {
        await removeGhlTag(ghlContactId, 'zip_check_pending');
        await addGhlTag(ghlContactId, 'zip_approved');
        await addGhlTag(ghlContactId, 'sr_qualifying');
      } else {
        await removeGhlTag(ghlContactId, 'zip_check_pending');
        await addGhlTag(ghlContactId, 'zip_review_pending');
        await sendGhlSms(ghlContactId, "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.");
      }
    } else if (response.signal === 'NOT_INTERESTED') {
      await transitionLead(lead.id, ghlContactId, 'source_free_guide', 'sr_dead', 'DEAD', 'silent', {
        sr_status: 'DEAD', sr_bot_stage: 'silent',
      });
    } else if (response.signal === 'SOFT_CLOSE' || pos === 4) {
      await addGhlTag(ghlContactId, 'sr_nurture_exhausted');
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[nurture-drip] uncaught error:', message);
    return NextResponse.json({ ok: true });
  }
}
