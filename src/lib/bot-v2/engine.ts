// New bot engine — runComposedBotTurn (sprint_0_harness.md §1).
//
// This is THE single entry point the harness calls now and the webhook routes
// will call later. Its SIGNATURE is stable. For Sprint 0:
//   - tier selection is REAL (see ./tier.ts)
//   - prompt assembly is a STUB (SPRINT 2 replaces it)
//   - parsing is a plain try/catch JSON.parse (SPRINT 3 replaces it with the
//     3-attempt repair ladder + graceful degradation)
// Later sprints fill the stubs in WITHOUT changing this signature.

import { DEFAULT_MAX_TOKENS, MODEL_BY_TIER } from "./config";
import { liveClaudeCaller, type ClaudeCaller } from "./claude-call";
import { selectTier } from "./tier";
import { assembleBotPromptParts } from "./assembler";
import { parseContract, buildRepairUserMessage, logEnumDrift } from "./contract-parse";
import { MODEL_AUTHORED_FIELDS } from "./field-authorship";
import type {
  BotContract,
  ClaudeUsage,
  ConversationStateInput,
  Phase,
  Signal,
  TurnInput,
  TurnResult,
} from "./types";

// MODEL_AUTHORED_FIELDS — the model-authored allowlist — now lives in the single
// authoritative ./field-authorship module (ARCHITECTURE §5/§7), shared with the
// DB write layer (lib/conversation) so the seam is defined in exactly one place.

// Returned when parsing fails (or the model is silent): a safe generic reply
// that changes nothing. A parse failure must NEVER emit a consequential signal
// (ARCHITECTURE §5).
const SAFE_FALLBACK_REPLY = "Thanks for the note — give me a moment and I'll get right back to you.";

export interface TurnDeps {
  /** Injected model caller. Defaults to the live Anthropic call. The harness
   *  injects a mock caller built from the fixture's mockResponse. */
  callClaude?: ClaudeCaller;
  /** Current time in ms, injectable for deterministic cooldown tests. */
  now?: number;
}

/** Fill omitted Conversation fields with sensible defaults (harness brief §3). */
export function withStateDefaults(
  partial: ConversationStateInput,
  phase: string,
): Required<Pick<ConversationStateInput, "heatState">> & ConversationStateInput {
  return {
    currentPhase: (partial.currentPhase ?? (phase as Phase)),
    phaseHistory: partial.phaseHistory ?? [],
    nepqPhase: partial.nepqPhase ?? null,
    motivation: partial.motivation ?? [],
    urgency: partial.urgency ?? null,
    consequenceSurfaced: partial.consequenceSurfaced ?? false,
    gateProblem: partial.gateProblem ?? false,
    gateDecisionMaker: partial.gateDecisionMaker ?? false,
    objectionsSurfaced: partial.objectionsSurfaced ?? [],
    primaryObjection: partial.primaryObjection ?? null,
    decisionMakers: partial.decisionMakers ?? [],
    timePrefs: partial.timePrefs ?? null,
    address: partial.address ?? null,
    selectedSlot: partial.selectedSlot ?? null,
    sourceType: partial.sourceType ?? null,
    sourceChannel: partial.sourceChannel ?? null,
    funnelConcerns: partial.funnelConcerns ?? null,
    repName: partial.repName ?? null,
    consequenceLikelySurfaced: partial.consequenceLikelySurfaced ?? null,
    affordabilityIsReal: partial.affordabilityIsReal ?? false,
    rescheduleSubCase: partial.rescheduleSubCase ?? null,
    daysSinceAppointment: partial.daysSinceAppointment ?? null,
    heatState: partial.heatState ?? "cold",
    heatLastInbound: partial.heatLastInbound ?? null,
    heatPeakReached: partial.heatPeakReached ?? false,
    summary: partial.summary ?? null,
    lastSignal: partial.lastSignal ?? null,
    lastModelTier: partial.lastModelTier ?? null,
    ghlContactId: partial.ghlContactId,
    leadId: partial.leadId ?? null,
  };
}

// SPRINT 2: the real composed-prompt assembler (kernel + methodology + persona +
// mission + runtime — ARCHITECTURE §4) now lives in ./assembler and replaces the
// Sprint 0 stub inside runComposedBotTurn below. runComposedBotTurn's signature
// is unchanged; only the prompt it sends changed.

function toApiMessages(input: TurnInput): { role: string; content: string }[] {
  // SPRINT 2: the full transcript now lives in the assembled system prompt's
  // runtime block (read-only context — ARCHITECTURE §4). To avoid feeding the
  // history twice, the API messages carry only the latest inbound as the single
  // user turn the model must answer. (Sprint 3 may revisit if a richer message
  // structure proves better for the live model.)
  return [{ role: "user", content: input.inboundMessage }];
}

function pickModelAuthored(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {};
  const src = state as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of MODEL_AUTHORED_FIELDS) {
    if (key in src) out[key] = src[key];
  }
  return out;
}

export async function runComposedBotTurn(
  input: TurnInput,
  deps: TurnDeps = {},
): Promise<TurnResult> {
  const callClaude = deps.callClaude ?? liveClaudeCaller;
  const now = deps.now ?? Date.now();

  const state = withStateDefaults(input.conversationState, input.phase);

  // ── REAL tier selection (ARCHITECTURE §3) ──
  const decision = selectTier(input.phase, state, now);
  const model = MODEL_BY_TIER[decision.tier];

  // ── REAL composed-prompt assembly (ARCHITECTURE §4 — Sprint 2) ──
  // Async since Sprint 4: all tier content flows through the loadPromptTier seam.
  // SPRINT 6: assemble as a prefix/runtime split so the model call can place a
  // prompt-cache breakpoint at the end of the stable prefix (Step 3). `stablePrefix`
  // is byte-identical across every turn within a phase; `assembledPrompt` (= full)
  // is what the harness prints and what fixtures assert against — unchanged.
  const { stablePrefix, full: assembledPrompt } = await assembleBotPromptParts(input, state);
  const baseMessages = toApiMessages(input);

  // SPRINT 6: capture usage from the LAST model call of the turn (attempt-1, or the
  // attempt-2 repair if it ran) for prompt-cache + cost telemetry (Step 4). Both
  // calls send the SAME cached prefix, so attempt-2 reads the cache attempt-1 wrote.
  let lastUsage: ClaudeUsage | undefined;
  const onUsage = (u: ClaudeUsage) => {
    lastUsage = u;
  };

  // ── The full 3-attempt repair ladder (ARCHITECTURE §5 — Sprint 3) ──────────
  //
  // This is the production-readiness keystone, shared by BOTH personas (the
  // contract shape is shared). The model call uses the turn's tier; a Haiku turn
  // repairs with Haiku, a Sonnet turn with Sonnet (keep it cheap — §5).
  //
  //   Attempt 1 — parse.
  //   Attempt 2 — repair: feed the malformed output back with the exact shape.
  //   Attempt 3 — safe fallback: a generic reply + signal.type:null. A parse
  //               failure must NEVER emit a consequential signal.
  let rawModelOutput = "";
  let parsedContract: BotContract | null = null;
  let parseAttempts = 1;
  let error: string | undefined;

  // Attempt 1 — the primary model call + strict parse.
  try {
    rawModelOutput = await callClaude({
      systemPrompt: assembledPrompt,
      cachePrefix: stablePrefix,
      onUsage,
      messages: baseMessages,
      model,
      maxTokens: DEFAULT_MAX_TOKENS,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (!error) {
    const first = parseContract(rawModelOutput);
    if (first.ok) {
      parsedContract = first.contract;
    } else {
      // Attempt 2 — repair. Same tier, malformed output fed back with the shape.
      parseAttempts = 2;
      console.warn(
        `[bot-v2] repair-ladder ATTEMPT 2 (repair) — contact=${input.ghlContactId} ` +
          `phase=${input.phase} tier=${decision.tier} reason=${first.reason}`,
      );
      let repairRaw = "";
      try {
        repairRaw = await callClaude({
          systemPrompt: assembledPrompt,
          cachePrefix: stablePrefix, // same prefix → attempt-2 reads the cache attempt-1 wrote
          onUsage,
          messages: [
            ...baseMessages,
            { role: "assistant", content: rawModelOutput },
            { role: "user", content: buildRepairUserMessage(rawModelOutput, first.reason) },
          ],
          model,
          maxTokens: DEFAULT_MAX_TOKENS,
        });
      } catch (e) {
        console.warn(
          `[bot-v2] repair-ladder repair call threw — contact=${input.ghlContactId}: ` +
            `${e instanceof Error ? e.message : String(e)}`,
        );
      }
      const second = repairRaw
        ? parseContract(repairRaw)
        : ({ ok: false, reason: "repair_call_failed" } as const);
      if (second.ok) {
        parsedContract = second.contract;
        rawModelOutput = repairRaw; // surface the repaired output for inspection
      } else {
        // Attempt 3 — safe fallback. NEVER a consequential signal (§5).
        parseAttempts = 3;
        if (repairRaw) rawModelOutput = repairRaw;
        console.warn(
          `[bot-v2] repair-ladder ATTEMPT 3 (safe fallback) — contact=${input.ghlContactId} ` +
            `phase=${input.phase} tier=${decision.tier} reason=${second.reason} — ` +
            `emitting safe reply with signal.type=null (no consequential signal)`,
        );
        parsedContract = null;
      }
    }
  }

  // Enum-drift telemetry: log (don't fix) any near-miss enum that survived parse,
  // so a silently-wrong OPTIONAL enum is still VISIBLE in logs/harness output.
  logEnumDrift(parsedContract);

  // ── Derive safe outputs ──
  // On any parse failure (or model-call error), parsedContract is null and we emit
  // the SAFE fallback: a generic reply and signal.type:null. This is the absolute
  // rule — a fallback never carries a consequential signal.
  const reply =
    parsedContract && typeof parsedContract.reply === "string"
      ? parsedContract.reply
      : SAFE_FALLBACK_REPLY;
  const signal: Signal = parsedContract
    ? parsedContract.signal
    : { type: null, confidence: null, reason: null };
  const stateDelta = parsedContract ? pickModelAuthored(parsedContract.state) : {};

  // SPRINT 6: prompt-cache + cost telemetry (Step 4). One structured line per turn
  // with the real usage numbers — prefix size, uncached/cache-write/cache-read input
  // tokens, output tokens — so cache effectiveness and per-phase cost are measurable
  // once live volume arrives. Emitted only when the live caller reported usage.
  if (lastUsage) {
    console.info(
      `[bot-v2][telemetry] phase=${input.phase} tier=${decision.tier} model=${model} ` +
        `attempts=${parseAttempts} prefixChars=${stablePrefix.length} ` +
        `input_tokens=${lastUsage.input_tokens ?? 0} ` +
        `cache_creation_input_tokens=${lastUsage.cache_creation_input_tokens ?? 0} ` +
        `cache_read_input_tokens=${lastUsage.cache_read_input_tokens ?? 0} ` +
        `output_tokens=${lastUsage.output_tokens ?? 0} ` +
        `signal=${signal.type ?? "null"}`,
    );
  }

  return {
    assembledPrompt,
    modelTier: decision.tier,
    tierReason: decision.reason,
    cooledDown: decision.cooledDown,
    rawModelOutput,
    parsedContract,
    parseAttempts,
    reply,
    signal,
    stateDelta,
    error,
    usage: lastUsage,
    stablePrefixChars: stablePrefix.length,
  };
}

/**
 * Thread the turn's outcome into the running conversation state for the NEXT
 * turn (used by the harness for multi-turn fixtures; the real orchestrator does
 * the equivalent in Sprint 1+).
 *
 * - MODEL-authored fields come from `result.stateDelta`.
 * - SYSTEM-authored effects are applied here by the orchestrator, NOT the model:
 *   the escalation signals WARMING/WOBBLING flip heat state without changing
 *   phase or touching GHL (ARCHITECTURE §6). An inbound from the lead resets the
 *   cooldown clock (ARCHITECTURE §3).
 */
export function threadStateForward(
  prev: ConversationStateInput,
  result: TurnResult,
  inboundTimestamp: string,
): ConversationStateInput {
  const next: ConversationStateInput = { ...prev, ...result.stateDelta };

  // System-authored meta.
  next.lastSignal = result.signal.type ?? null;
  next.lastModelTier = result.modelTier;
  // Only an inbound from the lead resets the cooldown clock.
  next.heatLastInbound = inboundTimestamp;

  if (result.signal.type === "WARMING") {
    next.heatState = "warming";
    next.heatPeakReached = true; // ever warmed — never resets (ARCHITECTURE §3)
  }
  // Note: cooldown (warming → cold) is evaluated lazily in selectTier; we do not
  // persist that flip here. Real heatState persistence is Sprint 1's job.

  return next;
}
