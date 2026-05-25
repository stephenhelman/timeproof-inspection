// Trigger: source_free_guide tag added to a GHL contact.
// Fired by GHL when a homeowner submits the /roof-guide intake form.
// Also fired for every subsequent inbound SMS while the tag is active.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isOptOut,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  parseInboundSms,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getZipTier } from "@/src/lib/service-zones";
import { assembleNurturePrompt } from "@/src/lib/prompts/qntum/assemblers/nurture";
import type { NurtureContext, NurtureLastMessageContext } from "@/src/lib/prompts/qntum/types";

type BotMessage = { role: string; content: string; timestamp: string };

// ── conversation_track detection (per spec Section 5) ──────────────────────
function detectNurtureLastMessageContext(message: string): NurtureLastMessageContext {
  if (!message || message === 'new_guide_lead') return 'none';
  const t = message.toLowerCase();

  if (/not interested|leave me alone|stop texting|don't (want|need)|no thanks/.test(t))
    return 'not_interested';

  // Intent signals (from roofKnowledge usageRules.handoffTriggers)
  if (
    /when (could|can|do) you (come|get) out|how long does it take|schedule|book|inspection|what does.*inspect|what('s| is) involved|what happens if|worried|concerned|afraid|scared/.test(t) ||
    /warranty|how old|15|20|years old|too old|getting old/.test(t)
  ) return 'intent_signal';

  if (/leak|missing|crack|damage|hail|stain|sagging|rot|blister|ponding|granule/.test(t))
    return 'problem_mentioned';

  if (/looks fine|no issues|don't think|not sure|neighbor|just curious|just checking/.test(t))
    return 'no_problem_aware';

  if (/not really|don't know|maybe|i guess|possibly/.test(t))
    return 'skeptical';

  // Short replies that disengage
  const trimmed = message.trim();
  if (trimmed.length < 10) return 'stalling';

  return 'curious_engaged';
}

function detectInsightUsed(text: string): string | null {
  const match = text.match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i);
  return match ? match[1].toLowerCase() : null;
}

function stripSignals(text: string): string {
  return text
    .replace(/\[INSPECTION_INTENT\]/g, '')
    .replace(/\[INSIGHT_USED:[^\]]*\]/gi, '')
    .replace(/\[SOFT_CLOSE\]/g, '')
    .replace(/\[NOT_INTERESTED\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .trim();
}

function extractSignal(text: string): 'INSPECTION_INTENT' | 'SOFT_CLOSE' | 'NOT_INTERESTED' | 'ESCALATE' | null {
  if (text.includes('[ESCALATE]')) return 'ESCALATE';
  if (text.includes('[INSPECTION_INTENT]')) return 'INSPECTION_INTENT';
  if (text.includes('[NOT_INTERESTED]')) return 'NOT_INTERESTED';
  if (text.includes('[SOFT_CLOSE]')) return 'SOFT_CLOSE';
  return null;
}

async function getUsedInsightIds(threadId: string): Promise<string[]> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return [];
  const meta = thread.metadata as Record<string, unknown> | null;
  return Array.isArray(meta?.usedInsightIds) ? (meta.usedInsightIds as string[]) : [];
}

async function addUsedInsightId(threadId: string, insightId: string): Promise<void> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return;
  const meta = (thread.metadata as Record<string, unknown>) ?? {};
  const existing = Array.isArray(meta.usedInsightIds) ? (meta.usedInsightIds as string[]) : [];
  if (!existing.includes(insightId)) {
    await prisma.botThread.update({
      where: { id: threadId },
      data: { metadata: { ...meta, usedInsightIds: [...existing, insightId] } },
    });
  }
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
    await logWebhookHit({ source: 'ghl_bot_nurture', payload: rawBody, success: false, error: 'lead_not_found', idempotencyKey });
    return NextResponse.json({ ok: true, warning: 'lead_not_found' });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: 'opted_out' });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, 'sr_opted_out');
      await transitionLead(lead.id, ghlContactId, 'source_free_guide', 'sr_dead', 'DEAD', {
        sr_status: 'DEAD', sr_bot_stage: 'silent', sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: 'ghl_bot_nurture', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // Load thread and used insight IDs
    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, 'nurture');
    const usedInsightIds = await getUsedInsightIds(threadId);

    // Append inbound message if real
    if (inboundMessage && inboundMessage !== 'new_guide_lead') {
      await appendMessage(threadId, 'user', inboundMessage);
    }

    // Reload messages
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    // Build NurtureContext
    const rawLead = lead as unknown as Record<string, unknown>;
    const issuesRaw = rawLead.issuesNoticed as string | null ?? null;
    const issuesNoticed = issuesRaw ? issuesRaw.split(',').map(s => s.trim()).filter(Boolean) : null;

    const sourceRaw = (rawLead.guideSource as string) ?? (rawLead.source as string) ?? 'organic';
    const sourceMap: Record<string, NurtureContext['source']> = {
      'facebook-guide': 'facebook-guide',
      'door': 'door',
      'card': 'card',
      'organic': 'organic',
    };
    const source: NurtureContext['source'] = sourceMap[sourceRaw] ?? 'organic';

    const context: NurtureContext = {
      bot_type: 'nurture',
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source,
      rep: (rawLead.rep as string | null) ?? null,
      message_history_count: currentMessages.length,
      last_message_context: detectNurtureLastMessageContext(inboundMessage),
      roof_type: (rawLead.roofType as string | null) ?? null,
      roof_age: lead.roofAge ?? null,
      issues_noticed: issuesNoticed,
      last_inspected: lead.lastInspected ?? null,
      address: lead.streetAddress ?? null,
      used_insight_ids: usedInsightIds,
      is_drip: false,
      drip_sequence_position: null,
    };

    // Proactive opener for new thread
    if (isNew || messages.length === 0) {
      const systemPrompt = assembleNurturePrompt(context);
      const openerMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> = [
        { role: 'user', content: 'new_guide_lead', timestamp: new Date().toISOString() },
      ];
      const openerRaw = await runBot(systemPrompt, openerMessages);
      if (openerRaw !== null) {
        const insightUsed = detectInsightUsed(openerRaw);
        const openerClean = stripSignals(openerRaw);
        await sendGhlSms(ghlContactId, openerClean);
        await appendMessage(threadId, 'assistant', openerRaw);
        if (insightUsed) await addUsedInsightId(threadId, insightUsed);
      }
      if (!inboundMessage || inboundMessage === 'new_guide_lead') {
        await logWebhookHit({ source: 'ghl_bot_nurture', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    // Build system prompt with updated message count and last context
    const reloadedThread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
    const freshContext: NurtureContext = {
      ...context,
      message_history_count: reloadedMessages.length,
      used_insight_ids: await getUsedInsightIds(threadId),
    };
    const systemPrompt = assembleNurturePrompt(freshContext);

    const botMessages = reloadedMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: 'ghl_bot_nurture', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const insightUsed = detectInsightUsed(rawResponse);
    const smsText = stripSignals(rawResponse);

    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, 'assistant', rawResponse);
    if (insightUsed) await addUsedInsightId(threadId, insightUsed);

    // ── Signal handling ────────────────────────────────────────────────────

    if (signal === 'ESCALATE') {
      // runBot already notified manager via notifyManager() in bot-engine
      // nothing more to do here

    } else if (signal === 'INSPECTION_INTENT') {
      // ZIP gate check
      const zip = lead.sourceZip ?? '';
      const tier = zip ? getZipTier(zip) : null;

      await addGhlTag(ghlContactId, 'zip_check_pending');

      if (tier === 'primary') {
        await removeGhlTag(ghlContactId, 'zip_check_pending');
        await addGhlTag(ghlContactId, 'zip_approved');
        await addGhlTag(ghlContactId, 'sr_qualifying');
        // Qualify bot will activate via GHL workflow on sr_qualifying tag
      } else {
        // secondary or out_of_area — manual review
        await removeGhlTag(ghlContactId, 'zip_check_pending');
        await addGhlTag(ghlContactId, 'zip_review_pending');
        await sendGhlSms(
          ghlContactId,
          "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly."
        );
        // Thread paused — bot silenced until human adds scheduling_approved or out_of_area_confirmed
      }

    } else if (signal === 'SOFT_CLOSE') {
      await addGhlTag(ghlContactId, 'sr_soft_close');

    } else if (signal === 'NOT_INTERESTED') {
      await transitionLead(lead.id, ghlContactId, 'source_free_guide', 'sr_dead', 'DEAD', {
        sr_status: 'DEAD', sr_bot_stage: 'silent',
      });
    }

    await logWebhookHit({ source: 'ghl_bot_nurture', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[nurture] uncaught error:', message);
    await logWebhookHit({ source: 'ghl_bot_nurture', payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
