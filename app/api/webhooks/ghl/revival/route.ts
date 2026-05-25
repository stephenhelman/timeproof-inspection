// ============================================================
// SUPERSEDED by central webhook route
// app/api/webhooks/ghl/central/route.ts
//
// This route is preserved for reference and emergency fallback.
// GHL workflows should point to /api/webhooks/ghl/central
// Remove this file after central webhook is confirmed stable.
// ============================================================

// Trigger: sr_follow_up tag added to GHL contact.
// Applied by DispoModal when lead reaches DEMO_NOT_SOLD or NO_SHOW.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
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
import { getZoneForZip } from "@/src/lib/service-zones";
import { assembleRevivalPrompt } from "@/src/lib/prompts/qntum/assemblers/revival";
import type { RevivalContext, RevivalScenario, RevivalLastMessageContext, ConversationTrack } from "@/src/lib/prompts/qntum/types";

type BotMessage = { role: string; content: string; timestamp: string };

function detectConversationTrack(messages: BotMessage[]): ConversationTrack {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return 'warm';
  const userText = userMessages.map(m => m.content.toLowerCase()).join(' ');
  const recentUser = userMessages.slice(-3);
  const avgLength = recentUser.reduce((sum, m) => sum + m.content.trim().length, 0) / recentUser.length;

  if (/not interested|leave me alone|stop|don't (want|need)|go away/.test(userText)) return 'resistant';
  if (userMessages.length >= 2 && avgLength < 15) return 'resistant';
  if (/leak|damage|hail|stain|rot|crack|missing|sagging/.test(userText)) return 'problem_aware';
  if (avgLength > 60) return 'warm';
  return 'warm';
}

function detectRevivalLastMessageContext(message: string): RevivalLastMessageContext {
  if (!message || message === 'follow_up_triggered') return 'none';
  const t = message.toLowerCase();

  if (/speak (to|with) (someone|manager)|call me|want a human/.test(t) ||
    /ridiculous|unacceptable|scam|waste/.test(t)) return 'escalation_needed';

  if (/not interested|no thanks|stop|leave me alone|don't (want|need)/.test(t)) return 'not_interested';

  if (/already (fixed|done|replaced|had it|went with)|someone else did|got it done/.test(t)) return 'not_interested';

  if (/price|cost|afford|expensive|too much|money|budget|payment/.test(t)) return 'objection_price';
  if (/not (the right )?time|too busy|not ready|wait|later|next year|selling/.test(t)) return 'objection_timing';
  if (/husband|wife|spouse|partner|she|he said|need to (ask|check with|talk to)/.test(t)) return 'objection_spouse';
  if (/other (company|contractor|roofer)|someone else|got another|comparing|different/.test(t)) return 'objection_competitor';
  if (/think|not sure|need to decide|figure out|get back|let me/.test(t)) return 'objection_need_to_think';

  if (/yes|yeah|sure|interested|makes sense|go ahead|let'?s do it/.test(t.trim())) return 'expressed_interest';

  return 'expressed_interest';
}

function stripSignals(text: string): string {
  return text
    .replace(/\[RE_QUALIFY\]/g, '')
    .replace(/\[DEAD\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .trim();
}

function extractSignal(text: string): 'RE_QUALIFY' | 'DEAD' | 'ESCALATE' | null {
  if (text.includes('[ESCALATE]')) return 'ESCALATE';
  if (text.includes('[RE_QUALIFY]')) return 'RE_QUALIFY';
  if (text.includes('[DEAD]')) return 'DEAD';
  return null;
}

function detectRevivalScenario(lead: {
  inspectionFindings: string | null;
  outcome: string | null;
}): RevivalScenario {
  if (lead.inspectionFindings && lead.outcome === 'demo_not_sold') return 'report_complete_not_sold';
  if (lead.inspectionFindings && lead.outcome === 'no_show') return 'report_complete_no_show';
  return 'no_report_no_show';
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
    await logWebhookHit({ source: 'ghl_bot_revival', payload: rawBody, success: false, error: 'lead_not_found', idempotencyKey });
    return NextResponse.json({ ok: true, warning: 'lead_not_found' });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: 'opted_out' });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, 'sr_opted_out');
      await transitionLead(lead.id, ghlContactId, 'sr_follow_up', 'sr_dead', 'DEAD', 'silent', {
        sr_status: 'DEAD', sr_bot_stage: 'silent', sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: 'ghl_bot_revival', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // Load last inspection for findings and timing
    const lastInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
    });

    const inspectionFindings =
      lastInspection?.findingsNotes ??
      (lastInspection?.diagnosis ? JSON.stringify(lastInspection.diagnosis) : null);

    const daysSince = lastInspection?.createdAt
      ? Math.floor((Date.now() - lastInspection.createdAt.getTime()) / 86400000)
      : null;

    const rawLead = lead as unknown as Record<string, unknown>;
    const dispoPrimaryObjection = rawLead.dispoPrimaryObjection as string | null ?? null;
    const dispoNotes = rawLead.dispoNotes as string | null ?? null;
    const dispoOutcome = rawLead.dispoOutcome as string | null ?? null;

    const lead_scenario = detectRevivalScenario({
      inspectionFindings,
      outcome: dispoOutcome,
    });

    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, 'revival');

    const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? '') : '';

    // Track referral seed from thread metadata
    const threadData = await prisma.botThread.findUnique({ where: { id: threadId } });
    const meta = (threadData?.metadata as Record<string, unknown>) ?? {};
    const referral_seed_planted = Boolean(meta.referralSeedPlanted);

    const buildContext = (msgs: BotMessage[], lastMsg: string): RevivalContext => ({
      bot_type: 'revival',
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source_zip: lead.sourceZip ?? '',
      zone,
      message_history_count: msgs.length,
      last_message_context: detectRevivalLastMessageContext(lastMsg),
      conversation_track: detectConversationTrack(msgs),
      lead_scenario,
      inspection_completed: inspectionFindings !== null,
      inspection_findings: inspectionFindings,
      days_since_appointment: daysSince,
      outcome: dispoOutcome as RevivalContext['outcome'],
      decision_maker_present: lead.dispoDecisionMakerPresent ?? null,
      primary_objection: dispoPrimaryObjection,
      dispo_notes: dispoNotes,
      referral_seed_planted,
    });

    // Proactive opener for new thread
    if (isNew || messages.length === 0) {
      const ctx = buildContext([], 'follow_up_triggered');
      const systemPrompt = assembleRevivalPrompt(ctx);
      const openerMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> = [
        { role: 'user', content: 'follow_up_triggered', timestamp: new Date().toISOString() },
      ];
      const openerRaw = await runBot(systemPrompt, openerMessages);
      if (openerRaw !== null) {
        const openerClean = stripSignals(openerRaw);
        await sendGhlSms(ghlContactId, openerClean);
        await appendMessage(threadId, 'assistant', openerRaw);
      }
      if (!inboundMessage || inboundMessage === 'follow_up_triggered') {
        await logWebhookHit({ source: 'ghl_bot_revival', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    if (inboundMessage && inboundMessage !== 'follow_up_triggered') {
      await appendMessage(threadId, 'user', inboundMessage);
    }

    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const context = buildContext(currentMessages, inboundMessage);
    const systemPrompt = assembleRevivalPrompt(context);

    const botMessages = currentMessages.map(m => ({
      role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: 'ghl_bot_revival', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const smsText = stripSignals(rawResponse);

    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, 'assistant', rawResponse);

    // Track referral seed if planted
    if (rawResponse.toLowerCase().includes("if you know anyone") && !referral_seed_planted) {
      await prisma.botThread.update({
        where: { id: threadId },
        data: { metadata: { ...meta, referralSeedPlanted: true } },
      });
    }

    if (signal === 'RE_QUALIFY') {
      await transitionLead(lead.id, ghlContactId, 'sr_follow_up', 'sr_recovered', 'NEW', 'booking', {
        sr_status: 'NEW', sr_bot_stage: 'booking',
      });
      await addGhlTag(ghlContactId, 'sr_booking');
    } else if (signal === 'DEAD') {
      await transitionLead(lead.id, ghlContactId, 'sr_follow_up', 'sr_dead', 'DEAD', 'silent', {
        sr_status: 'DEAD', sr_bot_stage: 'silent',
      });
    }

    await logWebhookHit({ source: 'ghl_bot_revival', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[revival] uncaught error:', message);
    await logWebhookHit({ source: 'ghl_bot_revival', payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
