// lib/conversation — the read/write layer for the per-contact Conversation
// record (ARCHITECTURE.md §7). This is where the model-authored / system-authored
// seam stops being a prompt instruction and becomes a CODE-LEVEL guarantee.
//
// Three entry points:
//   - getConversation         — read (creates a default row if none exists)
//   - applyModelStateDelta     — the ONLY path model output takes into the DB;
//                                accepts ONLY model-authored fields, silently
//                                drops everything else
//   - writeSystemFields        — the separate, app-only path for system-authored
//                                fields (stage changes, GHL payloads, heat eval…)
//
// Plus syncPhaseTransition(), used inside transitionLead's transaction to keep
// currentPhase + phaseHistory in lockstep with srBotStage.
//
// SPRINT 3-5: the live bot handlers (nurture/qualify/book + Jordan) will call
// getConversation + applyModelStateDelta here, replacing their reads/writes of
// BotThread.metadata.bot_context. They do NOT yet — they still use bot_context.

import { prisma } from "@/src/lib/prisma";
import { Prisma, type Conversation } from "@prisma/client";
import {
  MODEL_AUTHORED_FIELDS,
  SYSTEM_AUTHORED_FIELDS,
  partitionStateDelta,
  type SystemAuthoredField,
} from "@/src/lib/bot-v2/field-authorship";
import type { ConversationStateInput, Phase } from "@/src/lib/bot-v2/types";

// Any Prisma client surface (the global client or a $transaction client). Lets
// the same write helpers run inside transitionLead's interactive transaction.
type Db = Prisma.TransactionClient | typeof prisma;

// ─── Phase vocabulary normalization ────────────────────────────────────────
//
// FLAG / known seam: srBotStage (the GHL routing key passed to transitionLead)
// uses "qualifying"/"booking", while the bot-v2 Phase enum and ARCHITECTURE §7's
// currentPhase value list use "qualify"/"book". The two vocabularies disagree in
// the source material itself (§2 vs §7). We normalize TO the Phase vocabulary
// when writing Conversation.currentPhase, because that is what the prompt
// assembler reads (Sprint 2+). srBotStage itself is left untouched.
const SR_STAGE_TO_PHASE: Record<string, string> = {
  qualifying: "qualify",
  booking: "book",
};

export function normalizePhase(srBotStage: string): string {
  return SR_STAGE_TO_PHASE[srBotStage] ?? srBotStage;
}

// ─── System-authored input typing ──────────────────────────────────────────
//
// The fields writeSystemFields is allowed to set. Mirrors SYSTEM_AUTHORED_FIELDS
// (the single source of truth). currentPhase/phaseHistory are intentionally
// excluded from the public surface here: they move only through
// syncPhaseTransition (inside transitionLead's transaction) so routing state and
// conversation state can never diverge.
export type SystemAuthoredFields = {
  leadId: string | null;
  sourceType: string | null;
  sourceChannel: string | null;
  funnelConcerns: Prisma.InputJsonValue | null;
  repName: string | null;
  consequenceLikelySurfaced: boolean | null;
  affordabilityIsReal: boolean;
  rescheduleSubCase: string | null;
  daysSinceAppointment: number | null;
  heatState: string;
  heatLastInbound: Date | null;
  heatPeakReached: boolean;
  bookingPendingAttempts: number;
  reengageAttempts: number;
  zipWasHeld: boolean;
  lastSignal: string | null;
  lastModelTier: string | null;
};

// ─── getConversation ───────────────────────────────────────────────────────
//
// Read the full Conversation for a contact, creating a default row if none
// exists so callers never have to null-check. Row creation is system-authored
// work, so it never goes through the model path. `currentPhase` defaults to the
// caller-provided phase if known, else "silent".
export async function getConversation(
  ghlContactId: string,
  opts?: { currentPhase?: string; leadId?: string | null },
): Promise<Conversation> {
  return prisma.conversation.upsert({
    where: { ghlContactId },
    update: {}, // read-or-create only — never mutate an existing row here
    create: {
      ghlContactId,
      leadId: opts?.leadId ?? null,
      currentPhase: opts?.currentPhase ?? "silent",
      // All other fields fall to their schema defaults (heatState "cold", empty
      // arrays, false booleans, null scalars).
    },
  });
}

// ─── applyModelStateDelta ──────────────────────────────────────────────────
//
// THE ONLY path model output takes into the DB. Accepts ONLY the model-authored
// fields (ARCHITECTURE §5's `state` block); silently drops any system-authored
// field (currentPhase, heatState, affordabilityIsReal, sourceType, phaseHistory,
// …) and any unknown key. This is the structural replacement for the old fragile
// "preserve and enrich, never overwrite" instruction — the model literally
// cannot write what this function won't accept.
//
// Merge behavior per field (the model emits the CURRENT turn's view; we
// accumulate across turns):
//   - objectionsSurfaced : ACCUMULATE — append newly-surfaced objections,
//                          de-duped by (family + surfaceForm); a later entry for
//                          the same key replaces the earlier (captures resolved
//                          flips). Never wipes prior objections.
//   - motivation         : MERGE union — add new motivation strings, dedup.
//   - decisionMakers      : MERGE by `role` — upsert each role, last-write-wins
//                          per role; never drops a previously-seen role.
//   - scalars / structured-snapshots (nepqPhase, urgency, consequenceSurfaced,
//     gateProblem, gateDecisionMaker, primaryObjection, timePrefs, address,
//     selectedSlot, summary) : LAST-WRITE-WINS — the model's latest snapshot
//     replaces the old.
//
// Booleans use OR-with-prior only where a gate, once true, should not silently
// regress on an omitting turn: gateProblem/gateDecisionMaker/consequenceSurfaced
// are sticky-true (a confirmed gate stays confirmed unless explicitly re-set in
// the same field). Other scalars are plain last-write-wins.
export async function applyModelStateDelta(
  ghlContactId: string,
  stateDelta: Record<string, unknown>,
  opts?: { db?: Db; currentPhase?: string },
): Promise<Conversation> {
  const db = opts?.db ?? prisma;

  // THE SEAM: keep only model-authored keys; drop (and log) everything else.
  const { modelAuthored, droppedKeys } = partitionStateDelta(stateDelta ?? {});
  if (droppedKeys.length > 0) {
    console.warn(
      `[conversation] applyModelStateDelta dropped ${droppedKeys.length} non-model-authored ` +
        `field(s) from model output for contact ${ghlContactId}: ${droppedKeys.join(", ")}`,
    );
  }

  // Load (or create) current state so array/object merges accumulate.
  const current = await getConversation(ghlContactId, { currentPhase: opts?.currentPhase });

  const data: Prisma.ConversationUpdateInput = {};

  // ── Last-write-wins scalars / structured snapshots ──
  if ("nepqPhase" in modelAuthored) data.nepqPhase = asNullableString(modelAuthored.nepqPhase);
  if ("urgency" in modelAuthored) data.urgency = asNullableString(modelAuthored.urgency);
  if ("primaryObjection" in modelAuthored)
    data.primaryObjection = asNullableString(modelAuthored.primaryObjection);
  if ("address" in modelAuthored) data.address = asNullableString(modelAuthored.address);
  if ("selectedSlot" in modelAuthored) data.selectedSlot = asNullableString(modelAuthored.selectedSlot);
  if ("timePrefs" in modelAuthored)
    data.timePrefs = (modelAuthored.timePrefs ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  if ("summary" in modelAuthored)
    data.summary = (modelAuthored.summary ?? Prisma.JsonNull) as Prisma.InputJsonValue;

  // ── Sticky-true gate booleans ──
  if ("consequenceSurfaced" in modelAuthored)
    data.consequenceSurfaced = current.consequenceSurfaced || Boolean(modelAuthored.consequenceSurfaced);
  if ("gateProblem" in modelAuthored)
    data.gateProblem = current.gateProblem || Boolean(modelAuthored.gateProblem);
  if ("gateDecisionMaker" in modelAuthored)
    data.gateDecisionMaker = current.gateDecisionMaker || Boolean(modelAuthored.gateDecisionMaker);

  // ── Accumulating lists ──
  if ("motivation" in modelAuthored) {
    data.motivation = mergeMotivation(
      asArray(current.motivation),
      asArray(modelAuthored.motivation),
    ) as Prisma.InputJsonValue;
  }
  if ("objectionsSurfaced" in modelAuthored) {
    data.objectionsSurfaced = mergeObjections(
      asArray(current.objectionsSurfaced),
      asArray(modelAuthored.objectionsSurfaced),
    ) as Prisma.InputJsonValue;
  }
  if ("decisionMakers" in modelAuthored) {
    data.decisionMakers = mergeDecisionMakers(
      asArray(current.decisionMakers),
      asArray(modelAuthored.decisionMakers),
    ) as Prisma.InputJsonValue;
  }

  return db.conversation.update({ where: { ghlContactId }, data });
}

// ─── writeSystemFields ─────────────────────────────────────────────────────
//
// The separate, app-only write path for SYSTEM-authored fields. Called by app
// code (GHL payloads, heat eval, rep-note derivation, lead creation) — NEVER
// with model output. Filtered to the system-authored allowlist as a belt-and-
// suspenders guard, so even a caller mistake can't write a model-authored field
// through this path either.
export async function writeSystemFields(
  ghlContactId: string,
  fields: Partial<SystemAuthoredFields>,
  opts?: { db?: Db; currentPhase?: string; leadId?: string | null },
): Promise<Conversation> {
  const db = opts?.db ?? prisma;
  await getConversation(ghlContactId, { currentPhase: opts?.currentPhase, leadId: opts?.leadId });

  const data: Prisma.ConversationUpdateInput = {};
  for (const key of SYSTEM_AUTHORED_FIELDS) {
    // currentPhase/phaseHistory are not part of SystemAuthoredFields and move
    // only through syncPhaseTransition; SYSTEM_AUTHORED_FIELDS still lists them
    // for the seam test, so skip them here.
    if (key === "currentPhase" || key === "phaseHistory") continue;
    if (key in fields) {
      const value = (fields as Record<string, unknown>)[key];
      (data as Record<string, unknown>)[key] =
        key === "funnelConcerns" ? (value ?? Prisma.JsonNull) : value;
    }
  }

  return db.conversation.update({ where: { ghlContactId }, data });
}

// ─── syncPhaseTransition ───────────────────────────────────────────────────
//
// Called from INSIDE transitionLead's transaction (passed the tx client) so the
// conversation-side phase mirror moves atomically with the srBotStage change.
// Sets currentPhase to the new (normalized) phase and appends a phaseHistory
// entry { phase, enteredAt, exitSignal }. Idempotent on currentPhase; a history
// entry is appended whenever the phase actually changes. Uses upsert because an
// early-funnel contact may not have a Conversation row yet at first transition.
export async function syncPhaseTransition(
  db: Db,
  ghlContactId: string,
  srBotStage: string,
  exitSignal: string | null,
  opts?: { leadId?: string | null; enteredAt?: Date },
): Promise<void> {
  const newPhase = normalizePhase(srBotStage);
  const enteredAt = (opts?.enteredAt ?? new Date()).toISOString();

  const existing = await db.conversation.findUnique({
    where: { ghlContactId },
    select: { currentPhase: true, phaseHistory: true },
  });

  if (!existing) {
    // First time we see this contact — create the row already in the new phase
    // with the opening history entry.
    await db.conversation.create({
      data: {
        ghlContactId,
        leadId: opts?.leadId ?? null,
        currentPhase: newPhase,
        phaseHistory: [{ phase: newPhase, enteredAt, exitSignal }] as Prisma.InputJsonValue,
      },
    });
    return;
  }

  // No-op transition (same phase): keep currentPhase, don't pollute history.
  if (existing.currentPhase === newPhase) return;

  const history = Array.isArray(existing.phaseHistory) ? existing.phaseHistory : [];
  await db.conversation.update({
    where: { ghlContactId },
    data: {
      currentPhase: newPhase,
      ...(opts?.leadId !== undefined ? { leadId: opts.leadId } : {}),
      phaseHistory: [...history, { phase: newPhase, enteredAt, exitSignal }] as Prisma.InputJsonValue,
    },
  });
}

// ─── merge helpers ─────────────────────────────────────────────────────────

function mergeMotivation(prev: unknown[], next: unknown[]): string[] {
  const out = new Set<string>();
  for (const v of [...prev, ...next]) {
    if (typeof v === "string" && v.trim()) out.add(v);
  }
  return [...out];
}

// Append new objections, keyed by family + surfaceForm. A later entry for the
// same key replaces the earlier one (so a `resolved: true` flip on a re-surfaced
// objection is captured) without ever dropping objections from prior turns.
function mergeObjections(prev: unknown[], next: unknown[]): unknown[] {
  const byKey = new Map<string, unknown>();
  const keyOf = (o: unknown): string => {
    const e = (o ?? {}) as Record<string, unknown>;
    return `${String(e.family ?? "")}::${String(e.surfaceForm ?? "")}`;
  };
  for (const o of prev) byKey.set(keyOf(o), o);
  for (const o of next) byKey.set(keyOf(o), o);
  return [...byKey.values()];
}

// Upsert decision-makers by role; last-write-wins per role; never drops a role.
function mergeDecisionMakers(prev: unknown[], next: unknown[]): unknown[] {
  const byRole = new Map<string, unknown>();
  const roleOf = (o: unknown): string => String(((o ?? {}) as Record<string, unknown>).role ?? "");
  for (const o of prev) byRole.set(roleOf(o), o);
  for (const o of next) byRole.set(roleOf(o), o);
  return [...byRole.values()];
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asNullableString(v: unknown): string | null {
  return v == null ? null : String(v);
}

// ─── conversationToStateInput ──────────────────────────────────────────────
//
// Map the durable Conversation row (Prisma) → the engine's read-only state input
// (ARCHITECTURE §7 → §5). The DateTime heatLastInbound becomes an ISO string
// (what selectTier's lazy cooldown expects); Json columns pass through as-is.
//
// This lives here, in the conversation layer, so EVERY live bot handler
// (nurture/qualify/book + Jordan in Sprint 5) maps the row the same way — one
// source of truth for the row→engine shape, no per-handler copies to drift.
export function conversationToStateInput(c: Conversation): ConversationStateInput {
  return {
    ghlContactId: c.ghlContactId,
    leadId: c.leadId,
    currentPhase: c.currentPhase as Phase,
    phaseHistory: (c.phaseHistory as ConversationStateInput["phaseHistory"]) ?? [],
    nepqPhase: c.nepqPhase,
    motivation: (c.motivation as string[]) ?? [],
    urgency: c.urgency,
    consequenceSurfaced: c.consequenceSurfaced,
    gateProblem: c.gateProblem,
    gateDecisionMaker: c.gateDecisionMaker,
    objectionsSurfaced: (c.objectionsSurfaced as unknown as ConversationStateInput["objectionsSurfaced"]) ?? [],
    primaryObjection: c.primaryObjection,
    decisionMakers: (c.decisionMakers as unknown as ConversationStateInput["decisionMakers"]) ?? [],
    timePrefs: (c.timePrefs as ConversationStateInput["timePrefs"]) ?? null,
    address: c.address,
    selectedSlot: c.selectedSlot,
    sourceType: c.sourceType,
    sourceChannel: c.sourceChannel,
    funnelConcerns: (c.funnelConcerns as ConversationStateInput["funnelConcerns"]) ?? null,
    repName: c.repName,
    consequenceLikelySurfaced: c.consequenceLikelySurfaced,
    affordabilityIsReal: c.affordabilityIsReal,
    rescheduleSubCase: c.rescheduleSubCase,
    daysSinceAppointment: c.daysSinceAppointment,
    heatState: (c.heatState as "cold" | "warming") ?? "cold",
    heatLastInbound: c.heatLastInbound ? c.heatLastInbound.toISOString() : null,
    heatPeakReached: c.heatPeakReached,
    bookingPendingAttempts: c.bookingPendingAttempts,
    reengageAttempts: c.reengageAttempts,
    zipWasHeld: c.zipWasHeld,
    summary: (c.summary as ConversationStateInput["summary"]) ?? null,
    lastSignal: c.lastSignal,
    lastModelTier: c.lastModelTier,
  };
}

// Re-export the authoritative lists so consumers can import the seam from the
// conversation layer without reaching past it.
export { MODEL_AUTHORED_FIELDS, SYSTEM_AUTHORED_FIELDS };
export type { Conversation };
