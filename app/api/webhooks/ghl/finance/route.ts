// Trigger: sr_credit_fail tag added to GHL contact.
// Applied when homeowner said yes but financing failed.

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
import { assembleFinancePrompt } from "@/src/lib/prompts/qntum/assemblers/finance";
import type { FinanceContext, FinanceLastMessageContext } from "@/src/lib/prompts/qntum/types";

type BotMessage = { role: string; content: string; timestamp: string };

function detectFinanceLastMessageContext(message: string): FinanceLastMessageContext {
  if (!message || message === 'credit_fail_triggered') return 'none';
  const t = message.toLowerCase();

  if (/speak (to|with) (someone|manager)|call me|want a human/.test(t) ||
    /rate|term|apr|interest|credit score|qualify/.test(t)) return 'escalation_needed';

  if (/can('t| not) (afford|do it)|there'?s no (way|path)|just (can'?t|won't)|not going to happen/.test(t))
    return 'firmly_cant_proceed';

  if (/equity|home equity|heloc|borrow against/.test(t)) return 'exploring_heloc';
  if (/credit union|local bank|navy federal|usaa/.test(t)) return 'exploring_credit_union';
  if (/co.?sign|family (member|help)|someone (else )?sign/.test(t)) return 'exploring_cosigner';
  if (/phase|stage|part of it|some of it|most urgent|just (the|do) part/.test(t)) return 'exploring_staged';

  if (/open to|willing to|what about|could (we|that)|maybe|possible|let me look/.test(t))
    return 'open_to_options';

  if (/found (a way|something)|we can|it'll work|figured (it )?out|ready to/.test(t))
    return 'option_identified';

  return 'open_to_options';
}

function getOptionsSurfacedFromThread(messages: BotMessage[]): string[] {
  const options: string[] = [];
  const allText = messages.map(m => m.content.toLowerCase()).join(' ');
  if (/equity|heloc/.test(allText)) options.push('heloc');
  if (/credit union/.test(allText)) options.push('credit_union');
  if (/co.?sign/.test(allText)) options.push('cosigner');
  if (/phase|stage/.test(allText)) options.push('staged_project');
  if (/family/.test(allText)) options.push('family');
  if (/cash.out|refinanc/.test(allText)) options.push('cash_out_refi');
  return options;
}

function stripSignals(text: string): string {
  return text
    .replace(/\[FINANCE_RETRY\]/g, '')
    .replace(/\[FINANCE_PENDING\]/g, '')
    .replace(/\[FINANCE_DEAD\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .trim();
}

function extractSignal(text: string): 'FINANCE_RETRY' | 'FINANCE_PENDING' | 'FINANCE_DEAD' | 'ESCALATE' | null {
  if (text.includes('[ESCALATE]')) return 'ESCALATE';
  if (text.includes('[FINANCE_RETRY]')) return 'FINANCE_RETRY';
  if (text.includes('[FINANCE_PENDING]')) return 'FINANCE_PENDING';
  if (text.includes('[FINANCE_DEAD]')) return 'FINANCE_DEAD';
  return null;
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
    await logWebhookHit({ source: 'ghl_bot_finance', payload: rawBody, success: false, error: 'lead_not_found', idempotencyKey });
    return NextResponse.json({ ok: true, warning: 'lead_not_found' });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: 'opted_out' });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, 'sr_opted_out');
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: 'ghl_bot_finance', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

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
    const lenderAttempted = rawLead.lenderAttempted ? 'prior lender' : null;
    const dispoNotes = rawLead.dispoNotes as string | null ?? null;

    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, 'finance');

    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const buildContext = (msgs: BotMessage[], lastMsg: string): FinanceContext => ({
      bot_type: 'finance',
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source_zip: lead.sourceZip ?? '',
      zone: '',
      message_history_count: msgs.length,
      last_message_context: detectFinanceLastMessageContext(lastMsg),
      inspection_findings: inspectionFindings,
      days_since_appointment: daysSince,
      lender_attempted: lenderAttempted,
      dispo_notes: dispoNotes,
      options_surfaced: getOptionsSurfacedFromThread(msgs),
    });

    // Proactive opener for new thread
    if (isNew || messages.length === 0) {
      const ctx = buildContext([], 'credit_fail_triggered');
      const systemPrompt = assembleFinancePrompt(ctx);
      const openerRaw = await runBot(systemPrompt, [
        { role: 'user', content: 'credit_fail_triggered', timestamp: new Date().toISOString() },
      ]);
      if (openerRaw !== null) {
        await sendGhlSms(ghlContactId, stripSignals(openerRaw));
        await appendMessage(threadId, 'assistant', openerRaw);
      }
      if (!inboundMessage || inboundMessage === 'credit_fail_triggered') {
        await logWebhookHit({ source: 'ghl_bot_finance', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    if (inboundMessage && inboundMessage !== 'credit_fail_triggered') {
      await appendMessage(threadId, 'user', inboundMessage);
    }

    const reloadedThread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];

    const context = buildContext(reloadedMessages, inboundMessage);
    const systemPrompt = assembleFinancePrompt(context);

    const botMessages = reloadedMessages.map(m => ({
      role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: 'ghl_bot_finance', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const smsText = stripSignals(rawResponse);
    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, 'assistant', rawResponse);

    if (signal === 'FINANCE_RETRY') {
      await addGhlTag(ghlContactId, 'sr_finance_ready');
      // Notify rep — lead stays QUOTED, bot silences
      if (lead.assignedUserId) {
        const optionFound = context.options_surfaced.slice(-1)[0] ?? 'unknown';
        const { notifyRep } = await import('@/src/lib/bot-engine');
        await notifyRep(
          lead.assignedUserId,
          lead.id,
          `Finance path identified — homeowner exploring ${optionFound}. Follow up to support.`
        );
      }
      // Remove sr_credit_fail so GHL retry doesn't re-fire immediately
      const { removeGhlTag } = await import('@/src/lib/ghl-sms');
      await removeGhlTag(ghlContactId, 'sr_credit_fail');

    } else if (signal === 'FINANCE_PENDING') {
      // Bot silences — GHL 7-day retry re-adds sr_credit_fail if still QUOTED

    } else if (signal === 'FINANCE_DEAD') {
      await transitionLead(lead.id, ghlContactId, 'sr_credit_fail', 'sr_dead', 'DEAD', {
        sr_status: 'DEAD', sr_bot_stage: 'silent',
      });
    }

    await logWebhookHit({ source: 'ghl_bot_finance', payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[finance] uncaught error:', message);
    await logWebhookHit({ source: 'ghl_bot_finance', payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
