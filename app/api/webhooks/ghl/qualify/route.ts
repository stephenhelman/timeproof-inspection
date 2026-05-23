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
import { getZoneForZip } from "@/src/lib/service-zones";

const QUALIFY_OPENER =
  "Hey {firstName}! This is Alex with Qntum Roofing. " +
  "Just wanted to confirm we got your inspection request — " +
  "are you still interested in getting your roof checked out?";

function buildQualifySystemPrompt(lead: {
  customerName: string;
  sourceZip: string | null;
  zone: string | null;
  roofAge: string | null;
  knownIssues: unknown;
  decisionMakerHome: string | null;
}): string {
  const knownIssuesStr = Array.isArray(lead.knownIssues)
    ? lead.knownIssues.join(", ")
    : "none reported";

  return `You are a friendly, professional assistant for Qntum Roofing.
Your name is Alex. You are having an SMS conversation with a homeowner
who just requested a free roof inspection.
Your goal is to confirm two things naturally in conversation:

They genuinely want the inspection (not just browsing)
All decision makers will be present at the inspection

Note: homeownership was already confirmed on the Facebook form.
Do not ask about homeownership — it is already verified.
NEPQ principles — never pitch, never push:

Ask about their situation, not what you can sell them
Use consequence questions: "what happens if you keep putting it off?"
If they're hesitant, ask what their concern is — don't overcome objections,
understand them
Frame the inspection as their win: they either get a clean bill of health
or they catch a problem before it gets expensive

Tone: warm, human, conversational. 2-3 sentences max per message.
Never use exclamation points more than once per message.
Never say "I'd be happy to" or "Absolutely!"
Sound like a real person, not a chatbot.
When both gates are confirmed, end your message with exactly:
[QUALIFIED]
If they are not interested, end with: [NOT_INTERESTED]
Lead context:
Name: ${lead.customerName}
ZIP: ${lead.sourceZip ?? "unknown"}
Zone: ${lead.zone ?? "unknown"}
Roof age: ${lead.roofAge ?? "unknown"}
Known issues: ${knownIssuesStr}
Decision maker answer from form: ${lead.decisionMakerHome ?? "not answered"}`;
}

function stripSignals(text: string): string {
  return text.replace(/\[(QUALIFIED|NOT_INTERESTED)\]/g, "").trim();
}

function extractSignal(text: string): "QUALIFIED" | "NOT_INTERESTED" | null {
  if (text.includes("[QUALIFIED]")) return "QUALIFIED";
  if (text.includes("[NOT_INTERESTED]")) return "NOT_INTERESTED";
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
    console.warn(`[qualify] no lead found for ghlContactId=${ghlContactId}`);
    await logWebhookHit({
      source: "ghl_bot_qualify",
      payload: rawBody,
      success: false,
      error: "lead_not_found",
      idempotencyKey,
    });
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
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_dead", "DEAD", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
        sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
      // Do NOT reply — GHL handles STOP at carrier level
      await logWebhookHit({ source: "ghl_bot_qualify", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    // 7. Cancellation check
    if (isCancellation(inboundMessage)) {
      const activeInspection = await prisma.inspection.findFirst({
        where: { leadId: lead.id, status: "scheduled" },
      });
      if (activeInspection) {
        await prisma.inspection.update({
          where: { id: activeInspection.id },
          data: { status: "cancelled", repNotes: "Cancelled by homeowner via SMS" },
        });
        await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_cancelled", "DEMO_NOT_SOLD", {
          sr_status: "DEMO_NOT_SOLD",
          sr_bot_stage: "silent",
        });
        const fn = lead.customerName.trim().split(/\s+/)[0];
        await sendGhlSms(
          ghlContactId,
          `No problem, ${fn}. We'll remove you from the schedule. If you ever want to revisit, just reach out — we're here.`
        );
        await logWebhookHit({ source: "ghl_bot_qualify", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
      // No active inspection — treat as possible disinterest, let the bot handle it naturally
    }

    // 8–9. Load or create thread, append inbound
    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, "qualify");

    // 16. Proactive opener: if brand new thread, send opener first
    if (isNew || messages.length === 0) {
      const fn = lead.customerName.trim().split(/\s+/)[0];
      const opener = QUALIFY_OPENER.replace("{firstName}", fn);
      await sendGhlSms(ghlContactId, opener);
      await appendMessage(threadId, "assistant", opener);
      // If this is the GHL synthetic trigger (no real inbound), return after opener
      if (!inboundMessage || inboundMessage === "new_lead") {
        await logWebhookHit({ source: "ghl_bot_qualify", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
        return NextResponse.json({ ok: true });
      }
    }

    // Append real inbound message
    if (inboundMessage && inboundMessage !== "new_lead") {
      await appendMessage(threadId, "user", inboundMessage);
    }

    // Reload messages after appending
    const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
    const currentMessages = (thread?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];

    // 10. Build system prompt
    const zone = lead.sourceZip ? getZoneForZip(lead.sourceZip) : null;
    const systemPrompt = buildQualifySystemPrompt({
      customerName: lead.customerName,
      sourceZip: lead.sourceZip,
      zone,
      roofAge: lead.roofAge,
      knownIssues: lead.knownIssues,
      decisionMakerHome: lead.decisionMakerHome,
    });

    // 11. Run bot
    const botMessages = currentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    const rawResponse = await runBot(systemPrompt, botMessages);

    // 12. Null = escalated — notification already sent by bot-engine
    if (rawResponse === null) {
      await logWebhookHit({ source: "ghl_bot_qualify", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
      return NextResponse.json({ ok: true });
    }

    const signal = extractSignal(rawResponse);
    const smsText = stripSignals(rawResponse);

    // 13. Send SMS
    await sendGhlSms(ghlContactId, smsText);

    // 14. Append assistant response (with signal retained in thread)
    await appendMessage(threadId, "assistant", rawResponse);

    // 15. Handle signal
    if (signal === "QUALIFIED") {
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_qualified", "NEW", {
        sr_qualify_status: "qualified",
        sr_bot_stage: "booking",
      });
      await addGhlTag(ghlContactId, "sr_booking");
    } else if (signal === "NOT_INTERESTED") {
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_dead", "DEAD", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
      });
    }

    await logWebhookHit({ source: "ghl_bot_qualify", payload: rawBody, success: true, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[qualify] uncaught error:", message);
    await logWebhookHit({ source: "ghl_bot_qualify", payload: rawBody, success: false, error: message, leadId: lead.id, idempotencyKey });
    return NextResponse.json({ ok: true });
  }
}
