// Trigger: sr_follow_up tag added to a GHL contact.
// This tag is applied by the DispoModal in Phase 5 when a lead reaches
// DEMO_NOT_SOLD, DENIED, or NO_SHOW. GHL automation fires a webhook to
// this route when the tag is added, and for every subsequent inbound SMS
// from that contact while the tag is active.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isOptOut,
  isCancellation,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  parseInboundSms,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";

function buildRevivalSystemPrompt(lead: {
  customerName: string;
  knownIssues: unknown;
  inspectionFindings: string | null;
  dispoPrimaryObjection: string | null;
  dispoNotes: string | null;
  daysSinceInspection: number;
}): string {
  const knownIssuesStr = Array.isArray(lead.knownIssues)
    ? lead.knownIssues.join(", ")
    : lead.knownIssues
    ? String(lead.knownIssues)
    : "not recorded";

  return `You are Alex, a follow-up specialist for Qntum Roofing.
You are reaching out to a homeowner who previously had a roof
inspection but did not move forward at that time.
Your goal is to re-open the conversation using NEPQ principles:

Reference their specific situation — use the context provided
Ask about what's changed, not what you can offer
Consequence questions: what happens if they continue to wait?
Never pitch the product — let them arrive at the need themselves

Their inspection found: ${lead.inspectionFindings ?? "findings not recorded"}
Their original concern was: ${knownIssuesStr}
Primary objection at time of demo: ${lead.dispoPrimaryObjection ?? "not recorded"}
Rep notes: ${lead.dispoNotes ?? "none"}
Time since inspection: ${lead.daysSinceInspection} days
Opening message approach:

Reference something specific from their inspection or situation
Not "just checking in" — that's weak and forgettable
Ask a consequence question about their specific finding
2-3 sentences max

When they agree to re-book, end with: [RE_QUALIFY]
When they are definitively not interested, end with: [DEAD]`;
}

function stripSignals(text: string): string {
  return text
    .replace(/\[RE_QUALIFY\]/g, "")
    .replace(/\[DEAD\]/g, "")
    .trim();
}

function extractSignal(text: string): "RE_QUALIFY" | "DEAD" | null {
  if (text.includes("[RE_QUALIFY]")) return "RE_QUALIFY";
  if (text.includes("[DEAD]")) return "DEAD";
  return null;
}

export async function POST(request: NextRequest) {
  // 1. Validate secret
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  // 2. Parse body
  let rawBody: unknown = null;
  try { rawBody = await request.json(); } catch { /* fall through */ }

  const parsed = parseInboundSms(rawBody);
  if (!parsed) {
    return NextResponse.json({ ok: true, warning: "unparseable_payload" });
  }

  const { ghlContactId, inboundMessage, idempotencyKey } = parsed;

  // 3. Idempotency check
  if (await isDuplicate(idempotencyKey)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 4. Load lead
  const lead = await loadLead(ghlContactId);
  if (!lead) {
    console.warn(`[revival] no lead found for ghlContactId=${ghlContactId}`);
    await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: false, error: "lead_not_found", idempotencyKey });
    return NextResponse.json({ ok: true, warning: "lead_not_found" });
  }

  try {
    // 5. DND / opted-out check
    if (lead.botOptedOut) {
      return NextResponse.json({ ok: true, skipped: "opted_out" });
    }

    // 6. Opt-out keyword
    if (isOptOut(inboundMessage)) {
      await addGhlTag(ghlContactId, "sr_opted_out");
      await transitionLead(lead.id, ghlContactId, "sr_follow_up", "sr_dead", "DEAD", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
        sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // 7. Cancellation check — treated as disinterest in revival context
    if (isCancellation(inboundMessage)) {
      // No active appointment at this stage, fall through to bot to handle naturally
    }

    // 8. Load or create thread
    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, "revival");

    // Build context for system prompt
    const lastInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
    });

    const inspectionFindings =
      lastInspection?.findingsNotes ??
      (lastInspection?.diagnosis ? JSON.stringify(lastInspection.diagnosis) : null);

    const daysSinceInspection = lastInspection?.createdAt
      ? Math.floor((Date.now() - lastInspection.createdAt.getTime()) / 86400000)
      : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dispoPrimaryObjection = (lead as any).dispoPrimaryObjection as string | null ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dispoNotes = (lead as any).dispoNotes as string | null ?? null;

    const systemPrompt = buildRevivalSystemPrompt({
      customerName: lead.customerName,
      knownIssues: lead.knownIssues,
      inspectionFindings,
      dispoPrimaryObjection,
      dispoNotes,
      daysSinceInspection,
    });

    // 9. Proactive opener: new thread → Claude generates the opening message
    if (isNew || messages.length === 0) {
      // Synthesize an opener by running the bot with no prior messages
      const openerMessages = [
        {
          role: "user" as const,
          content: "follow_up_triggered",
          timestamp: new Date().toISOString(),
        },
      ];
      const openerRaw = await runBot(systemPrompt, openerMessages);
      if (openerRaw === null) {
        await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
      const openerClean = stripSignals(openerRaw);
      await sendGhlSms(ghlContactId, openerClean);
      await appendMessage(threadId, "assistant", openerRaw);

      if (!inboundMessage || inboundMessage === "follow_up_triggered") {
        await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    // 10. Append inbound message
    if (inboundMessage && inboundMessage !== "follow_up_triggered") {
      await appendMessage(threadId, "user", inboundMessage);
    }

    // Reload messages
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];

    // 11. Run bot
    const botMessages = currentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    const rawResponse = await runBot(systemPrompt, botMessages);

    // 12. Null = escalated — notification already sent by bot-engine
    if (rawResponse === null) {
      await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const smsText = stripSignals(rawResponse);

    // 13. Send SMS
    await sendGhlSms(ghlContactId, smsText);

    // 14. Append assistant response
    await appendMessage(threadId, "assistant", rawResponse);

    // 15. Handle signal
    if (signal === "RE_QUALIFY") {
      await transitionLead(lead.id, ghlContactId, "sr_follow_up", "sr_recovered", "NEW", {
        sr_status: "NEW",
        sr_bot_stage: "booking",
      });
      await addGhlTag(ghlContactId, "sr_booking");
    } else if (signal === "DEAD") {
      await transitionLead(lead.id, ghlContactId, "sr_follow_up", "sr_dead", "DEAD", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
      });
    }

    await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[revival] uncaught error:", message);
    await logWebhookHit({ source: "ghl_bot_revival", payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
