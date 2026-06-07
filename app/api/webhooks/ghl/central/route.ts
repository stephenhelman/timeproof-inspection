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
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  notifyRep,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getSrLeadFromDb, updateSrLead } from "@/src/lib/ghl-custom-object";
import { moveGhlOpportunityStage, createGhlOpportunity } from "@/src/lib/ghl-contacts";
import { createAppointmentWithInspection } from "@/src/lib/appointment-service";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";
import { assembleRevivalPrompt } from "@/src/lib/prompts/qntum/assemblers/revival";
import { assembleReschedulePrompt } from "@/src/lib/prompts/qntum/assemblers/reschedule";
import { assembleFinancePrompt } from "@/src/lib/prompts/qntum/assemblers/finance";
import type {
  ConversationTrack,
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
import { handleNurtureWebhook } from "@/src/lib/bot-handlers/nurture";
import { handleQualifyWebhook } from "@/src/lib/bot-handlers/qualify";
import { handleBookWebhook } from "@/src/lib/bot-handlers/book";

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

// ─── JORDAN REVIVAL HANDLER (string mode — legacy) ───────────────────────────
// Migration path: src/lib/bot-handlers/revival.ts (scaffold ready)
// To migrate:
//   1. Implement assembleRevivalPromptV2 in assemblers/revival-v2.ts
//   2. Implement handleRevivalWebhook in bot-handlers/revival.ts
//   3. Export handler and import here
//   4. Replace this function body with: return handleRevivalWebhook(ctx)
//   5. Add 'revival' case to inbound SMS switch
// ─────────────────────────────────────────────────────────────────────────────
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
  const aiDiagnosisStructured =
    (lastInspection?.aiDiagnosisStructured as Record<string, unknown> | null) ??
    null;
  const intakePass2Data = lastInspection?.intakePass2 as
    | { postDiagnosisAdmission?: string }
    | null
    | undefined;
  const postDiagnosisAdmission = intakePass2Data?.postDiagnosisAdmission ?? null;
  const warningSignResponses =
    (lastInspection?.warningSignResponses as Record<string, unknown> | null) ??
    null;

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
    ai_diagnosis_structured: aiDiagnosisStructured,
    post_diagnosis_admission: postDiagnosisAdmission,
    warning_sign_responses: warningSignResponses,
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
    await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
      console.error("[revival] updateSrLead silent failed", err),
    );
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
    // Move revival opp to Re-Qualified stage
    if (lead.ghlOpportunityId && process.env.GHL_STAGE_RE_QUALIFIED) {
      await moveGhlOpportunityStage(
        lead.ghlOpportunityId,
        process.env.GHL_STAGE_RE_QUALIFIED,
      ).catch((err) =>
        console.error("[revival] revival opp stage move failed:", err),
      );
    }
    // Create new Inspection pipeline opp at Appointment Set
    if (
      ghlContactId &&
      process.env.GHL_PIPELINE_INSPECTION &&
      process.env.GHL_STAGE_APPOINTMENT_SET
    ) {
      await createGhlOpportunity({
        ghlContactId,
        contactName: lead.customerName,
        pipelineId: process.env.GHL_PIPELINE_INSPECTION,
        pipelineStageId: process.env.GHL_STAGE_APPOINTMENT_SET,
        sourceName: "revival-re-qualified",
      }).catch((err) =>
        console.error("[revival] new inspection opp creation failed:", err),
      );
    }
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

// ─── JORDAN RESCHEDULE HANDLER (string mode — legacy) ────────────────────────
// Migration path: src/lib/bot-handlers/reschedule.ts (scaffold ready)
// To migrate:
//   1. Implement assembleReschedulePromptV2 in assemblers/reschedule-v2.ts
//   2. Implement handleRescheduleWebhook in bot-handlers/reschedule.ts
//   3. Export handler and import here
//   4. Replace this function body with: return handleRescheduleWebhook(ctx)
//   5. Parse response.rescheduled_slot instead of regex-matching [RESCHEDULED: ...]
// ─────────────────────────────────────────────────────────────────────────────
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
    await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
      console.error("[reschedule] updateSrLead silent failed", err),
    );
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
      const pts = new Intl.DateTimeFormat("en-US", {
        timeZone: _tz2,
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(_guess2);
      const h = parseInt(pts.find((p) => p.type === "hour")?.value ?? "0", 10);
      const m = parseInt(
        pts.find((p) => p.type === "minute")?.value ?? "0",
        10,
      );
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
      const assignedUserId =
        lead.assignedUserId ?? process.env.GHL_DEFAULT_ASSIGNEE_ID ?? null;
      if (assignedUserId) {
        await createAppointmentWithInspection({
          leadId: lead.id,
          assignedUserId,
          scheduledAt: date,
          zone: zoneStr,
          createdBy: "JORDAN",
        });
      }
      await prisma.slotLock
        .deleteMany({ where: { leadId: lead.id } })
        .catch((err) =>
          console.error("[reschedule] SlotLock cleanup failed:", err),
        );
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

// ─── JORDAN FINANCE HANDLER (string mode — legacy) ───────────────────────────
// Migration path: src/lib/bot-handlers/finance.ts (scaffold ready)
// To migrate:
//   1. Implement assembleFinancePromptV2 in assemblers/finance-v2.ts
//   2. Implement handleFinanceWebhook in bot-handlers/finance.ts
//   3. Export handler and import here
//   4. Replace this function body with: return handleFinanceWebhook(ctx)
// ─────────────────────────────────────────────────────────────────────────────
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
  const financeAiDiagnosis =
    (lastInspection?.aiDiagnosisStructured as Record<string, unknown> | null) ??
    null;
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
    ai_diagnosis_structured: financeAiDiagnosis,
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
    await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
      console.error("[finance] updateSrLead silent failed", err),
    );
    return;
  }

  await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  await appendMessage(threadId, "assistant", rawResponse);

  if (rawResponse.includes("[FINANCE_RETRY]")) {
    await addGhlTag(ghlContactId, "sr_finance_ready");
    await removeGhlTag(ghlContactId, "sr_credit_fail");
    const optionFound = financeCtx.options_surfaced.slice(-1)[0] ?? "unknown";
    // Find a manager to own the Finance Review task
    const financeManager = await prisma.user.findFirst({
      where: {
        role: { in: ["SALES_MANAGER", "REGIONAL", "ADMIN"] },
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (financeManager) {
      await prisma.task.create({
        data: {
          leadId: lead.id,
          type: "FINANCE_REVIEW",
          assignedUserId: financeManager.id,
          context: `Finance path identified via Jordan bot — homeowner exploring ${optionFound}. Review conversation and support the close.`,
          availableOutcomes: [
            "path_identified",
            "no_path",
            "credit_repair_referred",
          ],
          createdBy: "BOT",
        },
      });
    }
    if (lead.assignedUserId) {
      await notifyRep(
        lead.assignedUserId,
        lead.id,
        `Finance path identified — homeowner exploring ${optionFound}. Follow up to support.`,
      );
    }
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
    if (lead.ghlOpportunityId && process.env.GHL_STAGE_EXHAUSTED) {
      await moveGhlOpportunityStage(
        lead.ghlOpportunityId,
        process.env.GHL_STAGE_EXHAUSTED,
      ).catch((err) =>
        console.error("[finance] exhausted opp stage move failed:", err),
      );
    }
    const followupAssigneeId =
      lead.assignedUserId ??
      (
        await prisma.user.findFirst({
          where: {
            role: { in: ["SALES_MANAGER", "REGIONAL", "ADMIN"] },
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
        })
      )?.id ??
      null;
    if (followupAssigneeId) {
      await prisma.task.create({
        data: {
          leadId: lead.id,
          type: "REP_FOLLOWUP",
          assignedUserId: followupAssigneeId,
          context: `Finance discovery ended — no viable path found. Homeowner marked dead after Jordan bot conversation. Manual follow-up may surface future opportunity.`,
          availableOutcomes: [
            "contacted",
            "appointment_set",
            "not_interested",
            "needs_escalation",
          ],
          createdBy: "BOT",
        },
      });
    }
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
  const idempotencyKey =
    trigger === "inbound_sms"
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
    // Alex bots (nurture/qualify/book) have dedicated routes; only revival/reschedule/finance remain here.
    switch (trigger) {
      case "inbound_sms":
        // Route based on srBotStage as normal
        break;

      case "follow_up_triggered":
        await handleRevivalWebhook(context);
        return new Response("OK", { status: 200 });

      case "reschedule_triggered":
        await handleRescheduleWebhook(context);
        return new Response("OK", { status: 200 });

      case "credit_fail_triggered":
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
        await handleNurtureWebhook({
          lead: context.lead,
          srLead: context.srLead,
          ghlContactId: context.ghlContactId,
          trigger: context.trigger,
          inboundMsg: context.inboundMsg,
          dripPosition: context.dripPosition,
        });
        break;
      case "qualifying":
        await handleQualifyWebhook({
          lead: context.lead,
          srLead: context.srLead,
          ghlContactId: context.ghlContactId,
          trigger: context.trigger,
          inboundMsg: context.inboundMsg,
        });
        break;
      case "booking":
        await handleBookWebhook({
          lead: context.lead,
          srLead: context.srLead,
          ghlContactId: context.ghlContactId,
          trigger: context.trigger,
          inboundMsg: context.inboundMsg,
        });
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
