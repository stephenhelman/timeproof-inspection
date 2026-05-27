// ── CENTRAL GHL WEBHOOK ───────────────────────────────────────────────────────
// All GHL workflow webhooks route here.
// Routing is determined by srBotStage on the SrLead DB record.
// The trigger field (from customData.trigger) determines what to do in that stage.
//
// TRIGGERS:
//   inbound_sms           → homeowner replied — run bot conversation
//   new_guide_lead        → guide form submitted — send nurture opener
//   new_inspection_lead   → new inspection lead — send qualify opener
//   scheduling_approved   → ZIP review approved — activate qualify
//   qualified_handoff     → qualify complete — send booking opener
//   stall_followup        → 24hr stall — fetch slots, follow up
//   stall_exhausted       → stall expired — move to revival
//   nurture_drip          → soft-close drip — send drip message
//   follow_up_triggered   → revival activation
//   reschedule_triggered  → reschedule activation
//   credit_fail_triggered → finance activation
//   finance_retry         → 7-day finance retry
// ─────────────────────────────────────────────────────────────────────────────

// ── GHL WORKFLOW REQUIRED ────────────────────────────────────────────────────
// Workflow: Booking Bot Activation
// Trigger:  Opportunity moved to stage "Booking"
//           (Pipeline: Inspection Pipeline)
// Action:   Send outbound webhook
//           URL: /api/webhooks/ghl/central
//           Header: x-ghl-secret: [secret]
//           Body:
//           {
//             "customData": {
//               "contact_id": "{{contact.id}}",
//               "trigger": "qualified_handoff"
//             }
//           }
//
// This workflow is what activates the book bot.
// The server moves the opportunity to Booking stage,
// GHL reacts with this workflow, book bot fires.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isOptOut,
  isCancellation,
  purgeExpiredSlotLocks,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  confirmBooking,
  notifyRep,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getSrLeadFromDb, updateSrLead } from "@/src/lib/ghl-custom-object";
import { moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";
import {
  getZoneForZip,
  getZipTier,
  SERVICE_ZONES,
  isDistanceZone,
} from "@/src/lib/service-zones";
import { assembleQualifyPrompt } from "@/src/lib/prompts/qntum/assemblers/qualify";
import { assembleBookPrompt } from "@/src/lib/prompts/qntum/assemblers/book";
import {
  detectTimePreference,
  TIME_WINDOWS,
  type TimeOfDay,
} from "@/src/lib/time-utils";
import { assembleNurturePrompt } from "@/src/lib/prompts/qntum/assemblers/nurture";
import { assembleRevivalPrompt } from "@/src/lib/prompts/qntum/assemblers/revival";
import { assembleReschedulePrompt } from "@/src/lib/prompts/qntum/assemblers/reschedule";
import { assembleFinancePrompt } from "@/src/lib/prompts/qntum/assemblers/finance";
import type {
  QualifyContext,
  ConversationTrack,
  QualifyLastMessageContext,
  BookContext,
  BookLastMessageContext,
  NurtureContext,
  NurtureLastMessageContext,
  RevivalContext,
  RevivalScenario,
  RevivalLastMessageContext,
  RescheduleContext,
  RescheduleReason,
  RescheduleLastMessageContext,
  FinanceContext,
  FinanceLastMessageContext,
} from "@/src/lib/prompts/qntum/types";
import type { Lead, SrLead } from "@prisma/client";

// ── Context type ──────────────────────────────────────────────────────────────

interface CentralWebhookContext {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
  dripPosition: number | null;
  idempotencyKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawBody: any;
}

type BotMessage = { role: string; content: string; timestamp: string };

// ── Shared signal helpers ─────────────────────────────────────────────────────

function stripAnySignals(text: string): string {
  return text.replace(/\[[A-Z_:0-9 .-]+\]/g, "").trim();
}

// ── Qualify handler ───────────────────────────────────────────────────────────

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

async function handleQualifyWebhook(ctx: CentralWebhookContext): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;

  const QUALIFY_OPENER =
    `Hey {firstName} — this is Alex with Qntum Roofing. ` +
    `Following up on your inspection request. ` +
    `What made you want to get your roof looked at?`;

  // Capture before type narrowing strips the literal
  const scheduling_approved_pause = trigger === "scheduling_approved";

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

  if (trigger !== "inbound_sms") return;

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
        {
          sr_status: "DEMO_NOT_SOLD",
          sr_bot_stage: "silent",
        },
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
    if (!inboundMsg || inboundMsg === "new_lead") return;
  }

  if (inboundMsg && inboundMsg !== "new_lead") {
    await appendMessage(threadId, "user", inboundMsg);
  }

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];

  const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? "") : "";
  const knownIssues = Array.isArray(lead.knownIssues)
    ? (lead.knownIssues as string[])
    : null;
  const activeIssues = (knownIssues ?? []).filter(
    (i) => i !== "I haven't noticed anything",
  );

  const rawSource =
    ((lead as unknown as Record<string, unknown>).source as string) ?? null;
  type QSrc = QualifyContext["source"];
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
  };

  const systemPrompt = assembleQualifyPrompt(context);
  const botMessages = currentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" })
      .catch(err => console.error("[qualify] updateSrLead silent failed", err));
    return;
  }

  if (!lead.ghlOpportunityId) {
    console.warn(
      `[qualify] lead ${lead.id} has no ghlOpportunityId — ` +
      `pipeline stage moves will be skipped. ` +
      `Check that qualify/complete created the opportunity ` +
      `and saved the ID to the lead record.`
    );
  }

  const signalQualified     = rawResponse.includes("[QUALIFIED]");
  const signalNotInterested = rawResponse.includes("[NOT_INTERESTED]");
  const signalSoftClose     = rawResponse.includes("[SOFT_CLOSE]");

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
    await updateSrLead(lead.id, {
      sr_bot_stage:      "booking",
      sr_qualify_status: "qualified",
    });

    if (lead.ghlOpportunityId) {
      await moveGhlOpportunityStage(
        lead.ghlOpportunityId,
        process.env.GHL_STAGE_BOOKING!,
      ).catch(err =>
        console.error("[qualify] moveGhlOpportunityStage BOOKING failed", err)
      );
    } else {
      console.warn(
        `[qualify] handleQualifyWebhook: no ghlOpportunityId on lead ${lead.id}`,
      );
    }

    await Promise.allSettled([
      addGhlTag(ghlContactId, "sr_qualified"),
      addGhlTag(ghlContactId, "sr_booking"),
      removeGhlTag(ghlContactId, "sr_qualifying"),
    ]);
    // GHL workflow reacts to the stage move and fires qualified_handoff webhook
    // — that activates the book bot. No direct message send here.
    return;
  }

  if (signalNotInterested) {
    await updateSrLead(lead.id, {
      sr_bot_stage: "silent",
      sr_status:    "DEAD",
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
    await updateSrLead(lead.id, {
      sr_bot_stage: "silent",
    }).catch(err => console.error("[qualify] updateSrLead soft_close failed", err));
    await addGhlTag(ghlContactId, "sr_soft_close")
      .catch(err => console.error("[qualify] addGhlTag soft_close failed", err));
  }
}

// ── Book handler ──────────────────────────────────────────────────────────────

function detectBookLastMessageContext(message: string): BookLastMessageContext {
  if (!message) return "none";
  const t = message.toLowerCase().trim();
  if (/speak (to|with) (someone|a person|manager)|call me|want a human/.test(t))
    return "escalation_needed";
  if (/check (with|my)|need to (ask|check)|not sure (yet|about)/.test(t))
    return "stall";
  if (
    /^(yes|yeah|yep|sure|confirmed|that works|perfect|ok|okay|sounds good)\.?$/.test(
      t,
    ) ||
    /that work|confirmed|book it/.test(t)
  )
    return "confirmed";
  if (
    /can('t| not)|won't work|not (available|good)|different (time|day)/.test(t)
  )
    return "slot_rejected";
  return "none";
}

function buildBookConfirmationSms(datetime: Date): string {
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  }).format(datetime);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(datetime);
  return `You're all set — got you down for ${dayLabel} at ${timeLabel.toLowerCase()}. Our inspector will reach out the morning of with a heads up.`;
}

async function handleBookWebhook(ctx: CentralWebhookContext): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;

  if (trigger === "stall_exhausted") {
    await transitionLead(
      lead.id,
      ghlContactId,
      "sr_booking",
      "sr_follow_up",
      "REVIVAL_PENDING",
      "revival",
      {
        sr_status: "DEMO_NOT_SOLD",
        sr_bot_stage: "revival",
      },
    );
    await addGhlTag(ghlContactId, "sr_follow_up");
    return;
  }

  if (trigger === "inbound_sms" && isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: "scheduled" },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: { status: "cancelled", repNotes: "Cancelled via SMS" },
      });
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_booking",
        "sr_cancelled",
        "DEMO_NOT_SOLD",
        "silent",
        { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "silent" },
      );
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendGhlSms(
        ghlContactId,
        `No problem, ${fn}. We've cancelled your inspection. If things change, reach out anytime.`,
      );
      return;
    }
  }

  await purgeExpiredSlotLocks();

  const leadZone = lead.sourceZip
    ? (getZoneForZip(lead.sourceZip) ?? null)
    : null;
  const distanceZone = leadZone ? isDistanceZone(leadZone) : false;
  const zone = leadZone ?? "el_paso_central";

  // Detect time-of-day preference from homeowner message
  let timePreference: TimeOfDay = 'any';
  let specificStartHour: number | undefined;
  if (trigger === "inbound_sms" && inboundMsg) {
    const detected = detectTimePreference(inboundMsg);
    if (detected) {
      timePreference    = detected.preference;
      specificStartHour = detected.startHour;
    }
  }

  const existingLock = await prisma.slotLock.findUnique({
    where: { leadId: lead.id },
  });

  let rawSlots: Array<{ date: string; time: string; label: string }> = [];
  if (
    !existingLock ||
    trigger === "qualified_handoff" ||
    trigger === "stall_followup"
  ) {
    rawSlots = await getAvailableSlots(zone, distanceZone, timePreference, specificStartHour);
    if (rawSlots.length > 0) {
      const [y, m, d] = rawSlots[0].date.split("-").map(Number);
      await createSlotLock({
        date: new Date(y, m - 1, d),
        time: rawSlots[0].time,
        zone,
        leadId: lead.id,
      });
    }
  }

  const { id: threadId, messages } = await getOrCreateThread(
    ghlContactId,
    "book",
  );

  type Trigger = BookContext["trigger"];
  const triggerMap: Record<string, Trigger> = {
    qualified_handoff: "qualified_handoff",
    stall_followup: "stall_followup",
  };
  const bookTrigger: Trigger = triggerMap[trigger] ?? "inbound_reply";

  const knownIssues = Array.isArray(lead.knownIssues)
    ? (lead.knownIssues as string[])
    : [];
  const activeIssues = knownIssues.filter(
    (i) => i !== "I haven't noticed anything",
  );

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];
  const lastUserMsg = [...currentMessages]
    .reverse()
    .find((m) => m.role === "user");

  const timeWindow    = TIME_WINDOWS[timePreference];
  const timeWindowLabel = timeWindow.label;

  const context: BookContext = {
    bot_type: "book",
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source_zip: lead.sourceZip ?? "",
    zone: leadZone ?? "",
    message_history_count: currentMessages.length,
    last_message_context: detectBookLastMessageContext(
      lastUserMsg?.content ?? inboundMsg,
    ),
    available_slots: rawSlots.map((s) => ({
      date: s.date,
      time: s.time,
      label: s.label,
      zone_label: zone,
    })),
    locked_slot: existingLock
      ? {
          date: existingLock.date?.toString() ?? "",
          time: existingLock.time ?? "",
          label: rawSlots[0]?.label ?? "",
        }
      : null,
    qualify_summary: {
      problem_confirmed: activeIssues.length > 0,
      specific_issue: activeIssues[0]?.toLowerCase() ?? null,
      roof_age: lead.roofAge ?? null,
      decision_maker_confirmed: lead.decisionMakerHome === "Yes",
    },
    trigger: bookTrigger,
    timePreference,
    timeWindowLabel,
  };

  const systemPrompt = assembleBookPrompt(context);

  if (bookTrigger === "qualified_handoff" && messages.length === 0) {
    const openerRaw = await runBot(systemPrompt, [
      {
        role: "user",
        content: "qualified_handoff",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (openerRaw !== null) {
      await sendGhlSms(ghlContactId, stripAnySignals(openerRaw));
      await appendMessage(threadId, "assistant", openerRaw);
    }
    return;
  }

  if (
    inboundMsg &&
    !["qualified_handoff", "stall_followup"].includes(trigger)
  ) {
    await appendMessage(threadId, "user", inboundMsg);
  }

  if (bookTrigger === "stall_followup") {
    const stalledThread = await prisma.botThread.findUnique({
      where: { id: threadId },
    });
    const stalledMessages = (stalledThread?.messages as BotMessage[]) ?? [];
    const botMessages = stalledMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    botMessages.push({
      role: "user",
      content: "stall_followup",
      timestamp: new Date().toISOString(),
    });
    const rawResponse = await runBot(systemPrompt, botMessages);
    if (rawResponse === null) {
      await updateSrLead(lead.id, { sr_bot_stage: "silent" })
        .catch(err => console.error("[book/stall] updateSrLead silent failed", err));
      return;
    }
    await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
    await appendMessage(threadId, "assistant", rawResponse);
    if (rawResponse.includes("[STALL]")) {
      await addGhlTag(ghlContactId, "booking_stall_exhausted");
      await addGhlTag(ghlContactId, "sr_follow_up");
    }
    return;
  }

  const reloadedThread = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
  const botMessages = reloadedMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" })
      .catch(err => console.error("[book] updateSrLead silent failed", err));
    return;
  }

  // [CHECK_MORE_SLOTS: HH:MM] — bot needs slots filtered to the homeowner's stated time preference.
  // Re-fetch with minTime, re-run bot with fresh context. The [CHECK_MORE_SLOTS] response
  // is an internal signal and is never sent to the homeowner or appended to the thread.
  const checkSlotsMatch = rawResponse.match(/\[CHECK_MORE_SLOTS(?::\s*(\d{2}:\d{2}))?\]/);
  if (checkSlotsMatch) {
    // If the signal includes a time (e.g. [CHECK_MORE_SLOTS: 14:00]), map it to a preference bucket
    let retryPreference: TimeOfDay = timePreference;
    let retryStartHour: number | undefined = specificStartHour;
    const timeStr = checkSlotsMatch[1];
    if (timeStr) {
      retryStartHour = parseInt(timeStr.split(":")[0], 10);
      if (retryStartHour < 12)      retryPreference = 'morning';
      else if (retryStartHour < 17) retryPreference = 'afternoon';
      else                          retryPreference = 'evening';
    }
    const freshSlots = await getAvailableSlots(zone, distanceZone, retryPreference, retryStartHour);
    if (freshSlots.length > 0) {
      const [fy, fm, fd] = freshSlots[0].date.split("-").map(Number);
      await createSlotLock({
        date: new Date(fy, fm - 1, fd),
        time: freshSlots[0].time,
        zone,
        leadId: lead.id,
      });
    }
    const retryWindow = TIME_WINDOWS[retryPreference];
    const freshContext: BookContext = {
      ...context,
      available_slots: freshSlots.map((s) => ({
        date: s.date,
        time: s.time,
        label: s.label,
        zone_label: zone,
      })),
      locked_slot: freshSlots[0]
        ? { date: freshSlots[0].date, time: freshSlots[0].time, label: freshSlots[0].label }
        : null,
      timePreference:  retryPreference,
      timeWindowLabel: retryWindow.label,
    };
    const retryResponse = await runBot(assembleBookPrompt(freshContext), botMessages);
    if (retryResponse !== null) {
      if (retryResponse.includes("[STALL]")) {
        await addGhlTag(ghlContactId, "booking_stall");
      }
      await sendGhlSms(ghlContactId, stripAnySignals(retryResponse));
      await appendMessage(threadId, "assistant", retryResponse);
    }
    return;
  }

  const bookedMatch = rawResponse.match(
    /\[BOOKED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/,
  );

  if (bookedMatch) {
    const [, dateStr, time] = bookedMatch;
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    // Signal time is Mountain Time wall-clock; convert to UTC for DB storage.
    const _tz = process.env.BOT_TIMEZONE ?? "America/Denver";
    const _guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const _off = ((): number => {
      const pts = new Intl.DateTimeFormat("en-US", { timeZone: _tz, hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(_guess);
      const h = parseInt(pts.find((p) => p.type === "hour")?.value ?? "0", 10);
      const m = parseInt(pts.find((p) => p.type === "minute")?.value ?? "0", 10);
      return h * 60 + m - (hour * 60 + minute);
    })();
    const date = new Date(_guess.getTime() - _off * 60 * 1000);
    const validation = await validateSlotBeforeConfirm(
      lead.id,
      date,
      time,
      zone,
    );
    if (validation.ok) {
      await confirmBooking(lead.id, ghlContactId, date);
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_booking",
        "sr_appointment_set",
        "INSPECTION_SCHEDULED",
        "silent",
        {
          sr_status: "INSPECTION_SCHEDULED",
          sr_appointment_at: date.toISOString(),
          sr_bot_stage: "silent",
        },
      );
      if (lead.assignedUserId) {
        const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
        const zoneMeta = leadZone ? SERVICE_ZONES[leadZone] : null;
        const dayLabel = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: tz,
        }).format(date);
        const timeLabel = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        }).format(date);
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
        const repMsg = `New inspection booked!\nHomeowner: ${lead.customerName}\nDate/Time: ${dayLabel} at ${timeLabel.toLowerCase()}\nZone: ${zoneMeta?.label ?? zone}\nPhone: ${lead.phone ?? "not on file"}\n${appUrl}/leads/${lead.id}`;
        await notifyRep(lead.assignedUserId, lead.id, repMsg);
      }
      await sendGhlSms(ghlContactId, buildBookConfirmationSms(date));
    }
  } else {
    if (rawResponse.includes("[STALL]")) {
      await addGhlTag(ghlContactId, "booking_stall");
    }
    await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  }
  await appendMessage(threadId, "assistant", rawResponse);
}

// ── Nurture handler ───────────────────────────────────────────────────────────

function detectNurtureLastMessageContext(
  message: string,
): NurtureLastMessageContext {
  if (!message || message === "new_guide_lead") return "none";
  const t = message.toLowerCase();
  if (
    /not interested|leave me alone|stop texting|don't (want|need)|no thanks/.test(
      t,
    )
  )
    return "not_interested";
  if (
    /when (could|can) you (come|get) out|schedule|book|inspection|worried|concerned/.test(
      t,
    )
  )
    return "intent_signal";
  if (/leak|missing|crack|damage|hail|stain|sagging|rot/.test(t))
    return "problem_mentioned";
  if (/looks fine|no issues|don't think|not sure|just curious/.test(t))
    return "no_problem_aware";
  if (/not really|don't know|maybe|i guess/.test(t)) return "skeptical";
  if (message.trim().length < 10) return "stalling";
  return "curious_engaged";
}

async function getUsedInsightIds(threadId: string): Promise<string[]> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return [];
  const meta = thread.metadata as Record<string, unknown> | null;
  return Array.isArray(meta?.usedInsightIds)
    ? (meta.usedInsightIds as string[])
    : [];
}

async function addUsedInsightId(
  threadId: string,
  insightId: string,
): Promise<void> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return;
  const meta = (thread.metadata as Record<string, unknown>) ?? {};
  const existing = Array.isArray(meta.usedInsightIds)
    ? (meta.usedInsightIds as string[])
    : [];
  if (!existing.includes(insightId)) {
    await prisma.botThread.update({
      where: { id: threadId },
      data: { metadata: { ...meta, usedInsightIds: [...existing, insightId] } },
    });
  }
}

async function handleNurtureWebhook(ctx: CentralWebhookContext): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg, dripPosition, srLead } = ctx;

  const rawLead = lead as unknown as Record<string, unknown>;
  const issuesNoticed =
    ((rawLead.issuesNoticed as string | null) ?? null)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? null;
  const sourceRaw =
    (rawLead.guideSource as string) ?? (rawLead.source as string) ?? "organic";
  const srcMap: Record<string, NurtureContext["source"]> = {
    "facebook-guide": "facebook-guide",
    door: "door",
    card: "card",
    organic: "organic",
  };
  const source: NurtureContext["source"] = srcMap[sourceRaw] ?? "organic";

  const {
    id: threadId,
    messages,
    isNew,
  } = await getOrCreateThread(ghlContactId, "nurture");
  const usedInsightIds = await getUsedInsightIds(threadId);

  if (trigger === "nurture_drip" && dripPosition !== null) {
    const pos = dripPosition as 1 | 2 | 3 | 4;
    const thread = await prisma.botThread.findUnique({
      where: { id: threadId },
    });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const context: NurtureContext = {
      bot_type: "nurture",
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source,
      rep: (rawLead.rep as string | null) ?? null,
      message_history_count: currentMessages.length,
      last_message_context: "none",
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
    const botMessages = [
      ...currentMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: m.timestamp,
      })),
      {
        role: "user" as const,
        content: "[drip_trigger]",
        timestamp: new Date().toISOString(),
      },
    ];
    const rawResponse = await runBot(systemPrompt, botMessages);
    if (rawResponse === null) {
      await updateSrLead(lead.id, { sr_bot_stage: "silent" })
        .catch(err => console.error("[nurture/drip] updateSrLead silent failed", err));
      return;
    }

    const insightUsed =
      rawResponse.match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i)?.[1]?.toLowerCase() ??
      null;
    await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
    await appendMessage(threadId, "assistant", rawResponse);
    if (insightUsed) await addUsedInsightId(threadId, insightUsed);

    if (rawResponse.includes("[INSPECTION_INTENT]")) {
      // Use the tier already stored at lead creation — do not re-evaluate the ZIP.
      // Re-running getZipTier() risks returning 'out_of_area' for valid primary
      // leads if the ZIP lookup fails for any reason.
      const tier = srLead.srTier ?? lead.sourceTier ?? "out_of_area";
      await addGhlTag(ghlContactId, "zip_check_pending");
      if (tier === "primary") {
        await removeGhlTag(ghlContactId, "zip_check_pending");
        await addGhlTag(ghlContactId, "zip_approved");
        await addGhlTag(ghlContactId, "sr_qualifying");
      } else {
        await removeGhlTag(ghlContactId, "zip_check_pending");
        await addGhlTag(ghlContactId, "zip_review_pending");
        await sendGhlSms(
          ghlContactId,
          "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
        );
      }
    } else if (rawResponse.includes("[NOT_INTERESTED]")) {
      await transitionLead(
        lead.id,
        ghlContactId,
        "source_free_guide",
        "sr_dead",
        "DEAD",
        "silent",
        { sr_status: "DEAD", sr_bot_stage: "silent" },
      );
    } else if (rawResponse.includes("[SOFT_CLOSE]") || pos === 4) {
      await addGhlTag(ghlContactId, "sr_nurture_exhausted");
    }
    return;
  }

  if (inboundMsg && inboundMsg !== "new_guide_lead") {
    await appendMessage(threadId, "user", inboundMsg);
  }

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];

  const context: NurtureContext = {
    bot_type: "nurture",
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source,
    rep: (rawLead.rep as string | null) ?? null,
    message_history_count: currentMessages.length,
    last_message_context: detectNurtureLastMessageContext(inboundMsg),
    roof_type: (rawLead.roofType as string | null) ?? null,
    roof_age: lead.roofAge ?? null,
    issues_noticed: issuesNoticed,
    last_inspected: lead.lastInspected ?? null,
    address: lead.streetAddress ?? null,
    used_insight_ids: usedInsightIds,
    is_drip: false,
    drip_sequence_position: null,
  };

  if (isNew || messages.length === 0) {
    const systemPrompt = assembleNurturePrompt(context);
    const openerRaw = await runBot(systemPrompt, [
      {
        role: "user",
        content: "new_guide_lead",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (openerRaw !== null) {
      const insightUsed =
        openerRaw.match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i)?.[1]?.toLowerCase() ??
        null;
      await sendGhlSms(ghlContactId, stripAnySignals(openerRaw));
      await appendMessage(threadId, "assistant", openerRaw);
      if (insightUsed) await addUsedInsightId(threadId, insightUsed);
    }
    if (!inboundMsg || inboundMsg === "new_guide_lead") return;
  }

  const freshThread = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const freshMessages = (freshThread?.messages as BotMessage[]) ?? [];
  const freshContext: NurtureContext = {
    ...context,
    message_history_count: freshMessages.length,
    used_insight_ids: await getUsedInsightIds(threadId),
  };
  const systemPrompt = assembleNurturePrompt(freshContext);
  const botMessages = freshMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" })
      .catch(err => console.error("[nurture] updateSrLead silent failed", err));
    return;
  }

  const insightUsed =
    rawResponse.match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i)?.[1]?.toLowerCase() ??
    null;
  await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  await appendMessage(threadId, "assistant", rawResponse);
  if (insightUsed) await addUsedInsightId(threadId, insightUsed);

  if (rawResponse.includes("[INSPECTION_INTENT]")) {
    // Use the tier already stored at lead creation — do not re-evaluate the ZIP.
    // Re-running getZipTier() risks returning 'out_of_area' for valid primary
    // leads if the ZIP lookup fails for any reason.
    const tier = srLead.srTier ?? lead.sourceTier ?? "out_of_area";
    await addGhlTag(ghlContactId, "zip_check_pending");
    if (tier === "primary") {
      await removeGhlTag(ghlContactId, "zip_check_pending");
      await addGhlTag(ghlContactId, "zip_approved");
      await addGhlTag(ghlContactId, "sr_qualifying");
    } else {
      await removeGhlTag(ghlContactId, "zip_check_pending");
      await addGhlTag(ghlContactId, "zip_review_pending");
      await sendGhlSms(
        ghlContactId,
        "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
      );
    }
  } else if (rawResponse.includes("[NOT_INTERESTED]")) {
    await transitionLead(
      lead.id,
      ghlContactId,
      "source_free_guide",
      "sr_dead",
      "DEAD",
      "silent",
      { sr_status: "DEAD", sr_bot_stage: "silent" },
    );
  } else if (rawResponse.includes("[SOFT_CLOSE]")) {
    await addGhlTag(ghlContactId, "sr_soft_close");
  }
}

// ── Revival handler ───────────────────────────────────────────────────────────

function detectRevivalConversationTrack(
  messages: BotMessage[],
): ConversationTrack {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "warm";
  const userText = userMessages.map((m) => m.content.toLowerCase()).join(" ");
  const recentUser = userMessages.slice(-3);
  const avgLength =
    recentUser.reduce((sum, m) => sum + m.content.trim().length, 0) /
    recentUser.length;
  if (
    /not interested|leave me alone|stop|don't (want|need)|go away/.test(
      userText,
    )
  )
    return "resistant";
  if (userMessages.length >= 2 && avgLength < 15) return "resistant";
  if (/leak|damage|hail|stain|rot|crack|missing|sagging/.test(userText))
    return "problem_aware";
  return "warm";
}

function detectRevivalLastMessageContext(
  message: string,
): RevivalLastMessageContext {
  if (!message || message === "follow_up_triggered") return "none";
  const t = message.toLowerCase();
  if (/ridiculous|unacceptable|scam|waste/.test(t)) return "escalation_needed";
  if (/not interested|no thanks|stop|leave me alone/.test(t))
    return "not_interested";
  if (/already (fixed|done|replaced)|someone else did/.test(t))
    return "not_interested";
  if (/price|cost|afford|expensive|too much|budget/.test(t))
    return "objection_price";
  if (/not (the right )?time|too busy|not ready|wait|later/.test(t))
    return "objection_timing";
  if (/husband|wife|spouse|partner|need to (ask|check with)/.test(t))
    return "objection_spouse";
  if (/other (company|contractor|roofer)|someone else/.test(t))
    return "objection_competitor";
  if (/think|not sure|need to decide|get back/.test(t))
    return "objection_need_to_think";
  return "expressed_interest";
}

async function handleRevivalWebhook(ctx: CentralWebhookContext): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;

  const rawLead = lead as unknown as Record<string, unknown>;
  const lastInspection = await prisma.inspection.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  const inspectionFindings =
    lastInspection?.findingsNotes ??
    (lastInspection?.diagnosis
      ? JSON.stringify(lastInspection.diagnosis)
      : null);
  const daysSince = lastInspection?.createdAt
    ? Math.floor((Date.now() - lastInspection.createdAt.getTime()) / 86400000)
    : null;

  const dispoPrimaryObjection =
    (rawLead.dispoPrimaryObjection as string | null) ?? null;
  const dispoNotes = (rawLead.dispoNotes as string | null) ?? null;
  const dispoOutcome = (rawLead.dispoOutcome as string | null) ?? null;

  let lead_scenario: RevivalScenario = "no_report_no_show";
  if (inspectionFindings && dispoOutcome === "demo_not_sold")
    lead_scenario = "report_complete_not_sold";
  else if (inspectionFindings && dispoOutcome === "no_show")
    lead_scenario = "report_complete_no_show";

  const {
    id: threadId,
    messages,
    isNew,
  } = await getOrCreateThread(ghlContactId, "revival");
  const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? "") : "";
  const threadData = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const meta = (threadData?.metadata as Record<string, unknown>) ?? {};
  const referral_seed_planted = Boolean(meta.referralSeedPlanted);

  const buildContext = (
    msgs: BotMessage[],
    lastMsg: string,
  ): RevivalContext => ({
    bot_type: "revival",
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source_zip: lead.sourceZip ?? "",
    zone,
    message_history_count: msgs.length,
    last_message_context: detectRevivalLastMessageContext(lastMsg),
    conversation_track: detectRevivalConversationTrack(msgs),
    lead_scenario,
    inspection_completed: inspectionFindings !== null,
    inspection_findings: inspectionFindings,
    days_since_appointment: daysSince,
    outcome: dispoOutcome as RevivalContext["outcome"],
    decision_maker_present: lead.dispoDecisionMakerPresent ?? null,
    primary_objection: dispoPrimaryObjection,
    dispo_notes: dispoNotes,
    referral_seed_planted,
  });

  if (isNew || messages.length === 0) {
    const systemPrompt = assembleRevivalPrompt(
      buildContext([], "follow_up_triggered"),
    );
    const openerRaw = await runBot(systemPrompt, [
      {
        role: "user",
        content: "follow_up_triggered",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (openerRaw !== null) {
      await sendGhlSms(ghlContactId, stripAnySignals(openerRaw));
      await appendMessage(threadId, "assistant", openerRaw);
    }
    if (
      !inboundMsg ||
      inboundMsg === "follow_up_triggered" ||
      trigger !== "inbound_sms"
    )
      return;
  }

  if (inboundMsg && inboundMsg !== "follow_up_triggered") {
    await appendMessage(threadId, "user", inboundMsg);
  }

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];
  const systemPrompt = assembleRevivalPrompt(
    buildContext(currentMessages, inboundMsg),
  );
  const botMessages = currentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" })
      .catch(err => console.error("[revival] updateSrLead silent failed", err));
    return;
  }

  await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  await appendMessage(threadId, "assistant", rawResponse);

  if (
    rawResponse.toLowerCase().includes("if you know anyone") &&
    !referral_seed_planted
  ) {
    await prisma.botThread.update({
      where: { id: threadId },
      data: { metadata: { ...meta, referralSeedPlanted: true } },
    });
  }

  if (rawResponse.includes("[RE_QUALIFY]")) {
    await transitionLead(
      lead.id,
      ghlContactId,
      "sr_follow_up",
      "sr_recovered",
      "NEW",
      "booking",
      { sr_status: "NEW", sr_bot_stage: "booking" },
    );
    await addGhlTag(ghlContactId, "sr_booking");
  } else if (rawResponse.includes("[DEAD]")) {
    await transitionLead(
      lead.id,
      ghlContactId,
      "sr_follow_up",
      "sr_dead",
      "DEAD",
      "silent",
      { sr_status: "DEAD", sr_bot_stage: "silent" },
    );
  }
}

// ── Reschedule handler ────────────────────────────────────────────────────────

function detectRescheduleLastMessageContext(
  message: string,
): RescheduleLastMessageContext {
  if (!message) return "none";
  const t = message.toLowerCase().trim();
  if (/speak (to|with) (someone|manager)|call me|want a human/.test(t))
    return "escalation_needed";
  if (
    /not (going to|gonna|want to)|don't want|no thanks|not interested/.test(t)
  )
    return "wont_rebook";
  if (/check (with|my)|need to (ask|check)|not sure yet/.test(t))
    return "stall";
  if (
    /can('t| not)|won't work|not (available|good)|different (time|day)/.test(t)
  )
    return "slot_rejected";
  if (
    /^(yes|yeah|sure|ok|okay|confirmed|that works)\.?$/.test(t) ||
    /that work|confirmed|book it/.test(t)
  )
    return "confirmed";
  return "none";
}

async function handleRescheduleWebhook(
  ctx: CentralWebhookContext,
): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;

  const zone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? null) : null;
  const zoneStr = zone ?? "el_paso_central";
  const distanceZone = zone ? isDistanceZone(zone) : false;
  const rawSlots = await getAvailableSlots(zoneStr, distanceZone);

  if (rawSlots.length > 0) {
    const existingLock = await prisma.slotLock.findUnique({
      where: { leadId: lead.id },
    });
    if (!existingLock) {
      const [y, m, d] = rawSlots[0].date.split("-").map(Number);
      await createSlotLock({
        date: new Date(y, m - 1, d),
        time: rawSlots[0].time,
        zone: zoneStr,
        leadId: lead.id,
      });
    }
  }

  const {
    id: threadId,
    messages,
    isNew,
  } = await getOrCreateThread(ghlContactId, "reschedule");

  const rawLead = lead as unknown as Record<string, unknown>;
  const lastInspection = await prisma.inspection.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  const inspectionFindings =
    lastInspection?.findingsNotes ??
    (lastInspection?.diagnosis
      ? JSON.stringify(lastInspection.diagnosis)
      : null);
  const threadMeta =
    ((await prisma.botThread.findUnique({ where: { id: threadId } }))
      ?.metadata as Record<string, unknown>) ?? {};
  const has_pivoted = Boolean(threadMeta.hasPivotedToRevival);
  const from_booking_stall =
    String(rawLead.rescheduleReason ?? "").includes("booking_stall") ||
    Boolean(
      (rawLead.ghlTags as string[] | undefined)?.includes(
        "booking_stall_exhausted",
      ),
    );
  const rawReason = (rawLead.rescheduleReason as string) ?? "other";
  const validReasons: RescheduleReason[] = [
    "cancelled_by_homeowner",
    "one_legger",
    "time_constraint",
    "porched",
    "rep_schedule_conflict",
    "weather",
    "booking_stall_exhausted",
    "other",
  ];
  const reschedule_reason: RescheduleReason = validReasons.includes(
    rawReason as RescheduleReason,
  )
    ? (rawReason as RescheduleReason)
    : from_booking_stall
      ? "booking_stall_exhausted"
      : "other";

  const buildContext = (
    msgs: BotMessage[],
    lastMsg: string,
  ): RescheduleContext => ({
    bot_type: "reschedule",
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source_zip: lead.sourceZip ?? "",
    zone: zone ?? "",
    message_history_count: msgs.length,
    last_message_context: detectRescheduleLastMessageContext(lastMsg),
    available_slots: rawSlots.map((s) => ({
      date: s.date,
      time: s.time,
      label: s.label,
      zone_label: zoneStr,
    })),
    locked_slot: rawSlots[0]
      ? {
          date: rawSlots[0].date,
          time: rawSlots[0].time,
          label: rawSlots[0].label,
        }
      : null,
    reschedule_reason,
    inspection_completed: inspectionFindings !== null,
    inspection_findings: inspectionFindings,
    prior_outcome: (rawLead.dispoPrimaryObjection as string | null) ?? null,
    dispo_notes: (rawLead.dispoNotes as string | null) ?? null,
    from_booking_stall,
    has_pivoted_to_revival: has_pivoted,
  });

  if (isNew || messages.length === 0) {
    const systemPrompt = assembleReschedulePrompt(
      buildContext([], "reschedule_triggered"),
    );
    const openerRaw = await runBot(systemPrompt, [
      {
        role: "user",
        content: "reschedule_triggered",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (openerRaw !== null) {
      await sendGhlSms(ghlContactId, stripAnySignals(openerRaw));
      await appendMessage(threadId, "assistant", openerRaw);
    }
    if (
      !inboundMsg ||
      inboundMsg === "reschedule_triggered" ||
      trigger !== "inbound_sms"
    )
      return;
  }

  if (inboundMsg && inboundMsg !== "reschedule_triggered") {
    await appendMessage(threadId, "user", inboundMsg);
  }

  const reloadedThread = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
  const systemPrompt = assembleReschedulePrompt(
    buildContext(reloadedMessages, inboundMsg),
  );
  const botMessages = reloadedMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" })
      .catch(err => console.error("[reschedule] updateSrLead silent failed", err));
    return;
  }

  await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  await appendMessage(threadId, "assistant", rawResponse);

  const rescheduledMatch = rawResponse.match(
    /\[RESCHEDULED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/,
  );
  if (rescheduledMatch) {
    const [, dateStr, time] = rescheduledMatch;
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    // Signal time is Mountain Time wall-clock; convert to UTC for DB storage.
    const _tz2 = process.env.BOT_TIMEZONE ?? "America/Denver";
    const _guess2 = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const _off2 = ((): number => {
      const pts = new Intl.DateTimeFormat("en-US", { timeZone: _tz2, hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(_guess2);
      const h = parseInt(pts.find((p) => p.type === "hour")?.value ?? "0", 10);
      const m = parseInt(pts.find((p) => p.type === "minute")?.value ?? "0", 10);
      return h * 60 + m - (hour * 60 + minute);
    })();
    const date = new Date(_guess2.getTime() - _off2 * 60 * 1000);
    const validation = await validateSlotBeforeConfirm(
      lead.id,
      date,
      time,
      zoneStr,
    );
    if (validation.ok) {
      await confirmBooking(lead.id, ghlContactId, date);
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_reschedule",
        "sr_rescheduled",
        "INSPECTION_SCHEDULED",
        "silent",
        {
          sr_status: "INSPECTION_SCHEDULED",
          sr_appointment_at: date.toISOString(),
          sr_bot_stage: "silent",
        },
      );
      if (lead.assignedUserId) {
        await notifyRep(
          lead.assignedUserId,
          lead.id,
          `Reschedule confirmed for ${lead.customerName} — ${date.toLocaleDateString()}`,
        );
      }
    }
  } else if (
    rawResponse.includes("[RE_QUALIFY]") ||
    rawResponse.includes("[DEAD]")
  ) {
    if (!has_pivoted) {
      await prisma.botThread.update({
        where: { id: threadId },
        data: { metadata: { ...threadMeta, hasPivotedToRevival: true } },
      });
    }
    if (rawResponse.includes("[RE_QUALIFY]")) {
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_reschedule",
        null,
        "NEW",
        "booking",
        { sr_status: "NEW", sr_bot_stage: "booking" },
      );
      await addGhlTag(ghlContactId, "sr_booking");
    } else {
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_reschedule",
        "sr_dead",
        "DEAD",
        "silent",
        { sr_status: "DEAD", sr_bot_stage: "silent" },
      );
    }
  }
}

// ── Finance handler ───────────────────────────────────────────────────────────

function detectFinanceLastMessageContext(
  message: string,
): FinanceLastMessageContext {
  if (!message || message === "credit_fail_triggered") return "none";
  const t = message.toLowerCase();
  if (/speak (to|with) (someone|manager)|rate|term|apr|credit score/.test(t))
    return "escalation_needed";
  if (
    /can('t| not) (afford|do it)|there'?s no (way|path)|just (can'?t|won't)/.test(
      t,
    )
  )
    return "firmly_cant_proceed";
  if (/equity|home equity|heloc/.test(t)) return "exploring_heloc";
  if (/credit union|local bank|navy federal/.test(t))
    return "exploring_credit_union";
  if (/co.?sign|family (member|help)|someone (else )?sign/.test(t))
    return "exploring_cosigner";
  if (/phase|stage|part of it|most urgent/.test(t)) return "exploring_staged";
  if (/open to|willing to|what about|could (we|that)|maybe/.test(t))
    return "open_to_options";
  if (/found (a way|something)|we can|it'll work|figured/.test(t))
    return "option_identified";
  return "open_to_options";
}

function getOptionsSurfacedFromThread(messages: BotMessage[]): string[] {
  const options: string[] = [];
  const allText = messages.map((m) => m.content.toLowerCase()).join(" ");
  if (/equity|heloc/.test(allText)) options.push("heloc");
  if (/credit union/.test(allText)) options.push("credit_union");
  if (/co.?sign/.test(allText)) options.push("cosigner");
  if (/phase|stage/.test(allText)) options.push("staged_project");
  if (/family/.test(allText)) options.push("family");
  if (/cash.out|refinanc/.test(allText)) options.push("cash_out_refi");
  return options;
}

async function handleFinanceWebhook(ctx: CentralWebhookContext): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;

  const rawLead = lead as unknown as Record<string, unknown>;
  const lastInspection = await prisma.inspection.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  const inspectionFindings =
    lastInspection?.findingsNotes ??
    (lastInspection?.diagnosis
      ? JSON.stringify(lastInspection.diagnosis)
      : null);
  const daysSince = lastInspection?.createdAt
    ? Math.floor((Date.now() - lastInspection.createdAt.getTime()) / 86400000)
    : null;
  const lenderAttempted = rawLead.lenderAttempted ? "prior lender" : null;
  const dispoNotes = (rawLead.dispoNotes as string | null) ?? null;

  const {
    id: threadId,
    messages,
    isNew,
  } = await getOrCreateThread(ghlContactId, "finance");
  const buildContext = (
    msgs: BotMessage[],
    lastMsg: string,
  ): FinanceContext => ({
    bot_type: "finance",
    homeowner_name: lead.customerName,
    first_name: lead.customerName.trim().split(/\s+/)[0],
    source_zip: lead.sourceZip ?? "",
    zone: "",
    message_history_count: msgs.length,
    last_message_context: detectFinanceLastMessageContext(lastMsg),
    inspection_findings: inspectionFindings,
    days_since_appointment: daysSince,
    lender_attempted: lenderAttempted,
    dispo_notes: dispoNotes,
    options_surfaced: getOptionsSurfacedFromThread(msgs),
  });

  if (isNew || messages.length === 0) {
    const ctx2 = buildContext([], "credit_fail_triggered");
    const openerRaw = await runBot(assembleFinancePrompt(ctx2), [
      {
        role: "user",
        content: "credit_fail_triggered",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (openerRaw !== null) {
      await sendGhlSms(ghlContactId, stripAnySignals(openerRaw));
      await appendMessage(threadId, "assistant", openerRaw);
    }
    if (
      !inboundMsg ||
      inboundMsg === "credit_fail_triggered" ||
      trigger !== "inbound_sms"
    )
      return;
  }

  if (inboundMsg && inboundMsg !== "credit_fail_triggered") {
    await appendMessage(threadId, "user", inboundMsg);
  }

  const reloadedThread = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
  const financeCtx = buildContext(reloadedMessages, inboundMsg);
  const rawResponse = await runBot(
    assembleFinancePrompt(financeCtx),
    reloadedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    })),
  );
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" })
      .catch(err => console.error("[finance] updateSrLead silent failed", err));
    return;
  }

  await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  await appendMessage(threadId, "assistant", rawResponse);

  if (rawResponse.includes("[FINANCE_RETRY]")) {
    await addGhlTag(ghlContactId, "sr_finance_ready");
    if (lead.assignedUserId) {
      const optionFound = financeCtx.options_surfaced.slice(-1)[0] ?? "unknown";
      await notifyRep(
        lead.assignedUserId,
        lead.id,
        `Finance path identified — homeowner exploring ${optionFound}. Follow up to support.`,
      );
    }
    const { removeGhlTag: rgTag } = await import("@/src/lib/ghl-sms");
    await rgTag(ghlContactId, "sr_credit_fail");
  } else if (rawResponse.includes("[FINANCE_DEAD]")) {
    await transitionLead(
      lead.id,
      ghlContactId,
      "sr_credit_fail",
      "sr_dead",
      "DEAD",
      "silent",
      { sr_status: "DEAD", sr_bot_stage: "silent" },
    );
  }
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Validate secret
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);

  // 2. Parse — ALL fields from customData
  const data = rawBody?.customData ?? rawBody ?? {};
  const ghlContactId: string | null = data.contact_id ?? data.contactId ?? null;
  const trigger: string = data.trigger ?? "inbound_sms";
  const inboundMsg: string = data.message ?? "";
  const dripPosition: number | null = data.drip_position
    ? parseInt(data.drip_position)
    : null;

  if (!ghlContactId) {
    console.error(
      "[central] no contact_id in payload",
      JSON.stringify(rawBody).slice(0, 500),
    );
    return new Response("OK", { status: 200 });
  }

  // 3. Idempotency check
  // inbound_sms: key from contactId + message only — duplicate GHL fires produce the same key
  // All other triggers: include timestamp — proactive triggers can legitimately fire multiple times
  const idempotencyKey = trigger === "inbound_sms"
    ? createHash("sha256")
        .update(`${ghlContactId}:inbound:${inboundMsg}`)
        .digest("hex")
    : createHash("sha256")
        .update(`${ghlContactId}:${trigger}:${Date.now()}`)
        .digest("hex");

  if (await isDuplicate(idempotencyKey)) {
    return new Response("OK", { status: 200 });
  }

  // 4. Load Lead
  const lead = await loadLead(ghlContactId);
  console.log(lead);
  if (!lead) {
    console.warn("[central] no lead for contact", ghlContactId);
    await logWebhookHit({
      source: "ghl_central",
      payload: rawBody,
      success: false,
      error: "lead_not_found",
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  // 5. Load SrLead (self-heals from GHL if missing)
  const srLead = await getSrLeadFromDb(lead.id, ghlContactId);
  if (!srLead) {
    console.warn("[central] no SrLead for lead", lead.id);
    return new Response("OK", { status: 200 });
  }

  // 6. Check opted out
  if (srLead.srOptedOut || lead.botOptedOut) {
    return new Response("OK", { status: 200 });
  }

  // 7. Opt-out keyword on inbound SMS
  if (trigger === "inbound_sms" && isOptOut(inboundMsg)) {
    await addGhlTag(ghlContactId, "sr_opted_out").catch((e) =>
      console.error(e),
    );
    await transitionLead(
      lead.id,
      ghlContactId,
      null,
      "sr_dead",
      "DEAD",
      "silent",
      {
        sr_status: "DEAD",
        sr_bot_stage: "silent",
        sr_opted_out: true,
      },
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: { botOptedOut: true },
    });
    return new Response("OK", { status: 200 });
  }

  // 8. Route on srBotStage
  const context: CentralWebhookContext = {
    lead,
    srLead,
    ghlContactId,
    trigger,
    inboundMsg,
    dripPosition,
    idempotencyKey,
    rawBody,
  };

  try {
    // Named triggers — always return early, bypass srBotStage routing
    switch (trigger) {
      case "inbound_sms":
        // Route based on srBotStage as normal
        break;

      case "qualified_handoff":
        // GHL workflow fires this when opportunity moves to Booking stage.
        // srBotStage should already be 'booking' at this point.
        await handleBookWebhook({
          ...context,
          trigger:      "qualified_handoff",
          inboundMsg:   "",
          dripPosition: null,
        });
        return new Response("OK", { status: 200 });

      case "stall_followup":
        await handleBookWebhook({
          ...context,
          trigger:      "stall_followup",
          inboundMsg:   "",
          dripPosition: null,
        });
        return new Response("OK", { status: 200 });

      case "new_guide_lead":
        await handleNurtureWebhook(context);
        return new Response("OK", { status: 200 });

      case "new_inspection_lead":
      case "scheduling_approved":
        await handleQualifyWebhook(context);
        return new Response("OK", { status: 200 });

      case "follow_up_triggered":
        await handleRevivalWebhook(context);
        return new Response("OK", { status: 200 });

      case "reschedule_triggered":
        await handleRescheduleWebhook(context);
        return new Response("OK", { status: 200 });

      case "credit_fail_triggered":
        await handleFinanceWebhook(context);
        return new Response("OK", { status: 200 });

      case "nurture_drip":
        await handleNurtureWebhook(context);
        return new Response("OK", { status: 200 });

      case "stall_exhausted":
        await updateSrLead(lead.id, {
          sr_bot_stage: "revival",
          sr_status:    "DEMO_NOT_SOLD",
        });
        if (lead.ghlOpportunityId) {
          await moveGhlOpportunityStage(
            lead.ghlOpportunityId,
            process.env.GHL_STAGE_FOLLOW_UP_ACTIVE!,
          ).catch(err =>
            console.error("moveStage stall_exhausted failed", err)
          );
        }
        await Promise.allSettled([
          addGhlTag(ghlContactId, "sr_follow_up"),
          removeGhlTag(ghlContactId, "booking_stall"),
        ]);
        return new Response("OK", { status: 200 });

      case "finance_retry":
        await handleFinanceWebhook(context);
        return new Response("OK", { status: 200 });

      default:
        // Unknown trigger — fall through to srBotStage routing
        break;
    }

    // inbound_sms and unknown triggers: route on srBotStage
    switch (srLead.srBotStage) {
      case "nurture":
        await handleNurtureWebhook(context);
        break;
      case "qualifying":
        await handleQualifyWebhook(context);
        break;
      case "booking":
        await handleBookWebhook(context);
        break;
      case "revival":
        await handleRevivalWebhook(context);
        break;
      case "reschedule":
        await handleRescheduleWebhook(context);
        break;
      case "finance":
        await handleFinanceWebhook(context);
        break;
      case "silent":
        break;
      default:
        console.warn("[central] unknown srBotStage", srLead.srBotStage);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logWebhookHit({
      source: "ghl_central",
      payload: rawBody,
      success: false,
      error: message,
      leadId: lead.id,
      idempotencyKey,
    });
    // Always 200 — never let GHL retry
    return new Response("OK", { status: 200 });
  }

  await logWebhookHit({
    source: "ghl_central",
    payload: rawBody,
    success: true,
    leadId: lead.id,
    idempotencyKey,
  });
  return new Response("OK", { status: 200 });
}
