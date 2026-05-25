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
} from "@/src/lib/bot-engine";
import { validateWebhookSecret } from "@/src/lib/bot-webhook-utils";
import { getZipTier } from "@/src/lib/service-zones";
import { assembleNurturePrompt } from "@/src/lib/prompts/qntum/assemblers/nurture";
import type { NurtureContext } from "@/src/lib/prompts/qntum/types";

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

  let body: unknown = null;
  try { body = await request.json(); } catch { /* fall through */ }

  // customData-first: GHL standard workflow webhooks wrap all fields in customData
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

  // Skip if lead has moved past soft-close (been reactivated)
  const activeStatuses = ['NEW', 'INSPECTION_SCHEDULED', 'QUOTED', 'SOLD'];
  if (activeStatuses.includes(lead.status as string)) {
    return NextResponse.json({ ok: true, skipped: 'lead_reactivated' });
  }

  const ghlContactId = lead.ghlContactId;

  try {
    const { id: threadId } = await getOrCreateThread(ghlContactId, 'nurture');
    const usedInsightIds = await getUsedInsightIds(threadId);

    // Build NurtureContext for drip
    const rawLead = lead as unknown as Record<string, unknown>;
    const issuesRaw = rawLead.issuesNoticed as string | null ?? null;
    const issuesNoticed = issuesRaw ? issuesRaw.split(',').map(s => s.trim()).filter(Boolean) : null;

    const sourceRaw = (rawLead.source as string) ?? 'facebook-guide';
    const sourceMap: Record<string, NurtureContext['source']> = {
      'facebook-guide': 'facebook-guide',
      'door': 'door',
      'card': 'card',
    };
    const source: NurtureContext['source'] = sourceMap[sourceRaw] ?? 'facebook-guide';

    // Load thread to get message count
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];

    const context: NurtureContext = {
      bot_type: 'nurture',
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source,
      rep: (rawLead.rep as string | null) ?? null,
      message_history_count: currentMessages.length,
      last_message_context: 'none',
      roof_type: (rawLead.roofType as string | null) ?? null,
      roof_age: lead.roofAge ?? null,
      issues_noticed: issuesNoticed,
      last_inspected: lead.lastInspected ?? null,
      address: lead.streetAddress ?? null,
      used_insight_ids: usedInsightIds,
      is_drip: true,
      drip_sequence_position: pos,
    };

    const systemPrompt = assembleNurturePrompt(context);

    // Synthetic user turn — gives Claude a turn structure without implying homeowner said anything
    const syntheticTurn = { role: 'user' as const, content: '[drip_trigger]', timestamp: new Date().toISOString() };
    const botMessages = [
      ...currentMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp })),
      syntheticTurn,
    ];

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const insightUsed = detectInsightUsed(rawResponse);
    const smsText = stripSignals(rawResponse);

    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, 'assistant', rawResponse);
    if (insightUsed) await addUsedInsightId(threadId, insightUsed);

    // ── Signal handling ────────────────────────────────────────────────────

    if (signal === 'INSPECTION_INTENT') {
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
        await sendGhlSms(
          ghlContactId,
          "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly."
        );
      }

    } else if (signal === 'NOT_INTERESTED') {
      await transitionLead(lead.id, ghlContactId, 'source_free_guide', 'sr_dead', 'DEAD', 'silent', {
        sr_status: 'DEAD', sr_bot_stage: 'silent',
      });

    } else if (signal === 'SOFT_CLOSE' || pos === 4) {
      // Final drip position or explicit soft close — mark exhausted
      await addGhlTag(ghlContactId, 'sr_nurture_exhausted');
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[nurture-drip] uncaught error:', message);
    return NextResponse.json({ ok: true });
  }
}
