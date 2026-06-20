// ── RE-ENGAGEMENT HANDLER — per-mission, context-driven (Sprint 8 Part A) ────
//
// Replaces the old universal "Soft Close Nurture Drip" (a blind, segment-agnostic
// 4-message sequence with no reply-gate). A re-engagement fire is GHL saying "this
// lead in mission X has gone quiet — generate re-engagement opener attempt N."
//
// It is NOT a new mission and NOT a parallel prompt stack. It is the SAME composed
// prompt as the lead's CURRENT mission (kernel + methodology + persona + mission),
// with a runtime TASK framing — "the lead went silent; generate a re-engagement
// opener that provokes a reply" instead of "respond to this message." Same identity,
// same context, same tier rules; only the task framing differs. It inherits
// everything (ARCHITECTURE §8 — re-engagement composes the lead's mission prompt, so
// a revival re-engagement is Jordan acknowledge-first, a nurture one is Alex warm).
//
// Two correctness invariants this file enforces:
//   1. HYBRID generation — REAL context (inspectionFindings / surfaced objection /
//      sr_dispo_context / funnelConcerns) → model-generated, context-aware opener.
//      NO real context (a cold guide lead who never engaged) → a simple template,
//      NO model call (a generic "still interested?" buys nothing over a template).
//   2. The turn emits a NULL signal (the lead hasn't replied — nothing to act on)
//      and MUST NOT touch heatLastInbound (the cooldown keys off the lead's INBOUND
//      silence; an outbound drip is not an inbound and must never reset that clock —
//      ARCHITECTURE §3). A warmed-then-ghosted lead must still cool down.
//
// Cadence and stop-conditions are GHL's job (the guard-tag pattern, Part B). This
// handler just generates THIS opener for THIS attempt when GHL fires.

import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import { getOrCreateThread, appendMessage, transitionLead } from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  moveGhlOpportunityStage,
  resolveGhlOpportunity,
} from "@/src/lib/ghl-contacts";
import {
  writeSystemFields,
  applyModelStateDelta,
  conversationToStateInput,
  getConversation,
  normalizePhase,
  type SystemAuthoredFields,
} from "@/src/lib/conversation";
import { loadRecoveryContext } from "@/src/lib/bot-handlers/jordan-recovery";
import { runComposedBotTurn } from "@/src/lib/bot-v2/engine";
import type { ClaudeCaller } from "@/src/lib/bot-v2/claude-call";
import type { Phase, TurnInput } from "@/src/lib/bot-v2/types";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

const JORDAN_PHASES = new Set<string>(["revival", "reschedule", "finance"]);
const VALID_PHASES = new Set<string>([
  "nurture",
  "qualify",
  "book",
  "revival",
  "reschedule",
  "finance",
]);

// The in-sequence re-engagement guard tags (the reply-gate). The stage-triggered
// workflows (21/22, addendum) add their mission's tag after stage entry; the central
// inbound handler removes them on a real reply so the workflow's `goto` restarts the
// silence timer instead of nudging an active lead — exactly like booking_pending.
// Only the two in-scope (stage-triggered) missions are listed.
export const REENGAGE_GUARD_TAGS = [
  "sr_nurture_reengage",
  "sr_revival_reengage",
] as const;

// Exhaust after N re-engagement nudges. CUMULATIVE (never reset) — the seriousness
// metric, like bookingPendingAttempts. Tunable; start at 3. Cadence (time between
// fires) is GHL-owned and mission-specific; the COUNT is server-owned and shared.
export const REENGAGE_MAX_ATTEMPTS = 3;

// Pure exhaustion test (mirrors bookingPendingExhausted) — testable in isolation.
export function reengageExhausted(attempts: number): boolean {
  return attempts >= REENGAGE_MAX_ATTEMPTS;
}

// EXHAUST a re-engagement: move the lead OUT of its re-engaging stage so the GHL
// loop ends (its top guard sees the lead left the stage). The server owns
// exhaustion; GHL just loops while the lead is in-stage. Exhaustion is DORMANT, not
// hard-dead (hard-dead is reserved for opt-out/compliance — ARCHITECTURE §11) — the
// sr_exhausted tag records WHY it died so a later self-initiated inbound can be
// distinguished from an opt-out.
//   - nurture (Roof Guide): never warmed enough → close the Roof Guide opp LOST
//     (dormant). No dedicated dormant stage exists in Roof Guide, so we resolve-lost
//     in place; a lost opp leaves the active re-engaging flow.
//   - revival (Revival): failed to re-engage → move to the Exhausted stage (dormant),
//     mirroring the Revival booking-stall exhaustion (Sprint 9 Part D).
async function exhaustReengagement(
  phase: Phase,
  lead: Lead,
  ghlContactId: string,
  addTag: (ghlContactId: string, tag: string) => Promise<void>,
): Promise<void> {
  await addTag(ghlContactId, "sr_exhausted").catch((e) => console.error(e));

  if (phase === "revival") {
    if (lead.ghlOpportunityId && process.env.GHL_STAGE_EXHAUSTED) {
      await resolveGhlOpportunity(
        lead.ghlOpportunityId,
        process.env.GHL_STAGE_EXHAUSTED,
        "lost",
      ).catch((e) => console.error("[reengage/revival] move→Exhausted failed:", e));
    }
    await transitionLead(
      lead.id,
      ghlContactId,
      "sr_follow_up",
      "sr_exhausted",
      "DEMO_NOT_SOLD",
      "silent",
      { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "silent" },
      "REENGAGE_EXHAUSTED_REVIVAL",
    );
    return;
  }

  // nurture (and any other Roof-Guide-side mission): close-lost the Roof Guide opp.
  if (lead.ghlOpportunityId && process.env.GHL_STAGE_NURTURE_REENGAGING) {
    await resolveGhlOpportunity(
      lead.ghlOpportunityId,
      process.env.GHL_STAGE_NURTURE_REENGAGING,
      "lost",
    ).catch((e) => console.error("[reengage/nurture] close-lost failed:", e));
  }
  await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
}

// Injectable outward side-effects (mirrors the other handlers) so the harness can
// drive the full loop against the real DB without sending SMS or calling Claude.
export interface ReengageIoDeps {
  sendSms?: (ghlContactId: string, message: string) => Promise<void>;
  // The GHL tag seam (defaults to live addGhlTag). Injected by the harness so the
  // exhaustion path (which tags sr_exhausted) is drivable without live GHL.
  addTag?: (ghlContactId: string, tag: string) => Promise<void>;
  // The engine's model seam (defaults to live). Injected by the harness so the
  // hybrid behavior is testable: the mock is called on the context path and MUST
  // NOT be called on the template path.
  callClaude?: ClaudeCaller;
}

// Per-mission template fallback — used ONLY when the lead has no real context to
// reference (no model call). Persona-light on purpose: a generic nudge gains
// nothing from the model. Keyed by Phase; falls back to a neutral check-in.
function templateOpener(phase: string, firstName: string): string {
  const name = firstName || "there";
  switch (phase) {
    case "nurture":
      return `Hey ${name} — just checking back in. Still thinking about getting the roof looked at? No rush at all, just keeping the door open whenever you're ready.`;
    case "revival":
    case "reschedule":
      return `Hey ${name} — circling back one more time. Still happy to help get this sorted whenever the timing works for you. No pressure either way.`;
    case "finance":
      return `Hey ${name} — wanted to check back in. There are a few different ways to make this work, and I'm glad to walk through them whenever you've got a minute.`;
    default:
      return `Hey ${name} — just checking back in to see if now's a better time. No pressure at all.`;
  }
}

// The re-engagement TASK framing injected as the turn's "inbound" so the model
// produces an opener instead of a reply. Generic on purpose: the composed persona +
// mission shape the voice (Jordan acknowledge-first, Alex warm). Attempt number lets
// the model vary later nudges. Guardrails are restated so the nudge never pressures.
function reengageInstruction(attempt: number): string {
  return (
    `[system: re-engagement attempt #${attempt} — the homeowner has gone quiet (no reply to your ` +
    `last message). This is PROACTIVE outreach, not a response to a new message. Generate ONE short ` +
    `re-engagement opener that gently provokes a reply. Stay fully in character and respect your ` +
    `guardrails: do NOT pressure, do NOT re-sell or re-surface consequence, reference what you ` +
    `genuinely already know about them (their stated problem / the inspection finding / their ` +
    `objection) when you have it, and make it easy and low-friction to respond.]`
  );
}

export async function handleReengageWebhook(
  ctx: {
    lead: Lead;
    srLead: SrLead;
    ghlContactId: string;
    // Parked-lead fallback only (e.g. a recovery mission still parked in "silent").
    // The stage-triggered workflows (21/22) send NO mission hint — the mission is
    // derived from the lead's CURRENT stage. Kept optional for the fallback path.
    mission: string | null;
    // DEPRECATED/IGNORED: the webhook no longer carries an attempt number. The
    // server owns the cumulative count (Conversation.reengageAttempts) below.
    attempt?: number;
    srDispoContext: string | null;
  },
  deps: ReengageIoDeps = {},
): Promise<void> {
  const { lead, srLead, ghlContactId, mission, srDispoContext } = ctx;
  const sendSms = deps.sendSms ?? sendGhlSms;
  const addTag = deps.addTag ?? addGhlTag;

  // ── Resolve the lead's CURRENT mission ───────────────────────────────────────
  // §8: the STAGE is the single source of truth for which mission. The durable
  // phase is Conversation.currentPhase (kept in sync with srBotStage in
  // transitionLead), with the raw srBotStage as the backstop. Prefer that stage
  // truth; only if the lead is parked in "silent" (recovery SOFT_CLOSE cleared the
  // stage, so it can't name the mission) do we fall back to the `mission` hint GHL
  // passed (the guard-tag sequence that fired). If the lead has MOVED on, the stage
  // wins over a stale firing — never re-engage the wrong mission off a trigger name.
  const convo = await getConversation(ghlContactId, { leadId: lead.id });
  const fromConvo = convo.currentPhase;
  const fromStage = normalizePhase(srLead.srBotStage ?? "");
  const stagePhase =
    VALID_PHASES.has(fromConvo) && fromConvo !== "silent"
      ? fromConvo
      : VALID_PHASES.has(fromStage) && fromStage !== "silent"
        ? fromStage
        : null;
  const phase: Phase = (
    stagePhase ?? (mission && VALID_PHASES.has(mission) ? mission : fromConvo)
  ) as Phase;

  // ── Server-owned attempt tracking + exhaustion (addendum) ────────────────────
  // The webhook carries no attempt number; the server increments the cumulative
  // counter on every fire (like bookingPendingAttempts — never reset). THIS nudge
  // is attempt #N. Once N >= MAX, EXHAUST instead of nudging: move the lead OUT of
  // its re-engaging stage so the GHL loop ends (its guard sees the lead left), and
  // return WITHOUT sending another nudge.
  const attempt = convo.reengageAttempts + 1;
  await writeSystemFields(ghlContactId, { reengageAttempts: attempt }, { currentPhase: phase });
  if (reengageExhausted(attempt)) {
    await exhaustReengagement(phase, lead, ghlContactId, addTag);
    return;
  }

  const firstName = (lead.customerName ?? "").trim().split(/\s+/)[0] ?? "";

  // ── Load recovery context for Jordan missions (the source of "real context") ──
  // For Alex missions there is no recovery context; real context is the funnel/
  // surfaced state already on the Conversation.
  const isJordan = JORDAN_PHASES.has(phase);
  const recovery = isJordan ? await loadRecoveryContext(lead) : null;

  // ── HYBRID decision: is there something SPECIFIC to reference? ───────────────
  const hasObjection =
    !!srDispoContext ||
    !!recovery?.dispoPrimaryObjection ||
    !!convo.primaryObjection;
  const hasFunnel =
    !!convo.funnelConcerns &&
    (Array.isArray(convo.funnelConcerns)
      ? convo.funnelConcerns.length > 0
      : Object.keys(convo.funnelConcerns as object).length > 0);
  const hasSurfaced =
    (Array.isArray(convo.objectionsSurfaced) && convo.objectionsSurfaced.length > 0) ||
    (Array.isArray(convo.motivation) && convo.motivation.length > 0);
  const hasRealContext =
    !!recovery?.inspectionFindings || hasObjection || hasFunnel || hasSurfaced;

  // The transcript thread (shared across both paths so the next turn sees the nudge).
  const { id: threadId, messages: priorMessages } = await getOrCreateThread(
    ghlContactId,
    phase as Exclude<Phase, "silent">,
  );

  let message: string;
  let modelTier: string | null = null;

  if (!hasRealContext) {
    // ── TEMPLATE path — NO model call ─────────────────────────────────────────
    message = templateOpener(phase, firstName);
  } else {
    // ── MODEL path — same composed mission prompt, re-engagement task framing ──
    const history = (priorMessages as BotMessage[]).map((m) => ({
      role: (m.role === "assistant" ? "bot" : "lead") as "bot" | "lead",
      content: m.content,
      timestamp: m.timestamp,
    }));

    const stateInput = conversationToStateInput(convo);

    // Read-seed known-problem facts for Jordan missions exactly as jordan-core does
    // (ARCHITECTURE §7) so a context-aware revival nudge references the real finding/
    // objection instead of re-asking. Pure in-memory seed — model stays non-author.
    if (isJordan && recovery) {
      if (!stateInput.address && lead.address) stateInput.address = lead.address;
      if (!stateInput.funnelConcerns && (recovery.inspectionFindings || srDispoContext || recovery.dispoPrimaryObjection)) {
        stateInput.funnelConcerns = {
          inspectionFindings: recovery.inspectionFindings ?? null,
          priorObjection: srDispoContext ?? recovery.dispoPrimaryObjection ?? null,
        };
      }
    }

    const input: TurnInput = {
      ghlContactId,
      inboundMessage: reengageInstruction(attempt),
      conversationState: stateInput,
      conversationHistory: history,
      phase, // same mission → same prompt + same tier rules (selectTier(phase, …))
    };

    const result = await runComposedBotTurn(input, { callClaude: deps.callClaude });
    modelTier = result.modelTier;
    // A re-engagement opener should always have a reply; if the safe-fallback ladder
    // produced none, drop to the template rather than send nothing.
    message = result.reply || templateOpener(phase, firstName);

    // Persist any model-authored state the opener surfaced (accumulates harmlessly).
    // The SIGNAL is deliberately ignored: this is a proactive nudge with no inbound
    // to interpret, so we never act on a terminal signal here (it emits null, §8/Part A).
    await applyModelStateDelta(ghlContactId, result.stateDelta, { currentPhase: phase });
  }

  // ── Send + record the outbound nudge ─────────────────────────────────────────
  await sendSms(ghlContactId, message);
  await appendMessage(threadId, "assistant", message);

  // ── Persist system fields — lastSignal NULL, tier (or null for template). ────
  // CRITICAL: heatLastInbound is NOT written. A re-engagement is OUTBOUND; only a
  // real homeowner inbound resets the cooldown clock (ARCHITECTURE §3). Touching it
  // here would keep a warmed-then-ghosted lead hot forever and re-apply pressure.
  const sysFields: Partial<SystemAuthoredFields> = {
    lastSignal: null,
    lastModelTier: modelTier,
  };
  await writeSystemFields(ghlContactId, sysFields, { currentPhase: phase });
}
