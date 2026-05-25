// ============================================================
// SUPERSEDED by central webhook route
// app/api/webhooks/ghl/central/route.ts
//
// This route is preserved for reference and emergency fallback.
// GHL workflows should point to /api/webhooks/ghl/central
// Remove this file after central webhook is confirmed stable.
// ============================================================

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
import { assembleQualifyPrompt } from "@/src/lib/prompts/qntum/assemblers/qualify";
import type { QualifyContext, ConversationTrack, QualifyLastMessageContext } from "@/src/lib/prompts/qntum/types";

// ── QUALIFY BOT SIGNALS ──────────────────────────────────────────────────────
// [QUALIFIED]        → homeowner confirmed genuine, decision maker confirmed,
//                      financial readiness not flagged as a hard constraint
// [NOT_INTERESTED]   → homeowner clearly does not want to proceed
// [SOFT_CLOSE]       → conversation ended warmly but without qualification
//                      (timing issue, not ready, etc.) — no appointment,
//                      no revival tag, just close and log
// [ESCALATE]         → human needed — route as per escalation config
// ────────────────────────────────────────────────────────────────────────────

const QUALIFY_OPENER =
  "Hey {firstName} — this is Alex with Qntum Roofing. " +
  "Following up on your inspection request. " +
  "What made you want to get your roof looked at?";

type BotMessage = { role: string; content: string; timestamp: string };

function detectConversationTrack(messages: BotMessage[]): ConversationTrack {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "problem_unaware";

  const userText = userMessages.map((m) => m.content.toLowerCase()).join(" ");

  const recentUser = userMessages.slice(-3);
  const avgLength =
    recentUser.reduce((sum, m) => sum + m.content.trim().length, 0) /
    recentUser.length;

  // Resistant: guarded/negative language or consistently short replies (2+ messages)
  const resistantPatterns =
    /not interested|leave me alone|stop texting|don't (want|need|call)|go away/;
  if (resistantPatterns.test(userText)) return "resistant";
  if (userMessages.length >= 2 && avgLength < 15) return "resistant";

  // Problem-aware: explicit mention of damage or known issues
  const problemPatterns =
    /leak|leaking|drip|missing shingle|crack|damage|hail|storm|water stain|sagging|rot|blow off|ice dam/;
  if (problemPatterns.test(userText)) return "problem_aware";

  // Warm: long, engaged, detailed replies
  if (avgLength > 60) return "warm";

  return "problem_unaware";
}

function detectLastMessageContext(message: string): QualifyLastMessageContext {
  if (!message || message === "new_lead") return "none";

  const t = message.toLowerCase();

  // Escalation triggers
  if (
    /speak (to|with) (someone|a person|your manager|the owner)|call me back|want a human|need to talk to someone/.test(t) ||
    /that('s| is) (ridiculous|unacceptable|a scam|bs)|you('re| are) (scamming|lying)|waste of my time/.test(t)
  ) return "escalation_needed";

  // Insurance
  if (/insurance|claim|adjuster|deductible|supplement/.test(t)) return "insurance_mention";

  // Competitor
  if (
    /other (company|roofer|contractor)|another (company|roofer)|got a (quote|bid)|someone else (is|came|already)/.test(t)
  ) return "competitor_mention";

  // Financial signal
  if (
    /how much|what('s| does) it cost|afford|tight on|budget|financing|payment plan|loan|fixed income/.test(t)
  ) return "financial_signal";

  // Decision maker issue
  if (
    /husband|wife|spouse|partner|not here|need to (ask|check with|talk to)|she('s| is)|he('s| is) (not|the one)/.test(t)
  ) return "decision_maker_issue";

  // Timing objection
  if (
    /not (right now|a good time)|too busy|next (month|year|season)|later|can't (right now|do it)|not ready/.test(t)
  ) return "timing_objection";

  // Problem confirmed
  if (
    /leak|drip|missing|damage|hail|storm|crack|stain|rot|blow off|sagging/.test(t)
  ) return "problem_confirmed";

  // Negative experience
  if (
    /last (time|company|roofer)|bad experience|they (messed|screwed|didn't)|never again/.test(t)
  ) return "negative_experience";

  // Expressed interest
  if (
    /^(yes|yeah|yep|sure|sounds good|ok|okay|go ahead|let'?s do it|interested|absolutely|definitely)\.?$/.test(
      t.trim()
    ) ||
    /yes[,.]?\s|yeah[,.]?\s|sure[,.]?\s|sounds good|i('m| am) (interested|in)|want to (schedule|do it|move forward)/.test(t)
  ) return "expressed_interest";

  // Problem denied
  if (
    /no (issues|problems|damage)|looks fine|seems fine|everything('s| is) (fine|ok|good)|don't (think|see) any/.test(t)
  ) return "problem_denied";

  return "stalling";
}

function detectStrongSignal(lead: {
  roofAge: string | null;
  knownIssues: unknown;
  lastInspected: string | null;
}): boolean {
  const issues = Array.isArray(lead.knownIssues) ? (lead.knownIssues as string[]) : [];
  const activeIssues = issues.filter((i) => i !== "I haven't noticed anything");
  return activeIssues.length > 0 || lead.roofAge === "20+ years" || lead.lastInspected === "Never, as far as I know";
}

function stripSignals(text: string): string {
  return text
    .replace(/\[(QUALIFIED|NOT_INTERESTED|SOFT_CLOSE|ESCALATE)\]/g, "")
    .trim();
}

function extractSignal(
  text: string
): "QUALIFIED" | "NOT_INTERESTED" | "SOFT_CLOSE" | "ESCALATE" | null {
  if (text.includes("[QUALIFIED]")) return "QUALIFIED";
  if (text.includes("[NOT_INTERESTED]")) return "NOT_INTERESTED";
  if (text.includes("[SOFT_CLOSE]")) return "SOFT_CLOSE";
  if (text.includes("[ESCALATE]")) return "ESCALATE";
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
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_dead", "DEAD", "silent", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
        sr_opted_out: true,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { botOptedOut: true } });
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
        await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_cancelled", "DEMO_NOT_SOLD", "silent", {
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
    }

    // 8–9. Load or create thread, append inbound
    const { id: threadId, messages, isNew } = await getOrCreateThread(ghlContactId, "qualify");

    // Proactive opener: if brand new thread, send opener first
    if (isNew || messages.length === 0) {
      const fn = lead.customerName.trim().split(/\s+/)[0];
      const opener = QUALIFY_OPENER.replace("{firstName}", fn);
      await sendGhlSms(ghlContactId, opener);
      await appendMessage(threadId, "assistant", opener);
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
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    // 10. Build QualifyContext and assemble prompt
    const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? "") : "";
    const knownIssues = Array.isArray(lead.knownIssues)
      ? (lead.knownIssues as string[])
      : null;

    // Detect source type from lead.source field
    const rawSource = (lead as unknown as { source?: string }).source ?? null;
    const sourceMap: Record<string, QualifyContext['source']> = {
      'facebook-inspection': 'facebook-inspection',
      'facebook-guide': 'facebook-guide',
      'door': 'door',
      'card': 'card',
    };
    const source: QualifyContext['source'] = rawSource && rawSource in sourceMap
      ? sourceMap[rawSource]
      : (rawSource === 'facebook' || rawSource === 'ghl_facebook') ? 'facebook-inspection' : null;

    // came_from_nurture: true if the lead had a nurture thread before this qualify thread
    const nurtureThread = await prisma.botThread.findFirst({
      where: { ghlContactId, botType: 'nurture' },
    });
    const came_from_nurture = nurtureThread !== null;

    // scheduling_approved_pause: true if this message was triggered by the scheduling_approved webhook
    const scheduling_approved_pause = inboundMessage === 'scheduling_approved';

    const context: QualifyContext = {
      bot_type: "qualify",
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source_zip: lead.sourceZip ?? "",
      zone,
      message_history_count: currentMessages.length,
      last_message_context: detectLastMessageContext(inboundMessage),
      conversation_track: detectConversationTrack(currentMessages),
      roof_age: lead.roofAge,
      known_issues: knownIssues,
      last_inspected: lead.lastInspected,
      decision_maker_home: lead.decisionMakerHome,
      has_strong_signal: detectStrongSignal({
        roofAge: lead.roofAge,
        knownIssues: lead.knownIssues,
        lastInspected: lead.lastInspected,
      }),
      source,
      came_from_nurture,
      scheduling_approved_pause,
    };

    const systemPrompt = assembleQualifyPrompt(context);

    // 11. Run bot
    const botMessages = currentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    const rawResponse = await runBot(systemPrompt, botMessages);

    // 12. Null = [ESCALATE] handled by bot-engine (notifyManager already called)
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
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_qualified", "NEW", "booking", {
        sr_qualify_status: "qualified",
        sr_bot_stage: "booking",
      });
      await addGhlTag(ghlContactId, "sr_booking");

    } else if (signal === "NOT_INTERESTED") {
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_dead", "DEAD", "silent", {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
      });

    } else if (signal === "SOFT_CLOSE") {
      // Warm close — not qualified, not dead. Remove qualifying tag, go silent.
      // No revival tag added. Preserves goodwill for future outreach.
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", null, "NEW", "silent", {
        sr_bot_stage: "silent",
      });
      await addGhlTag(ghlContactId, "sr_soft_close");
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
