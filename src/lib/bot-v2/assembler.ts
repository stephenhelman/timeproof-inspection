// New bot engine — the composed-prompt ASSEMBLER (ARCHITECTURE §4, Sprint 2).
//
// Composes a system prompt by deterministic concatenation of authored prompt
// tiers plus a per-turn runtime block, in the fixed order from ARCHITECTURE §4:
//
//   [all kernel files, numeric order]
//   + [active methodology files, numeric order]
//   + [persona file for the mission's owner]
//   + [the specific mission file]
//   + [runtime: lead_context + conversation_state + conversation_history]
//
// The kernel+methodology prefix is IDENTICAL across every mission, so it is
// emitted as one contiguous, stable block (prompt-cacheable later — we don't
// wire caching now, but we keep variable content out of the prefix).
//
// This REPLACES the Sprint 0 stub inside runComposedBotTurn. The engine's
// signature is unchanged; only the prompt it sends changes.

import type { ConversationStateInput, Phase, TurnInput } from "./types";
import { PROMPT_TIERS } from "./prompts.generated";

// Prompt content is BUNDLED, not read from disk (SPRINT 6 Step 2). The authored
// .md tiers under src/lib/bot-v2/prompts/ are compiled into prompts.generated.ts
// by scripts/compile-prompts.mjs (run via `npm run prompts:compile`, wired into
// `prebuild`). This makes the content ship with any bundle — including a fully
// bundled serverless deploy that would not copy loose markdown read at runtime —
// and removes all runtime disk I/O from the prompt path.
//
// Editing a prompt: change the .md, then `npm run prompts:compile` to regenerate
// the module (the harness reads the generated module too, so this keeps it fresh
// outside of `next build`).

type PersonaOwner = "alex" | "jordan";

// ─── Tier paths (the ordered composition manifest) ───────────────────────────
//
// SPRINT 4 Step 0: the tiers are now an EXPLICIT ordered manifest of logical
// tier-paths (no ".md", relative to the content root) rather than a directory
// listing. Two reasons: (1) every piece of prompt content now flows through the
// single `loadPromptTier` seam (no `readdirSync`/disk listing in the assembler);
// (2) a future CMS has no directory to list — it fetches content by a logical
// key, which is exactly what a tier-path is. Order here IS the §4 composition
// order (kernel numeric, then methodology numeric).
const KERNEL_TIERS = [
  "kernel/00_identity",
  "kernel/01_tone_sms",
  "kernel/02_honesty_constraints",
  "kernel/03_objection_taxonomy",
  "kernel/04_signals",
  "kernel/05_json_contract",
  "kernel/06_override_registry",
  "kernel/07_subcase_taxonomy",
] as const;

// The active methodology. Today there is one (NEPQ); a future tenant swaps this
// list wholesale (ARCHITECTURE §4 kernel/methodology seam).
const METHODOLOGY_TIERS = [
  "methodology/nepq/10_nepq_core",
  "methodology/nepq/11_nepq_objection_handling",
  "methodology/nepq/12_nepq_tone_overlay",
  "methodology/nepq/13_nepq_subcase_openers",
] as const;

// phase → which persona owns it + the specific mission tier-path. ARCHITECTURE
// §2/§4: Alex owns nurture/qualify/book; Jordan owns revival/reschedule/finance.
const PHASE_MAP: Record<Exclude<Phase, "silent">, { persona: PersonaOwner; missionTier: string }> = {
  nurture: { persona: "alex", missionTier: "missions/alex/nurture/21_nurture" },
  qualify: { persona: "alex", missionTier: "missions/alex/qualify/22_qualify" },
  book: { persona: "alex", missionTier: "missions/alex/book/23_book" },
  revival: { persona: "jordan", missionTier: "missions/jordan/revival/31_revival" },
  reschedule: { persona: "jordan", missionTier: "missions/jordan/reschedule/33_reschedule" },
  finance: { persona: "jordan", missionTier: "missions/jordan/finance/32_finance" },
};

const PERSONA_TIER: Record<PersonaOwner, string> = {
  alex: "missions/alex/20_alex_persona",
  jordan: "missions/jordan/30_jordan_persona",
};

// ─── loadPromptTier — THE single prompt-content source (SPRINT 4 Step 0) ─────
//
// Every tier of authored content (kernel, methodology, persona, mission) loads
// through this ONE function. The assembler never reads disk directly — this is
// the swappable seam. Today it reads from the bundled, build-time-compiled
// PROMPT_TIERS module (no runtime disk I/O); later a CMS fetch replaces only this
// function's body.
//
// FUTURE: CMS-backed per-tenant content swaps in here — replace the PROMPT_TIERS
// lookup with a per-tenant fetch keyed by `tierPath`; nothing else in the
// assembler changes.
//
// Cached by tier-path: content is static for a process run, so each tier is
// resolved once.
const tierCache = new Map<string, string>();

export async function loadPromptTier(tierPath: string): Promise<string> {
  const cached = tierCache.get(tierPath);
  if (cached !== undefined) return cached;
  // FUTURE: CMS-backed per-tenant content swaps in here.
  const content = PROMPT_TIERS[tierPath];
  if (content === undefined) {
    throw new Error(`[bot-v2] unknown prompt tier "${tierPath}" — run \`npm run prompts:compile\` after adding it`);
  }
  tierCache.set(tierPath, content);
  return content;
}

// ─── The stable authored prefix (kernel + methodology) ──────────────────────
//
// Identical for every mission. Kept as one contiguous block; no variable/runtime
// content is interleaved here (ARCHITECTURE §4 — sets up prompt caching later).

let cachedAuthoredPrefix: string | null = null;

async function buildAuthoredPrefix(): Promise<string> {
  if (cachedAuthoredPrefix !== null) return cachedAuthoredPrefix;
  const tiers = await Promise.all(
    [...KERNEL_TIERS, ...METHODOLOGY_TIERS].map((t) => loadPromptTier(t)),
  );
  cachedAuthoredPrefix = tiers.join("\n\n");
  return cachedAuthoredPrefix;
}

// ─── The runtime block (per-turn, read-only context) ────────────────────────
//
// Injects the Conversation state + transcript as read-only context the model
// must not echo. We separate SYSTEM-authored lead context from the MODEL-authored
// learned state so the model sees the same authorship seam the contract enforces.

function jsonOrNull(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function buildRuntimeBlock(input: TurnInput, state: ConversationStateInput): string {
  // SYSTEM-authored context the model READS but never writes (ARCHITECTURE §5/§7).
  const leadContext = {
    currentPhase: state.currentPhase ?? input.phase,
    sourceType: state.sourceType ?? null,
    sourceChannel: state.sourceChannel ?? null,
    repName: state.repName ?? null,
    funnelConcerns: state.funnelConcerns ?? null,
    affordabilityIsReal: state.affordabilityIsReal ?? false,
    rescheduleSubCase: state.rescheduleSubCase ?? null,
    consequenceLikelySurfaced: state.consequenceLikelySurfaced ?? null,
    daysSinceAppointment: state.daysSinceAppointment ?? null,
    heatState: state.heatState ?? "cold",
    heatPeakReached: state.heatPeakReached ?? false,
  };

  // MODEL-authored learned state, carried across turns. The model may update
  // these via the contract's `state` block; here they are prior values, read-only.
  const conversationState = {
    nepqPhase: state.nepqPhase ?? null,
    consequenceSurfaced: state.consequenceSurfaced ?? false,
    gateProblem: state.gateProblem ?? false,
    gateDecisionMaker: state.gateDecisionMaker ?? false,
    motivation: state.motivation ?? [],
    urgency: state.urgency ?? null,
    objectionsSurfaced: state.objectionsSurfaced ?? [],
    primaryObjection: state.primaryObjection ?? null,
    decisionMakers: state.decisionMakers ?? [],
    timePrefs: state.timePrefs ?? null,
    address: state.address ?? null,
    selectedSlot: state.selectedSlot ?? null,
    summary: state.summary ?? null,
  };

  const history =
    input.conversationHistory.length > 0
      ? input.conversationHistory.map((m) => `${m.role === "bot" ? "YOU" : "HOMEOWNER"}: ${m.content}`).join("\n")
      : "(no prior messages)";

  // ── available_slots (SPRINT 4 Step 3 — slot pre-fetch-and-inject) ──────────
  // On BOOK turns the CODE (not the model) pre-fetches getAvailableSlots and
  // injects the result here. The Book mission references `available_slots`. These
  // are REAL, current, already-validated times — the model offers ONLY these and
  // never invents one. Rendered only when the caller supplied the field (book +
  // Jordan rebooking turns); absent/empty means "not at the slot-offering step
  // yet" (the mission handles that). Each slot carries a combined `slot` string
  // ("YYYY-MM-DD HH:MM") so a BOOKED/REBOOKED turn can echo the EXACT chosen slot
  // into state.selectedSlot — the contract-clean carrier for the chosen slot
  // (ARCHITECTURE §5; signal.reason is prose-only, never a data carrier).
  const slotsBlock: string[] =
    input.availableSlots !== undefined
      ? [
          "",
          "--- available_slots (system-fetched: REAL, current, already-validated; offer ONLY these — never invent a time) ---",
          jsonOrNull(
            input.availableSlots.map((s) => ({
              slot: `${s.date} ${s.time}`,
              label: s.label,
              date: s.date,
              time: s.time,
            })),
          ),
          "(When the homeowner picks one and you emit BOOKED or REBOOKED, copy that slot's exact " +
            '`slot` value ("YYYY-MM-DD HH:MM") into state.selectedSlot so the system can confirm the ' +
            "booking. Do NOT put it in signal.reason.)",
        ]
      : [];

  return [
    "═══════════════════════════════════════════════════════════════════",
    "RUNTIME CONTEXT — READ-ONLY. Do NOT echo any of this back to the homeowner.",
    "This is what the system knows about this contact. The lead_context block is",
    "SYSTEM-authored: never emit those fields. Use it to inform your reply only.",
    "═══════════════════════════════════════════════════════════════════",
    "",
    "--- lead_context (system-authored, read-only) ---",
    jsonOrNull(leadContext),
    "",
    "--- conversation_state (your prior learned state, read-only) ---",
    jsonOrNull(conversationState),
    ...slotsBlock,
    "",
    "--- conversation_history (read-only transcript; latest inbound is the homeowner's message you must answer) ---",
    history,
  ].join("\n");
}

// ─── The assembler ──────────────────────────────────────────────────────────

// SPRINT 6: the prompt split into its STABLE prefix (cacheable) and FRESH runtime
// tail. `full` is the byte-for-byte concatenation `stablePrefix + "\n\n" + runtime`
// — identical to the single string assembleBotPrompt has always returned, so the
// harness print + fixtures' assembledPromptIncludes checks are unchanged.
export interface AssembledPromptParts {
  /** kernel + methodology + persona + mission — IDENTICAL across every turn within
   *  a phase (no runtime/variable content). This is the prompt-cache breakpoint
   *  boundary (Step 3): everything here is cached, the runtime tail is fresh. */
  stablePrefix: string;
  /** lead_context + conversation_state + history + available_slots — per turn. */
  runtime: string;
  /** stablePrefix + "\n\n" + runtime — the complete system prompt. */
  full: string;
}

/**
 * Compose the system prompt for a turn, returning the stable-prefix / runtime
 * split (ARCHITECTURE §4). The caller places the prompt-cache breakpoint at the
 * end of `stablePrefix` (Step 3). Use `full` wherever the whole prompt is needed.
 */
export async function assembleBotPromptParts(
  input: TurnInput,
  state: ConversationStateInput,
): Promise<AssembledPromptParts> {
  const phase = input.phase as Phase;
  const authoredPrefix = await buildAuthoredPrefix();

  // silent / unknown phases have no persona or mission overlay — kernel +
  // methodology + runtime only. (No live mission runs on silent.)
  const mapping = PHASE_MAP[phase as Exclude<Phase, "silent">];
  const overlay = mapping
    ? await Promise.all([loadPromptTier(PERSONA_TIER[mapping.persona]), loadPromptTier(mapping.missionTier)])
    : [];

  const stablePrefix = [authoredPrefix, ...overlay].join("\n\n");
  const runtime = buildRuntimeBlock(input, state);

  return { stablePrefix, runtime, full: [stablePrefix, runtime].join("\n\n") };
}

/**
 * Compose the full system prompt for a turn, in the fixed ARCHITECTURE §4 order.
 * The output is reproducible and printable top-to-bottom (the harness prints it).
 */
export async function assembleBotPrompt(
  input: TurnInput,
  state: ConversationStateInput,
): Promise<string> {
  return (await assembleBotPromptParts(input, state)).full;
}
