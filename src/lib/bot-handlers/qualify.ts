import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isCancellation,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  getGhlContactCustomField,
  writeGhlContactCustomField,
  moveGhlOpportunityStage,
} from "@/src/lib/ghl-contacts";
import { getZoneForZip } from "@/src/lib/service-zones";
import { assembleQualifyPrompt } from "@/src/lib/prompts/qntum/assemblers/qualify";
import type {
  QualifyContext,
  ConversationTrack,
  QualifyLastMessageContext,
} from "@/src/lib/prompts/qntum/types";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

function stripAnySignals(text: string): string {
  return text.replace(/\[[A-Z_:0-9 .-]+\]/g, "").trim();
}

function detectQualifyConversationTrack(
  messages: BotMessage[],
): ConversationTrack {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "problem_unaware";
  const userText = userMessages.map((m) => m.content.toLowerCase()).join(" ");
  const recentUser = userMessages.slice(-3);
  const avgLength =
    recentUser.reduce((sum, m) => sum + m.content.trim().length, 0) /
    recentUser.length;
  if (
    /not interested|leave me alone|stop texting|don't (want|need)|go away/.test(
      userText,
    )
  )
    return "resistant";
  if (userMessages.length >= 2 && avgLength < 15) return "resistant";
  if (
    /leak|leaking|drip|missing shingle|crack|damage|hail|storm|water stain|sagging|rot|blow off|ice dam/.test(
      userText,
    )
  )
    return "problem_aware";
  if (avgLength > 60) return "warm";
  return "problem_unaware";
}

function detectQualifyLastMessageContext(
  message: string,
): QualifyLastMessageContext {
  if (!message || message === "new_lead") return "none";
  const t = message.toLowerCase();
  if (
    /speak (to|with) (someone|a person|your manager)|call me back|want a human/.test(
      t,
    )
  )
    return "escalation_needed";
  if (/insurance|claim|adjuster|deductible/.test(t)) return "insurance_mention";
  if (
    /other (company|roofer)|another (company|roofer)|got a (quote|bid)/.test(t)
  )
    return "competitor_mention";
  if (/how much|what('s| does) it cost|afford|financing|payment plan/.test(t))
    return "financial_signal";
  if (/husband|wife|spouse|partner|not here|need to (ask|check with)/.test(t))
    return "decision_maker_issue";
  if (/not (right now|a good time)|too busy|not ready|can't/.test(t))
    return "timing_objection";
  if (/leak|drip|missing|damage|hail|storm|crack|stain|rot|blow off/.test(t))
    return "problem_confirmed";
  if (/last (time|company)|bad experience|they (messed|screwed)/.test(t))
    return "negative_experience";
  if (
    /^(yes|yeah|yep|sure|sounds good|ok|okay|go ahead|let'?s do it)\.?$/.test(
      t.trim(),
    )
  )
    return "expressed_interest";
  if (
    /no (issues|problems|damage)|looks fine|everything('s| is) (fine|ok)/.test(
      t,
    )
  )
    return "problem_denied";
  return "stalling";
}

// Transitional SMS sent right before booking stage activation.
// Acknowledges time preference + confirmed issue, then asks for address.
async function generateTransitionalSms(
  firstName: string,
  contextTimePreference: string | null,
  contextConfirmedIssue: string | null,
  recentMessages: BotMessage[],
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const timeLine = contextTimePreference
    ? `Time preference already confirmed: "${contextTimePreference}".`
    : "";
  const issueLine = contextConfirmedIssue
    ? `Confirmed issue mentioned by homeowner: "${contextConfirmedIssue}".`
    : "";

  const history = recentMessages.slice(-4).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const instruction = {
    role: "user" as const,
    content: [
      `Homeowner first name: ${firstName}.`,
      timeLine,
      issueLine,
      "Write the transition SMS now — one message only, end with the address question.",
    ]
      .filter(Boolean)
      .join(" "),
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        system:
          "You are Alex, a texting rep for Qntum Roofing. " +
          "Write exactly one SMS that does the following in order: " +
          "(1) If a time preference was confirmed, acknowledge it naturally in one phrase — do not repeat it robotically. " +
          "(2) If a confirmed issue was mentioned, reference it briefly. " +
          "(3) Transition directly into booking by asking for the homeowner's address. " +
          "Do not ask about scheduling or time preference — that is already confirmed. " +
          "End with the address question. Sound natural, not scripted. No emojis. " +
          "Do not mention it is free. Do not repeat qualification points. " +
          "Return only the SMS text, nothing else.",
        messages: [...history, instruction],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    return (data?.content?.[0]?.text ?? "").trim() || null;
  } catch {
    return null;
  }
}

const QUALIFY_OPENER =
  `Hey {firstName} — this is Alex with Qntum Roofing. ` +
  `Following up on your inspection request. ` +
  `What made you want to get your roof looked at?`;

export async function handleQualifyWebhook(ctx: {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
}): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg } = ctx;

  // Capture before type narrowing strips the literal
  const scheduling_approved_pause = trigger === "scheduling_approved";

  // ── Opener triggers ────────────────────────────────────────────────────────
  if (trigger === "new_inspection_lead" || trigger === "scheduling_approved") {
    const { id: threadId, messages } = await getOrCreateThread(
      ghlContactId,
      "qualify",
    );
    if (messages.length === 0) {
      const fn = lead.customerName.trim().split(/\s+/)[0];
      const opener = QUALIFY_OPENER.replace("{firstName}", fn);
      await sendGhlSms(ghlContactId, opener);
      await appendMessage(threadId, "assistant", opener);
    }
    return;
  }

  if (trigger !== "inbound_sms") {
    return;
  }

  // ── inbound_sms ────────────────────────────────────────────────────────────

  if (isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: "scheduled" },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: {
          status: "cancelled",
          repNotes: "Cancelled by homeowner via SMS",
        },
      });
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_qualifying",
        "sr_cancelled",
        "DEMO_NOT_SOLD",
        "silent",
        { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "silent" },
      );
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendGhlSms(
        ghlContactId,
        `No problem, ${fn}. We'll remove you from the schedule. If you ever want to revisit, just reach out.`,
      );
      return;
    }
  }

  const {
    id: threadId,
    messages,
    isNew,
  } = await getOrCreateThread(ghlContactId, "qualify");

  if (isNew || messages.length === 0) {
    const fn = lead.customerName.trim().split(/\s+/)[0];
    const opener = QUALIFY_OPENER.replace("{firstName}", fn);
    await sendGhlSms(ghlContactId, opener);
    await appendMessage(threadId, "assistant", opener);
    if (!inboundMsg || inboundMsg === "new_lead") {
      return;
    }
  }

  if (inboundMsg && inboundMsg !== "new_lead") {
    await appendMessage(threadId, "user", inboundMsg);
  }

  const thread = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];

  const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? "") : "";
  const knownIssues = Array.isArray(lead.knownIssues)
    ? (lead.knownIssues as string[])
    : null;
  const activeIssues = (knownIssues ?? []).filter(
    (i) => i !== "I haven't noticed anything",
  );

  const rawLead = lead as unknown as Record<string, unknown>;
  type QSrc = QualifyContext["source"];
  const rawSource = (rawLead.source as string) ?? null;
  const srcMap: Record<string, QSrc> = {
    "facebook-inspection": "facebook-inspection",
    "facebook-guide": "facebook-guide",
    door: "door",
    card: "card",
  };
  const source: QSrc =
    rawSource && rawSource in srcMap
      ? srcMap[rawSource]
      : rawSource === "facebook" || rawSource === "ghl_facebook"
        ? "facebook-inspection"
        : null;

  const nurtureThread = await prisma.botThread.findFirst({
    where: { ghlContactId, botType: "nurture" },
  });

  // Read nurture bot context written on [INSPECTION_INTENT]
  const previousBotContext = process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT
    ? await getGhlContactCustomField(
        ghlContactId,
        process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT,
      ).catch(() => null)
    : null;

  const context: QualifyContext = {
    bot_type: "qualify",
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source_zip: lead.sourceZip ?? "",
    zone,
    message_history_count: currentMessages.length,
    last_message_context: detectQualifyLastMessageContext(inboundMsg),
    conversation_track: detectQualifyConversationTrack(currentMessages),
    roof_age: lead.roofAge,
    known_issues: knownIssues,
    last_inspected: lead.lastInspected,
    decision_maker_home: lead.decisionMakerHome,
    has_strong_signal:
      activeIssues.length > 0 ||
      lead.roofAge === "20+ years" ||
      lead.lastInspected === "Never, as far as I know",
    source,
    came_from_nurture: nurtureThread !== null,
    scheduling_approved_pause,
    previousBotContext: previousBotContext ?? undefined,
  };

  const systemPrompt = assembleQualifyPrompt(context);
  const botMessages = currentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
      console.error("[qualify] updateSrLead silent failed", err),
    );
    return;
  }

  if (!lead.ghlOpportunityId) {
    console.warn(
      `[qualify] lead ${lead.id} has no ghlOpportunityId — ` +
        `pipeline stage moves will be skipped.`,
    );
  }

  const signalQualified = rawResponse.includes("[QUALIFIED]");
  const signalNotInterested = rawResponse.includes("[NOT_INTERESTED]");
  const signalSoftClose = rawResponse.includes("[SOFT_CLOSE]");

  const cleanResponse = rawResponse
    .replace("[QUALIFIED]", "")
    .replace("[NOT_INTERESTED]", "")
    .replace("[SOFT_CLOSE]", "")
    .trim();

  if (cleanResponse) {
    await sendGhlSms(ghlContactId, cleanResponse);
  }
  await appendMessage(threadId, "assistant", rawResponse);

  if (signalQualified) {
    const issueKeywords = /stain|leak|damage|missing|crack|old|shingle|water|rot|hail/i;
    const userMsgs = currentMessages.filter((m) => m.role === "user");
    const confirmedIssueMsg = userMsgs.find((m) => issueKeywords.test(m.content));

    const timePatterns = [
      /after \d{1,2}(:\d{2})?\s*(am|pm)?/i,
      /before \d{1,2}(:\d{2})?\s*(am|pm)?/i,
      /\d{1,2}(:\d{2})?\s*(am|pm)/i,
      /morning|afternoon|evening/i,
      /tomorrow/i,
    ];
    let timePreference: string | null = null;
    timeLoop: for (const msg of userMsgs) {
      for (const pat of timePatterns) {
        const match = pat.exec(msg.content);
        if (match) { timePreference = match[0]; break timeLoop; }
      }
    }

    if (process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
      const contextParts: string[] = [];
      if (confirmedIssueMsg) contextParts.push(`Confirmed issue: "${confirmedIssueMsg.content}"`);
      if (lead.roofAge) contextParts.push(`Roof age: "${lead.roofAge}"`);
      if (lead.decisionMakerHome) contextParts.push(`Decision maker present: "${lead.decisionMakerHome}"`);
      if (timePreference) contextParts.push(`Time preference: "${timePreference}"`);
      if (nurtureThread !== null) contextParts.push("Came from nurture: true");
      contextParts.push(`Source: "${rawSource ?? srLead.srSource ?? "unknown"}"`);
      contextParts.push("Qualified via qualify bot");

      const previousContext = contextParts.join(" | ");
      await writeGhlContactCustomField(
        ghlContactId,
        process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT,
        previousContext,
      ).catch((err) =>
        console.error(
          "[qualify] GHL write sr_previous_context failed for contact",
          ghlContactId,
          ":",
          err,
        ),
      );
    }

    // Transitional SMS before booking activation
    const transitional = await generateTransitionalSms(
      lead.customerName.trim().split(/\s+/)[0],
      timePreference,
      confirmedIssueMsg?.content ?? null,
      currentMessages,
    );
    if (transitional) await sendGhlSms(ghlContactId, transitional);

    await updateSrLead(lead.id, {
      sr_bot_stage: "booking",
      sr_qualify_status: "qualified",
    });

    if (lead.ghlOpportunityId) {
      await moveGhlOpportunityStage(
        lead.ghlOpportunityId,
        process.env.GHL_STAGE_BOOKING!,
      ).catch((err) =>
        console.error(
          "[qualify] moveGhlOpportunityStage BOOKING failed",
          err,
        ),
      );
    } else {
      console.warn(`[qualify] no ghlOpportunityId on lead ${lead.id}`);
    }

    await Promise.allSettled([
      addGhlTag(ghlContactId, "sr_qualified"),
      addGhlTag(ghlContactId, "sr_booking"),
      removeGhlTag(ghlContactId, "sr_qualifying"),
    ]);
    // GHL workflow reacts to the stage move and fires qualified_handoff webhook
    // — that activates the book bot. No direct message send needed here.
  }

  if (signalNotInterested) {
    await updateSrLead(lead.id, {
      sr_bot_stage: "silent",
      sr_status: "DEAD",
    });
    await Promise.allSettled([
      addGhlTag(ghlContactId, "sr_dead"),
      removeGhlTag(ghlContactId, "sr_qualifying"),
      lead.ghlOpportunityId
        ? moveGhlOpportunityStage(
            lead.ghlOpportunityId,
            process.env.GHL_STAGE_DEAD!,
          )
        : Promise.resolve(),
    ]);
  }

  if (signalSoftClose) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
      console.error("[qualify] updateSrLead soft_close failed", err),
    );
    await addGhlTag(ghlContactId, "sr_soft_close").catch((err) =>
      console.error("[qualify] addGhlTag soft_close failed", err),
    );
  }
}
