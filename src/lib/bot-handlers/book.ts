// ── BOOK HANDLER — LIVE ON THE NEW ENGINE (Sprint 4 cutover) ─────────────────
//
// The third live route cutover (sprint_4 Step 5). The old book reply-generation
// (assembleBookPrompt + runBot + the multi-pass address/preference re-run +
// BotThread.metadata.bot_context) is GONE — git is the revert path. Reply
// generation now runs through the shared composed-prompt engine
// (`runComposedBotTurn`, ARCHITECTURE §4/§5) on the book mission (Haiku —
// logistics for an already-qualified lead), and cross-phase state lives in the
// `Conversation` record, written through the airtight authorship seam.
//
// REUSED VERBATIM (do NOT rewrite — sprint_4 Step 3 / Do-NOT-touch): the
// timezone-sensitive slot + booking machinery — getAvailableSlots, createSlotLock,
// validateSlotBeforeConfirm, confirmBooking, the MT→UTC conversion in
// handleBooked, transitionLead to INSPECTION_SCHEDULED, notifyRep — plus the two
// named-trigger handlers (stall_exhausted, appointment_confirmed). The new engine
// only DECIDES what to say and emits BOOKED + the chosen slot; the existing,
// battle-tested code does the timezone math and the actual GHL booking.
//
// SLOT SEAM (sprint_4 Step 3, sprint_5 Step 0): slots are wired by PRE-FETCH-AND-
// INJECT, not native tool-use. The CODE calls getAvailableSlots on book turns
// (when an address is known), injects the result into the runtime context as
// available_slots (TurnInput.availableSlots → assembler), and the model offers
// ONLY those. On BOOKED the model echoes the chosen slot into state.selectedSlot
// (the canonical home — ARCHITECTURE §5; signal.reason is prose-only).

import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  transitionLead,
  isCancellation,
  purgeExpiredSlotLocks,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  confirmBooking,
  notifyRep,
  formatAppointmentDatetime,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  moveGhlOpportunityStage,
  updateGhlContact,
  resolveGhlOpportunity,
  createGhlOpportunity,
  writeGhlContactCustomField,
} from "@/src/lib/ghl-contacts";
import { createAppointmentWithInspection, deriveZoneForLead } from "@/src/lib/appointment-service";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";
import { detectTimePreference } from "@/src/lib/time-utils";
import {
  writeSystemFields,
  applyModelStateDelta,
  conversationToStateInput,
  getConversation,
  type SystemAuthoredFields,
} from "@/src/lib/conversation";
import { runComposedBotTurn } from "@/src/lib/bot-v2/engine";
import { purgePipelineTags } from "@/src/lib/bot-v2/pipeline-tags";
import {
  BOOKING_PENDING_TAG,
  bookingPendingStage,
  bookingPendingExhausted,
  planBookingExhaustion,
} from "@/src/lib/bot-v2/booking-pending";
import type { ContractSummary, Phase, TurnInput } from "@/src/lib/bot-v2/types";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

const PHASE: Phase = "book";

// A concrete, confirmable slot string: "YYYY-MM-DD HH:MM" (MT wall-clock).
const BOOKED_SLOT_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;

// Outward GHL side-effects + the booking-confirm seam, all injectable for
// testability (mirrors the nurture/qualify handlers). Production callers omit
// `deps`; the live-route harness injects no-ops + a stub confirm so it can drive
// the full engine loop against the real DB WITHOUT sending SMS or performing the
// real GHL/DB booking confirm.
export interface BookIoDeps {
  sendSms?: (ghlContactId: string, message: string) => Promise<void>;
  addTag?: (ghlContactId: string, tag: string) => Promise<void>;
  removeTag?: (ghlContactId: string, tag: string) => Promise<void>;
  // The BOOKED confirm path. Defaults to the real handleBooked (existing
  // timezone/slot/booking machinery). The harness stubs this to assert the
  // BOOKED handoff fired without performing the real confirm.
  confirmBooked?: (args: {
    slot: string;
    address: string | null;
    summary: string | null;
    lead: Lead;
    ghlContactId: string;
    zone: string;
    distanceZone: boolean;
  }) => Promise<void>;
}

// ── Named-trigger booking machinery — UNCHANGED (reused, not rewritten) ──────

// Inspection Booking Pending EXHAUSTED (Sprint 9 Part D) — the lifecycle-aware
// crossing. Alex first-booked, the lead qualified but never picked a first time.
// One failure, real recovery value: mark the Inspection opp LOST → purge Inspection
// tags (§12 Pattern B) → create a Revival opp at Follow-Up Active with
// sr_dispo_context=booking_stall (Jordan's opener excavates "you qualified but
// something's holding you back from a time — what is it really?"). NOT hard-dead.
//
// Shared by the server-driven attempts exhaustion (stall_followup) and any legacy
// GHL stall_exhausted fire. Mirrors the dispo Inspection→Revival crossing.
async function crossInspectionBookingToRevival(lead: Lead, ghlContactId: string): Promise<void> {
  const plan = planBookingExhaustion("inspection");

  // resolve → purge → create (the atomic crossing order).
  if (lead.ghlOpportunityId && process.env.GHL_STAGE_BOOKING_PENDING_INSPECTION) {
    await resolveGhlOpportunity(
      lead.ghlOpportunityId,
      process.env.GHL_STAGE_BOOKING_PENDING_INSPECTION,
      "lost",
    ).catch((e) => console.error("[book/exhaust] resolve Inspection opp (lost) failed:", e));
  }
  await purgePipelineTags(ghlContactId, "inspection");

  // DB transition → revival mission; sync Conversation phase + record the exit.
  await transitionLead(lead.id, ghlContactId, "sr_booking", "sr_follow_up", "DEMO_NOT_SOLD", "revival", {
    sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "revival",
  }, plan.exitSignal);

  // Durable booking_stall nuance: Lead mirror + GHL contact field (§8 — rides every
  // webhook). Jordan reads it at activation to seed the excavation opener.
  await prisma.lead.update({ where: { id: lead.id }, data: { srDispoContext: plan.srDispoContext ?? null } }).catch(() => null);
  if (plan.srDispoContext && process.env.GHL_FIELD_SR_DISPO_CONTEXT) {
    await writeGhlContactCustomField(ghlContactId, process.env.GHL_FIELD_SR_DISPO_CONTEXT, plan.srDispoContext).catch((e) =>
      console.error("[book/exhaust] sr_dispo_context write failed:", e),
    );
  }

  // Create the Revival opp at the destination stage (GHL fires Jordan's activation
  // on this stage change). Point the lead at the new opp.
  if (plan.revivalStage && process.env.GHL_PIPELINE_REVIVAL) {
    try {
      const revivalOppId = await createGhlOpportunity({
        ghlContactId,
        contactName: lead.customerName ?? "Homeowner",
        pipelineId: process.env.GHL_PIPELINE_REVIVAL,
        pipelineStageId: plan.revivalStage,
        sourceName: "revival:booking_stall",
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { ghlOpportunityId: revivalOppId } });
    } catch (e) {
      console.error("[book/exhaust] create Revival opp failed:", e);
    }
  }
}

// Legacy GHL stall_exhausted trigger — now a thin alias of the server crossing.
async function handleStallExhaustedWebhook(lead: Lead, ghlContactId: string): Promise<void> {
  await crossInspectionBookingToRevival(lead, ghlContactId);
}

async function handleAppointmentConfirmedWebhook(lead: Lead, srLead: SrLead, ghlContactId: string): Promise<void> {
  void ghlContactId;

  const assignedUserId = lead.assignedUserId ?? process.env.GHL_DEFAULT_ASSIGNEE_ID ?? null;
  if (!assignedUserId) {
    console.error("[book/appt_confirmed] no assignedUserId — cannot create Appointment");
    return;
  }

  // srAppointmentAt is written by transitionLead just before this webhook fires.
  const scheduledAt = srLead.srAppointmentAt ?? new Date();
  const zone = deriveZoneForLead(lead.sourceZip ?? null);

  try {
    const { appointmentId, inspectionId } = await createAppointmentWithInspection({
      leadId: lead.id,
      assignedUserId,
      scheduledAt,
      zone,
      createdBy: "ALEX",
    });
    console.log(`[book/appt_confirmed] appointment ${appointmentId} + inspection ${inspectionId} created for lead ${lead.id}`);
  } catch (err) {
    console.error("[book/appt_confirmed] createAppointmentWithInspection failed:", err);
  }
}

export async function handleBookWebhook(
  ctx: {
    lead: Lead;
    srLead: SrLead;
    ghlContactId: string;
    trigger: string;
    inboundMsg: string;
  },
  deps: BookIoDeps = {},
): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg } = ctx;
  const sendSms = deps.sendSms ?? sendGhlSms;
  const addTag = deps.addTag ?? addGhlTag;
  const removeTag = deps.removeTag ?? removeGhlTag;
  const confirmBooked =
    deps.confirmBooked ??
    (async (a) => handleBooked(a.slot, a.address, a.summary, a.lead, a.ghlContactId, a.zone, a.distanceZone));

  // ── Named-trigger dispatch (booking machinery — unchanged) ──────────────────
  if (trigger === "stall_exhausted") {
    await handleStallExhaustedWebhook(lead, ghlContactId);
    return;
  }
  if (trigger === "appointment_confirmed") {
    await handleAppointmentConfirmedWebhook(lead, srLead, ghlContactId);
    return;
  }

  // ── Booking Pending nudge accounting (Sprint 9 Part B/D) ────────────────────
  // A stall_followup fire is one UNANSWERED nudge (GHL fired it because
  // booking_pending was still present at the wait checkpoint). Increment the
  // CUMULATIVE attempts counter — never reset on re-stall, so a serial almost-books-
  // then-bails lead exhausts faster (it IS the seriousness metric / serial-no-show
  // seed). On exhaustion, cross to Revival instead of nudging again (Part D); only
  // full silence through the sequence reaches here.
  if (trigger === "stall_followup") {
    const cur = await getConversation(ghlContactId, { currentPhase: PHASE, leadId: lead.id });
    const attempts = cur.bookingPendingAttempts + 1;
    await writeSystemFields(ghlContactId, { bookingPendingAttempts: attempts }, { currentPhase: PHASE });
    if (bookingPendingExhausted(attempts)) {
      await crossInspectionBookingToRevival(lead, ghlContactId);
      return;
    }
    // else fall through: generate + send the diagnostic nudge (the engine flow).
  }

  // ── Cancellation (existing behavior, unchanged) ─────────────────────────────
  if (trigger === "inbound_sms" && isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: "scheduled" },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: { status: "cancelled", repNotes: "Cancelled via SMS" },
      });
      await transitionLead(lead.id, ghlContactId, "sr_booking", "sr_cancelled", "DEMO_NOT_SOLD", "silent", {
        sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "silent",
      });
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendSms(ghlContactId, `No problem, ${fn}. We've cancelled your inspection. If things change, reach out anytime.`);
      return;
    }
  }

  // ── Zone (reused machinery; matches the old handler's derivation) ───────────
  const leadZone = lead.sourceZip ? (getZoneForZip(lead.sourceZip) ?? null) : null;
  const distanceZone = leadZone ? isDistanceZone(leadZone) : false;
  const zone = leadZone ?? "el_paso_central";

  // ── System-authored fields → Conversation; returns CURRENT (pre-turn) state ─
  const convo = await writeSystemFields(
    ghlContactId,
    { leadId: lead.id },
    { currentPhase: PHASE, leadId: lead.id },
  );

  // ── Slot pre-fetch-and-inject (sprint_4 Step 3) ─────────────────────────────
  // Address is the model-authored Conversation.address (mirrored to the Lead on
  // collection). Once we have an address we pre-fetch real slots and inject them;
  // before that, availableSlots stays undefined and the Book mission keeps
  // collecting the address. Pre-fetching on every address-known book turn is
  // intentional (slots are cheap; one round-trip keeps Haiku snappy).
  const address = convo.address ?? lead.address ?? null;
  let availableSlots: { date: string; time: string; label: string }[] | undefined;
  let existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });
  if (address) {
    await purgeExpiredSlotLocks();
    const detected = trigger === "inbound_sms" ? detectTimePreference(inboundMsg) : null;
    const timePreference = detected?.preference ?? "any";
    const slots = await getAvailableSlots(zone, distanceZone, timePreference, detected?.startHour);
    if (slots.length > 0) {
      const [y, m, d] = slots[0].date.split("-").map(Number);
      await createSlotLock({
        date: new Date(y, m - 1, d),
        time: slots[0].time,
        zone,
        leadId: lead.id,
        label: slots[0].label || slots[0].time,
      });
      existingLock = await prisma.slotLock.findUnique({ where: { leadId: lead.id } });
    }
    availableSlots = slots;
  }

  // ── Classify the turn ───────────────────────────────────────────────────────
  const isRealInbound = trigger === "inbound_sms" && !!inboundMsg;
  let turnMessage: string;
  if (trigger === "qualified_handoff") {
    turnMessage =
      `[system: the homeowner was just QUALIFIED and handed to you for booking. Send your ` +
      `booking opener — greet warmly, do NOT re-sell or re-surface consequence, and begin ` +
      `collecting the service address.]`;
  } else if (trigger === "stall_followup") {
    turnMessage =
      `[system: booking stalled — the homeowner went quiet without landing a time. Send ONE ` +
      `brief, no-pressure follow-up that makes it easy to pick a time.]`;
  } else {
    turnMessage = inboundMsg;
  }

  // ── Build the turn input ────────────────────────────────────────────────────
  const { id: threadId, messages: priorMessages } = await getOrCreateThread(ghlContactId, "book");
  const history = (priorMessages as BotMessage[]).map((m) => ({
    role: (m.role === "assistant" ? "bot" : "lead") as "bot" | "lead",
    content: m.content,
    timestamp: m.timestamp,
  }));

  const input: TurnInput = {
    ghlContactId,
    inboundMessage: turnMessage,
    conversationState: conversationToStateInput(convo),
    conversationHistory: history,
    phase: PHASE,
    availableSlots,
  };

  // ── Run the engine (tier → Haiku; WOBBLING escalation DORMANT — see §3/Step 4) ─
  const result = await runComposedBotTurn(input);
  const sig = result.signal.type;

  // ── Persist model-authored state via the airtight seam ──────────────────────
  await applyModelStateDelta(ghlContactId, result.stateDelta, { currentPhase: PHASE });

  // Mirror a newly-collected address to the Lead record + GHL contact (existing
  // behavior). The model-authored address lives on the Conversation row; the Lead
  // is the canonical business record (ARCHITECTURE §7 — Conversation.address
  // mirrors TO Lead on book).
  const newAddress = (result.stateDelta as { address?: string | null }).address ?? null;
  if (newAddress && newAddress !== lead.address) {
    await prisma.lead.update({ where: { id: lead.id }, data: { address: newAddress } }).catch(() => null);
    await updateGhlContact(ghlContactId, { address1: newAddress }).catch(() => null);
  }

  // ── Persist system-authored fields (meta + heat clock) ──────────────────────
  const sysFields: Partial<SystemAuthoredFields> = {
    lastSignal: sig ?? null,
    lastModelTier: result.modelTier,
  };
  if (isRealInbound) sysFields.heatLastInbound = new Date();
  await writeSystemFields(ghlContactId, sysFields, { currentPhase: PHASE });

  // ── Transcript: append the real inbound (system turns have no real inbound) ──
  if (isRealInbound) await appendMessage(threadId, "user", inboundMsg);

  // ── Reply vs handoff ────────────────────────────────────────────────────────
  // Book sends Alex's reply for every signal EXCEPT a firm NOT_INTERESTED (respect
  // the no). BOOKED's reply is the homeowner-facing confirmation; STALL/WOBBLING/
  // SOFT_CLOSE/ESCALATE all want Alex's closing message to land.
  const sendReply = sig !== "NOT_INTERESTED";
  if (sendReply && result.reply) {
    await sendSms(ghlContactId, result.reply);
    await appendMessage(threadId, "assistant", result.reply);
  }

  // ── Act on the signal ───────────────────────────────────────────────────────
  switch (sig) {
    case "BOOKED": {
      // The new engine produced BOOKED + the chosen slot (in state.selectedSlot —
      // see resolveBookedSlot). Hand off to the EXISTING confirm path (timezone
      // math, validateSlotBeforeConfirm, confirmBooking, transitionLead →
      // INSPECTION_SCHEDULED, notifyRep). Nothing here is rebuilt.
      const selectedSlot = (result.stateDelta as { selectedSlot?: string | null }).selectedSlot ?? null;
      const slot = resolveBookedSlot(selectedSlot, availableSlots, existingLock);
      if (!slot) {
        console.error(`[book] BOOKED but no resolvable slot (selectedSlot=${JSON.stringify(selectedSlot)}) — cannot confirm`);
        break;
      }
      await confirmBooked({
        slot,
        address,
        summary: summaryToText(result.stateDelta, convo.summary),
        lead,
        ghlContactId,
        zone,
        distanceZone,
      });
      break;
    }
    case "STALL":
      // PATTERN A (Sprint 9 Part B): the lead was offered times and went quiet. Add
      // booking_pending (the "awaiting commitment" tag) and move the opp to the
      // Booking Pending STAGE so the silence clock + nudge cadence trigger on STAGE
      // ENTRY. srBotStage stays "booking" so a stall_followup nudge routes back here
      // by stage. The cumulative attempts counter increments per UNANSWERED nudge
      // (the stall_followup branch above), never here.
      await addTag(ghlContactId, BOOKING_PENDING_TAG).catch((e) => console.error(e));
      if (lead.ghlOpportunityId && bookingPendingStage("inspection")) {
        await moveGhlOpportunityStage(lead.ghlOpportunityId, bookingPendingStage("inspection")!).catch((e) =>
          console.error("[book] move→Booking Pending failed:", e),
        );
      }
      break;
    case "WOBBLING":
      // A real named objection reopened a supposedly-closed gate at the booking
      // moment. RECORD ONLY this sprint — it's already persisted as lastSignal
      // above. Do NOT escalate the tier and do NOT touch GHL (ARCHITECTURE §3/§6).
      //
      // WOBBLING escalation dormant — activate in a later sprint if telemetry
      // shows Haiku losing recoverable bookings (a high WOBBLING rate would also
      // indicate qualify is rubber-stamping leads).
      console.info(`[book] WOBBLING recorded (dormant — no tier escalation) contact=${ghlContactId} reason=${JSON.stringify(result.signal.reason)}`);
      break;
    case "NOT_INTERESTED":
      await transitionLead(lead.id, ghlContactId, "sr_booking", "sr_dead", "DEAD", "silent", {
        sr_status: "DEAD", sr_bot_stage: "silent",
      }, "NOT_INTERESTED");
      if (lead.ghlOpportunityId) {
        await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_DEAD!).catch((e) => console.error(e));
      }
      break;
    case "SOFT_CLOSE":
      await addTag(ghlContactId, "sr_soft_close").catch((e) => console.error(e));
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      break;
    case "ESCALATE":
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      await addTag(ghlContactId, "sr_escalation").catch(() => null);
      break;
    default:
      break;
  }

  void removeTag; // reserved for parity with other handlers
}

// Resolve the concrete "YYYY-MM-DD HH:MM" slot for a BOOKED turn. Primary source
// is the model-authored state.selectedSlot (the canonical home for the chosen
// slot — ARCHITECTURE §5; signal.reason is prose-only). Falls back to the
// locked/first-offered slot so a malformed/missing selectedSlot never blocks a
// booking we have a valid slot for.
function resolveBookedSlot(
  selectedSlot: string | null,
  offered: { date: string; time: string }[] | undefined,
  lock: { date: Date; time: string } | null,
): string | null {
  if (selectedSlot) {
    const m = selectedSlot.match(BOOKED_SLOT_RE);
    if (m) return m[0];
  }
  if (offered && offered.length > 0) return `${offered[0].date} ${offered[0].time}`;
  if (lock) {
    const ld = lock.date;
    const dateStr = `${ld.getFullYear()}-${String(ld.getMonth() + 1).padStart(2, "0")}-${String(ld.getDate()).padStart(2, "0")}`;
    return `${dateStr} ${lock.time}`;
  }
  return null;
}

// Flatten the structured handoff summary (ARCHITECTURE §5) into a one-line string
// for the rep notification. Prefers the just-emitted delta, falls back to the
// stored row value.
function summaryToText(stateDelta: Record<string, unknown>, stored: unknown): string | null {
  const s = ((stateDelta.summary as ContractSummary | undefined) ?? (stored as ContractSummary | null)) || null;
  if (!s) return null;
  return [s.situation, s.problem, s.consequence, s.openObjection, s.nextStep]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" · ") || null;
}

// ── handleBooked — the EXISTING confirm path (reused; address/summary decoupled
// from the dead BotContext type, otherwise unchanged: MT→UTC math,
// validateSlotBeforeConfirm, confirmBooking, transitionLead, notifyRep). ───────
async function handleBooked(
  bookedSlot: string,
  address: string | null,
  summary: string | null,
  lead: Lead,
  ghlContactId: string,
  zone: string,
  distanceZone: boolean,
): Promise<void> {
  void distanceZone;

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(bookedSlot)) {
    console.error(`[book] BOOKED signal has invalid slot format: "${bookedSlot}"`);
    return;
  }

  const [datePart, timePart] = bookedSlot.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Convert MT wall-clock to UTC
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const off = ((): number => {
    const pts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(guess);
    const h = parseInt(pts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(pts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return h * 60 + m - (hour * 60 + minute);
  })();
  const appointmentDate = new Date(guess.getTime() - off * 60 * 1000);

  console.info("[book] booked_slot raw value:", bookedSlot);
  const formattedDatetime = formatAppointmentDatetime(bookedSlot);

  const validation = await validateSlotBeforeConfirm(lead.id, appointmentDate, timePart, zone);
  if (!validation.ok) {
    console.warn("[book] slot conflict on confirm:", validation.reason);
    return;
  }

  try {
    await confirmBooking(lead.id, ghlContactId, appointmentDate, formattedDatetime, address ?? undefined);
  } catch (err) {
    console.error("[book] confirmBooking failed:", err);
    return;
  }

  await transitionLead(lead.id, ghlContactId, "sr_booking", "sr_appointment_set", "INSPECTION_SCHEDULED", "silent", {
    sr_status: "INSPECTION_SCHEDULED", sr_appointment_at: appointmentDate.toISOString(), sr_bot_stage: "silent",
  }, "BOOKED");

  if (lead.ghlOpportunityId) {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_APPOINTMENT_SET!).catch((err) =>
      console.error("[book] moveStage APPOINTMENT_SET failed:", err),
    );
  }

  if (lead.assignedUserId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
    const repMsg =
      `New inspection booked!\n\n` +
      `Homeowner: ${lead.customerName}\n` +
      `Address:   ${address ?? "not provided"}\n` +
      `Date/Time: ${formattedDatetime}\n` +
      `Phone:     ${lead.phone ?? "not on file"}\n\n` +
      `Summary: ${summary ?? "n/a"}\n\n` +
      `${appUrl}/leads/${lead.id}`;
    await notifyRep(lead.assignedUserId, lead.id, repMsg).catch((err) =>
      console.error("[book] notifyRep failed:", err),
    );
  }
}
