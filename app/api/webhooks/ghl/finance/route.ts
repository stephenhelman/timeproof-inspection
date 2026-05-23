// Trigger: sr_finance tag added to a GHL contact (applied after SOLD or PENDING_SOLD_CONFIRMATION).
// The bot guides the homeowner through financing options and next steps.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  isOptOut,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  parseInboundSms,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";

function buildFinanceSystemPrompt(lead: { customerName: string }): string {
  return `You are Alex, a customer success specialist for Qntum Roofing.
You are following up with a homeowner who just agreed to move forward with their roof project.
Your goal is to help them understand their financing options and next steps.
Guidelines:
Be warm, congratulatory, and professional
Explain that a finance specialist will reach out to discuss options in detail
Ask if they have any immediate questions about the process
Keep messages to 2-3 sentences
If they ask about specific rates or terms, say a specialist will have all those details
When they confirm they are ready to proceed with the finance call, end with [FINANCE_READY]
If they decide they are not interested in financing, end with [FINANCE_DECLINED]
Never promise specific rates, terms, or approval
Lead name: ${lead.customerName}`;
}

function stripSignals(text: string): string {
  return text
    .replace(/\[FINANCE_READY\]/g, "")
    .replace(/\[FINANCE_DECLINED\]/g, "")
    .trim();
}

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  let rawBody: unknown = null;
  try { rawBody = await request.json(); } catch { /* fall through */ }

  const parsed = parseInboundSms(rawBody);
  if (!parsed) return NextResponse.json({ ok: true, warning: "unparseable_payload" });

  const { ghlContactId, inboundMessage, idempotencyKey } = parsed;

  if (await isDuplicate(idempotencyKey)) return NextResponse.json({ ok: true, duplicate: true });

  const lead = await loadLead(ghlContactId);
  if (!lead) {
    await logWebhookHit({ source: "ghl_bot_finance", payload: rawBody, success: false, error: "lead_not_found", idempotencyKey });
    return NextResponse.json({ ok: true, warning: "lead_not_found" });
  }

  try {
    if (lead.botOptedOut) return NextResponse.json({ ok: true, skipped: "opted_out" });

    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, "sr_opted_out");
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: "ghl_bot_finance", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const systemPrompt = buildFinanceSystemPrompt({ customerName: lead.customerName });
    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, "finance");

    if (isNew || messages.length === 0) {
      const openerMessages = [
        { role: "user" as const, content: "finance_triggered", timestamp: new Date().toISOString() },
      ];
      const openerRaw = await runBot(systemPrompt, openerMessages);
      if (openerRaw !== null) {
        const openerClean = stripSignals(openerRaw);
        await sendGhlSms(ghlContactId, openerClean);
        await appendMessage(threadId, "assistant", openerRaw);
      }
      if (!inboundMessage || inboundMessage === "finance_triggered") {
        await logWebhookHit({ source: "ghl_bot_finance", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    if (inboundMessage && inboundMessage !== "finance_triggered") {
      await appendMessage(threadId, "user", inboundMessage);
    }

    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];
    const botMessages = currentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));

    const rawResponse = await runBot(systemPrompt, botMessages);

    if (rawResponse === null) {
      await logWebhookHit({ source: "ghl_bot_finance", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const smsText = stripSignals(rawResponse);
    await sendGhlSms(ghlContactId, smsText);
    await appendMessage(threadId, "assistant", rawResponse);

    if (rawResponse.includes("[FINANCE_READY]")) {
      await addGhlTag(ghlContactId, "sr_finance_ready");
    } else if (rawResponse.includes("[FINANCE_DECLINED]")) {
      await addGhlTag(ghlContactId, "sr_finance_declined");
    }

    await logWebhookHit({ source: "ghl_bot_finance", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[finance bot] uncaught error:", message);
    await logWebhookHit({ source: "ghl_bot_finance", payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
