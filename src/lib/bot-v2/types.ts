// New bot engine — shared types for the composed-prompt turn engine.
//
// This is the stable seam from sprint_0_ARCHITECTURE.md. The harness drives it
// now with stubbed internals; later sprints fill the internals in WITHOUT
// changing these shapes. See sprint_0_harness.md §1.

// ─── Phases / tiers / signals ──────────────────────────────────────────────

export type Phase =
  | "nurture"
  | "qualify"
  | "book"
  | "revival"
  | "reschedule"
  | "finance"
  | "silent";

export type ModelTier = "haiku" | "sonnet";

// The full signal set (ARCHITECTURE §6). `null` is the residual "continue".
export type SignalType =
  | "QUALIFIED"
  | "BOOKED"
  | "REBOOKED"
  | "NOT_INTERESTED"
  | "ESCALATE"
  | "STALL"
  | "SOFT_CLOSE"
  | "WARMING"
  | "WOBBLING"
  | null;

export interface Signal {
  type: SignalType;
  confidence: "solid" | "soft" | null;
  reason: string | null;
}

// ─── The JSON contract the model returns (ARCHITECTURE §5) ──────────────────

export interface ObjectionEntry {
  family: "price" | "time" | "trust" | "authority" | "need" | "grievance" | "competitor";
  surfaceForm: string;
  wasReal: boolean | null;
  resolved: boolean;
  turnRef: number | null;
}

export interface DecisionMakerEntry {
  role: string;
  present: boolean | null;
  sharesConcern: boolean | null;
}

export interface ContractSummary {
  situation: string | null;
  problem: string | null;
  consequence: string | null;
  openObjection: string | null;
  nextStep: string | null;
}

// The MODEL-AUTHORED state subset only. The model never emits system-authored
// fields (ARCHITECTURE §5 / §7). See MODEL_AUTHORED_FIELDS in engine.ts — the
// write layer drops anything outside this set, which is the structural guarantee
// that replaces the old "preserve and enrich, never overwrite" prompt fragility.
export interface ContractState {
  nepqPhase?: "connection" | "situation" | "problem" | "consequence" | "commitment" | null;
  consequenceSurfaced?: boolean;
  gateProblem?: boolean;
  gateDecisionMaker?: boolean;
  motivation?: string[];
  urgency?: "none" | "low" | "medium" | "high" | null;
  objectionsSurfaced?: ObjectionEntry[];
  primaryObjection?: string | null;
  decisionMakers?: DecisionMakerEntry[];
  timePrefs?: { days: string[]; windows: string[] } | null;
  address?: string | null;
  // selectedSlot — the appointment slot the homeowner picked, emitted by Book on
  // BOOKED and by Jordan on REBOOKED. The canonical home for the chosen slot
  // (ARCHITECTURE §5 — NOT signal.reason, which is prose-only). Handed to the
  // existing confirm path.
  selectedSlot?: string | null;
  summary?: ContractSummary | null;
}

export interface BotContract {
  reply: string;
  signal: Signal;
  state: ContractState;
}

// ─── Conversation state the engine reads (mirrors Conversation model §7) ─────
//
// In the harness this comes from a fixture. In production (Sprint 1+) it is
// loaded from the Conversation Prisma model. Every field is optional here so
// fixtures stay short; withStateDefaults() backfills sensible defaults.
//
// SPRINT 1: reconciled field-for-field with the real `Conversation` Prisma model
// — the Prisma model is the source of truth. Any future field added to the model
// is added here too (same name/shape).
export interface ConversationStateInput {
  ghlContactId?: string;
  leadId?: string | null;

  // ── ROUTING / PHASE (SYSTEM-authored) ──
  currentPhase?: Phase;
  phaseHistory?: { phase: string; enteredAt: string; exitSignal: string | null }[];

  // ── NEPQ STATE (MODEL-authored) ──
  nepqPhase?: string | null;
  motivation?: string[];
  urgency?: string | null;
  consequenceSurfaced?: boolean;

  // ── GATES (MODEL-authored) ──
  gateProblem?: boolean;
  gateDecisionMaker?: boolean;

  // ── OBJECTIONS (MODEL-authored) ──
  objectionsSurfaced?: ObjectionEntry[];
  primaryObjection?: string | null;

  // ── DECISION MAKERS / LOGISTICS (MODEL-authored) ──
  decisionMakers?: DecisionMakerEntry[];
  timePrefs?: { days: string[]; windows: string[] } | null;
  address?: string | null;
  selectedSlot?: string | null;

  // ── SOURCE (SYSTEM-authored) ──
  sourceType?: string | null;
  sourceChannel?: string | null;
  funnelConcerns?: unknown[] | Record<string, unknown> | null; // Json? in the model — array or object
  repName?: string | null;

  // ── RECOVERY CONTEXT (SYSTEM-authored) ──
  consequenceLikelySurfaced?: boolean | null;
  affordabilityIsReal?: boolean;
  rescheduleSubCase?: string | null;
  daysSinceAppointment?: number | null;

  // ── HEAT (SYSTEM-authored — tier selection) ──
  heatState?: "cold" | "warming";
  heatLastInbound?: string | null; // ISO timestamp of lead's last INBOUND
  heatPeakReached?: boolean;

  // ── BOOKING / ZIP (SYSTEM-authored — Sprint 9 timed-stage hygiene) ──
  bookingPendingAttempts?: number; // cumulative unanswered booking nudges (Part B)
  reengageAttempts?: number;       // cumulative re-engagement nudges (addendum)
  zipWasHeld?: boolean;            // expansion-zone lead held + cleared (Part G)

  // ── HANDOFF SUMMARY (MODEL-authored) ──
  summary?: ContractSummary | null;

  // ── META ──
  lastSignal?: string | null;
  lastModelTier?: string | null;
}

// ─── The engine's I/O (sprint_0_harness.md §1) ──────────────────────────────

export interface TurnInput {
  ghlContactId: string;
  inboundMessage: string;
  conversationState: ConversationStateInput;
  conversationHistory: { role: "lead" | "bot"; content: string; timestamp?: string }[];
  phase: string; // nurture|qualify|book|revival|reschedule|finance

  // SPRINT 4 — slot pre-fetch-and-inject (book only). The book handler calls the
  // existing getAvailableSlots and passes the result here; the assembler injects
  // it into the runtime block as `available_slots`. Undefined on non-book turns
  // (and on book turns before an address is collected) — the Book mission treats
  // absent/empty as "not at the slot-offering step yet".
  availableSlots?: { date: string; time: string; label: string }[];
}

// SPRINT 6: Anthropic usage fields, captured per model call for prompt-cache +
// cost telemetry (Step 3/4). cache_creation_input_tokens = tokens WRITTEN to the
// cache this call (~1.25x input price); cache_read_input_tokens = tokens SERVED
// from cache (~0.1x); input_tokens = the uncached remainder (full price). The
// full prompt size = input_tokens + cache_creation + cache_read.
export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface TurnResult {
  assembledPrompt: string; // the full composed system prompt (for inspection)
  modelTier: ModelTier; // which tier was selected
  tierReason: string; // why (printed by the harness)
  cooledDown: boolean; // SPRINT 3: nurture was warming but aged past COOLDOWN_WINDOW → ran cold this turn (lazy cooldown). The live orchestrator persists heatState='cold' when this is true (ARCHITECTURE §3).
  rawModelOutput: string; // exactly what the model returned (pre-parse)
  parsedContract: BotContract | null; // parsed JSON contract, or null on parse failure
  parseAttempts: number; // how many repair-ladder attempts were used
  reply: string; // the safe final reply to send
  signal: Signal;
  stateDelta: Record<string, unknown>; // model-authored fields to persist (NOT system fields)
  error?: string;

  // SPRINT 6: Anthropic usage from the LAST model call of the turn (attempt-1, or
  // attempt-2 if the ladder repaired). Undefined in mock mode. Drives the prompt-
  // cache + cost telemetry (docs/bot-v2-telemetry.md).
  usage?: ClaudeUsage;
  // SPRINT 6: byte length of the cached stable prefix for this turn (kernel +
  // methodology + persona + mission). Lets telemetry correlate prefix size with
  // measured cache_creation/read tokens per phase without re-assembling.
  stablePrefixChars?: number;
}
