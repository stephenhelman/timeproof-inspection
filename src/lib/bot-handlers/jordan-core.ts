// ── JORDAN CORE — the shared recovery engine loop (Sprint 5) ─────────────────
//
// All three Jordan recovery missions (revival, finance, reschedule) run the SAME
// composed-prompt JSON engine on the SAME contract and repair ladder as Alex
// (ARCHITECTURE §4/§5). This module is the single live-loop they share — the
// structural prize of Sprint 5: after the route collapse there is exactly ONE
// Jordan implementation, not the old inline-central + dedicated-route duplicates
// with string-mode regex parsing.
//
// Each per-mission handler (revival.ts / finance.ts / reschedule.ts) is thin: it
// derives the mission's SYSTEM-authored recovery context (affordabilityIsReal,
// rescheduleSubCase, consequenceLikelySurfaced, daysSinceAppointment, repName),
// writes it through the airtight authorship seam, then calls runJordanTurn here.
//
// REUSED (not rewritten — sprint_5 Do-NOT-touch): the slot + booking machinery
// from bot-engine / appointment-service — getAvailableSlots, createSlotLock,
// validateSlotBeforeConfirm, createAppointmentWithInspection, transitionLead,
// notifyRep. REBOOKED hands the model-authored selectedSlot to that existing
// confirm path; this module only DECIDES what to say.

import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  transitionLead,
  purgeExpiredSlotLocks,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  notifyRep,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import { moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";
import { createAppointmentWithInspection } from "@/src/lib/appointment-service";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";
import {
  writeSystemFields,
  applyModelStateDelta,
  conversationToStateInput,
  type SystemAuthoredFields,
} from "@/src/lib/conversation";
import { runComposedBotTurn } from "@/src/lib/bot-v2/engine";
import type { ContractSummary, Phase, TurnInput } from "@/src/lib/bot-v2/types";
import type { Conversation, Lead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

// A concrete, confirmable slot string: "YYYY-MM-DD HH:MM" (MT wall-clock).
const REBOOKED_SLOT_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;

// Outward GHL side-effects + the REBOOKED confirm seam, all injectable (mirrors
// the Alex handlers). Production callers omit `deps`; the live-route harness
// injects no-ops + a stub confirm so it can drive the whole engine loop against
// the real DB WITHOUT sending SMS or performing the real GHL/DB rebooking.
export interface JordanIoDeps {
  sendSms?: (ghlContactId: string, message: string) => Promise<void>;
  addTag?: (ghlContactId: string, tag: string) => Promise<void>;
  removeTag?: (ghlContactId: string, tag: string) => Promise<void>;
  confirmRebooked?: (args: {
    slot: string;
    confidence: "solid" | "soft" | null;
    summary: string | null;
    lead: Lead;
    ghlContactId: string;
    zone: string;
    fromStage: string | null;
  }) => Promise<void>;
}

// Per-mission configuration the thin handlers pass in. Everything mission-specific
// is here; the loop itself is identical across the three Jordan missions.
export interface JordanTurnConfig {
  phase: Phase; // revival | reschedule | finance
  // The sr_* stage Jordan transitions FROM on a terminal signal (REBOOKED → set,
  // NOT_INTERESTED → dead). Matches the legacy per-mission `from` arg.
  fromStage: string | null;
  // The system turn message used on an ACTIVATION trigger (no real inbound) so the
  // model produces its acknowledgment-first opener.
  openerInstruction: string;
}

export interface JordanTurnCtx {
  lead: Lead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
  // The current Conversation row AFTER the handler wrote recovery context — used
  // as the read-only state the engine sees this turn.
  convo: Conversation;
}

/**
 * The shared Jordan recovery turn. Identical loop for revival/finance/reschedule:
 * classify the turn → pre-fetch slots → engine → persist (model + system seam) →
 * act on the signal → send SMS. Returns the emitted signal type for the caller's
 * logging/telemetry.
 */
export async function runJordanTurn(
  ctx: JordanTurnCtx,
  config: JordanTurnConfig,
  deps: JordanIoDeps = {},
): Promise<string | null> {
  const { lead, ghlContactId, trigger, inboundMsg, convo } = ctx;
  const sendSms = deps.sendSms ?? sendGhlSms;
  const addTag = deps.addTag ?? addGhlTag;
  const removeTag = deps.removeTag ?? removeGhlTag;
  const confirmRebooked = deps.confirmRebooked ?? confirmRebooking;
  void removeTag; // reserved for parity with the Alex handlers

  // ── Zone (reused machinery; matches the Alex/book derivation) ───────────────
  const leadZone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? null) : null;
  const distanceZone = leadZone ? isDistanceZone(leadZone) : false;
  const zone = leadZone ?? "el_paso_central";

  // ── Classify the turn ───────────────────────────────────────────────────────
  // Only a genuine homeowner SMS is a "real inbound" (resets the heat cooldown
  // clock). The activation triggers (follow_up_triggered / reschedule_triggered /
  // credit_fail_triggered / finance_retry) are SYSTEM-initiated openers.
  const isRealInbound = trigger === "inbound_sms" && !!inboundMsg;
  const turnMessage = isRealInbound ? inboundMsg : config.openerInstruction;

  // ── Slot pre-fetch-and-inject (REBOOKED needs real, current times) ──────────
  // Jordan's whole job is getting the lead back on the books, so unlike Book we
  // pre-fetch on every turn (no address gate — the appointment address is already
  // on file). The model offers ONLY these and echoes the chosen one into
  // state.selectedSlot (the contract-clean carrier — ARCHITECTURE §5).
  await purgeExpiredSlotLocks();
  const slots = await getAvailableSlots(zone, distanceZone);
  if (slots.length > 0) {
    const existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });
    if (!existingLock) {
      const [y, m, d] = slots[0].date.split("-").map(Number);
      await createSlotLock({
        date: new Date(y, m - 1, d),
        time: slots[0].time,
        zone,
        leadId: lead.id,
        label: slots[0].label || slots[0].time,
      });
    }
  }
  const availableSlots = slots.map((s) => ({ date: s.date, time: s.time, label: s.label }));

  // ── Build the turn input ────────────────────────────────────────────────────
  const { id: threadId, messages: priorMessages } = await getOrCreateThread(
    ghlContactId,
    config.phase as Exclude<Phase, "silent">,
  );
  const history = (priorMessages as BotMessage[]).map((m) => ({
    role: (m.role === "assistant" ? "bot" : "lead") as "bot" | "lead",
    content: m.content,
    timestamp: m.timestamp,
  }));

  // Seed the KNOWN appointment address for recovery. Unlike Alex's book flow
  // (where the model collects the address fresh), a Jordan lead already had an
  // appointment, so the address is on the Lead record. Conversation.address is
  // model-authored and starts null here, so without this Jordan would re-ask for
  // an address it already has ("what's the address?") — wrong for a returning
  // homeowner. Backfill it as prior conversation state so Jordan treats it as known.
  const stateInput = conversationToStateInput(convo);
  if (!stateInput.address && lead.address) stateInput.address = lead.address;

  const input: TurnInput = {
    ghlContactId,
    inboundMessage: turnMessage,
    conversationState: stateInput,
    conversationHistory: history,
    phase: config.phase,
    availableSlots,
  };

  // ── Run the engine (tier → Sonnet for all three Jordan missions) ────────────
  const result = await runComposedBotTurn(input);
  const sig = result.signal.type;

  // ── Persist model-authored state via the airtight seam ──────────────────────
  await applyModelStateDelta(ghlContactId, result.stateDelta, { currentPhase: config.phase });

  // ── Persist system-authored fields (meta + heat clock) ──────────────────────
  const sysFields: Partial<SystemAuthoredFields> = {
    lastSignal: sig ?? null,
    lastModelTier: result.modelTier,
  };
  if (isRealInbound) sysFields.heatLastInbound = new Date();
  await writeSystemFields(ghlContactId, sysFields, { currentPhase: config.phase });

  // ── Transcript: append the real inbound (activation turns have no real inbound) ─
  if (isRealInbound) await appendMessage(threadId, "user", inboundMsg);

  // ── Reply vs handoff ────────────────────────────────────────────────────────
  // Jordan sends his reply for every signal EXCEPT a firm NOT_INTERESTED (respect
  // the no). REBOOKED's reply is the homeowner-facing confirmation; SOFT_CLOSE /
  // ESCALATE want Jordan's closing message to land before we park/hand off.
  const sendReply = sig !== "NOT_INTERESTED";
  if (sendReply && result.reply) {
    await sendSms(ghlContactId, result.reply);
    await appendMessage(threadId, "assistant", result.reply);
  }

  // ── Act on the signal ───────────────────────────────────────────────────────
  switch (sig) {
    case "REBOOKED": {
      // A previously-existing appointment recovered. Hand the model-authored
      // selectedSlot to the existing confirm path (validateSlotBeforeConfirm,
      // createAppointmentWithInspection, transitionLead → INSPECTION_SCHEDULED,
      // notifyRep). Nothing here is rebuilt.
      const selectedSlot = (result.stateDelta as { selectedSlot?: string | null }).selectedSlot ?? null;
      const slot = resolveRebookedSlot(selectedSlot, availableSlots);
      if (!slot) {
        console.error(`[jordan/${config.phase}] REBOOKED but no resolvable slot (selectedSlot=${JSON.stringify(selectedSlot)}) — cannot confirm`);
        break;
      }
      await confirmRebooked({
        slot,
        confidence: result.signal.confidence,
        summary: summaryToText(result.stateDelta, convo.summary),
        lead,
        ghlContactId,
        zone,
        fromStage: config.fromStage,
      });
      break;
    }
    case "SOFT_CLOSE":
      if (config.phase === "finance") {
        // Lead is pursuing an alternative payment path → finance_retry follow-up.
        await addTag(ghlContactId, "sr_finance_ready").catch((e) => console.error(e));
        await removeGhlTag(ghlContactId, "sr_credit_fail").catch(() => null);
        if (lead.assignedUserId) {
          await notifyRep(
            lead.assignedUserId,
            lead.id,
            `Finance path identified — ${lead.customerName} pursuing an alternative payment path. Follow up to support. (${result.signal.reason ?? "path noted"})`,
          ).catch((e) => console.error(e));
        }
      } else {
        await addTag(ghlContactId, "sr_soft_close").catch((e) => console.error(e));
      }
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      break;
    case "NOT_INTERESTED":
      await transitionLead(lead.id, ghlContactId, config.fromStage, "sr_dead", "DEAD", "silent", {
        sr_status: "DEAD", sr_bot_stage: "silent",
      }, "NOT_INTERESTED");
      if (lead.ghlOpportunityId && process.env.GHL_STAGE_DEAD) {
        await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_DEAD).catch((e) => console.error(e));
      }
      break;
    case "ESCALATE":
      // Requires a human. Park the bot, notify a manager with the full context.
      // This replaces the old string-mode [ESCALATE] detection.
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      await addTag(ghlContactId, "sr_escalation").catch(() => null);
      await notifyManager(
        `Jordan ${config.phase} ESCALATION — ${lead.customerName} needs a human. ${result.signal.reason ?? ""}`.trim(),
      ).catch((e) => console.error(e));
      break;
    default:
      // null / continue — keep the conversation going (reply already sent).
      break;
  }

  return sig ?? null;
}

// Resolve the concrete "YYYY-MM-DD HH:MM" slot for a REBOOKED turn. Primary source
// is the model-authored state.selectedSlot (the canonical home — ARCHITECTURE §5;
// signal.reason is prose-only). Falls back to the first offered slot so a missing/
// malformed selectedSlot never blocks a rebooking we have a valid slot for.
function resolveRebookedSlot(
  selectedSlot: string | null,
  offered: { date: string; time: string }[],
): string | null {
  if (selectedSlot) {
    const m = selectedSlot.match(REBOOKED_SLOT_RE);
    if (m) return m[0];
  }
  if (offered.length > 0) return `${offered[0].date} ${offered[0].time}`;
  return null;
}

// Flatten the structured handoff summary into a one-line string for the rep note.
function summaryToText(stateDelta: Record<string, unknown>, stored: unknown): string | null {
  const s = ((stateDelta.summary as ContractSummary | undefined) ?? (stored as ContractSummary | null)) || null;
  if (!s) return null;
  return [s.situation, s.problem, s.consequence, s.openObjection, s.nextStep]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" · ") || null;
}

// ── confirmRebooking — the EXISTING recovery confirm machinery (reused) ───────
//
// Mirrors the legacy reschedule-route confirm path verbatim in behavior: parse the
// MT wall-clock slot → UTC, validateSlotBeforeConfirm, createAppointmentWithInspection
// (createdBy JORDAN), clean the SlotLock, transitionLead → INSPECTION_SCHEDULED,
// notifyRep. A `soft` REBOOKED still confirms (it is a real slot) but is tagged for
// the confirmation/reminder step rather than treated as solid rep time (ARCHITECTURE §6).
async function confirmRebooking(args: {
  slot: string;
  confidence: "solid" | "soft" | null;
  summary: string | null;
  lead: Lead;
  ghlContactId: string;
  zone: string;
  fromStage: string | null;
}): Promise<void> {
  const { slot, confidence, summary, lead, ghlContactId, zone, fromStage } = args;

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(slot)) {
    console.error(`[jordan] REBOOKED slot has invalid format: "${slot}"`);
    return;
  }

  const [datePart, timePart] = slot.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Convert MT wall-clock → UTC (same conversion as the book/reschedule machinery).
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const off = ((): number => {
    const pts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(guess);
    const h = parseInt(pts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(pts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return h * 60 + m - (hour * 60 + minute);
  })();
  const appointmentDate = new Date(guess.getTime() - off * 60 * 1000);

  const validation = await validateSlotBeforeConfirm(lead.id, appointmentDate, timePart, zone);
  if (!validation.ok) {
    console.warn("[jordan] slot conflict on rebooking confirm:", validation.reason);
    return;
  }

  const assignedUserId = lead.assignedUserId ?? process.env.GHL_DEFAULT_ASSIGNEE_ID ?? null;
  if (assignedUserId) {
    try {
      await createAppointmentWithInspection({
        leadId: lead.id,
        assignedUserId,
        scheduledAt: appointmentDate,
        zone,
        createdBy: "JORDAN",
      });
    } catch (err) {
      console.error("[jordan] createAppointmentWithInspection failed:", err);
      return;
    }
  } else {
    console.error("[jordan] REBOOKED but no assignedUserId — cannot create appointment");
  }

  await prisma.slotLock.deleteMany({ where: { leadId: lead.id } }).catch((err) =>
    console.error("[jordan] SlotLock cleanup failed:", err),
  );

  await transitionLead(lead.id, ghlContactId, fromStage, "sr_rescheduled", "INSPECTION_SCHEDULED", "silent", {
    sr_status: "INSPECTION_SCHEDULED", sr_appointment_at: appointmentDate.toISOString(), sr_bot_stage: "silent",
  }, "REBOOKED");

  // Soft rebook (serial rescheduler / agreed-without-engagement / objection
  // surfaced-not-resolved) → flag for the confirmation/reminder step.
  await addGhlTag(ghlContactId, confidence === "soft" ? "sr_rebook_soft" : "sr_rebooked").catch(() => null);

  if (lead.assignedUserId) {
    await notifyRep(
      lead.assignedUserId,
      lead.id,
      `Reschedule confirmed for ${lead.customerName} — ${appointmentDate.toLocaleDateString()} (${confidence ?? "solid"})${summary ? `\nSummary: ${summary}` : ""}`,
    ).catch((err) => console.error("[jordan] notifyRep failed:", err));
  }
}
