// Sprint 6 — prompt-cache verification + per-phase telemetry measurement.
//
//   npm run cache:verify
//
// Proves the Step 3 done-state and produces the Step 4 numbers in one live pass.
// For each of the six phases it:
//   1. assembles the prompt for TWO turns with DIFFERENT runtime, and asserts the
//      stable prefix (kernel+methodology+persona+mission) is BYTE-IDENTICAL across
//      them — nothing turn-specific leaked into the cached block;
//   2. makes TWO sequential LIVE calls through the real engine seam with that
//      prefix and reads the API usage:
//        - call 1 should WRITE the cache  (cache_creation_input_tokens > 0),
//        - call 2 should READ it          (cache_read_input_tokens > 0),
//      proving the breakpoint works (5-minute ephemeral cache);
//   3. records the real cached-prefix token count (= call-1 cache_creation, the
//      exact size the API cached), the uncached input tokens, and the output
//      tokens per call, for docs/bot-v2-telemetry.md.
//
// NOTE the per-model minimum cacheable prefix: Haiku 4.5 = 4096 tokens, Sonnet 4.6
// = 2048. A prefix below the model's minimum will SILENTLY not cache (no error,
// cache_creation stays 0) — this harness flags that explicitly.
//
// Requires ANTHROPIC_API_KEY. 12 small live calls (~cents). Prints a JSON summary.

import { assembleBotPromptParts } from "../src/lib/bot-v2/assembler";
import { liveClaudeCaller } from "../src/lib/bot-v2/claude-call";
import { selectTier } from "../src/lib/bot-v2/tier";
import { MODEL_BY_TIER, DEFAULT_MAX_TOKENS } from "../src/lib/bot-v2/config";
import { withStateDefaults } from "../src/lib/bot-v2/engine";
import type { ClaudeUsage, ConversationStateInput, TurnInput } from "../src/lib/bot-v2/types";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`); }
}
function section(t: string): void { console.log(`\n${"─".repeat(72)}\n  ${t}\n${"─".repeat(72)}`); }

// Per-model minimum cacheable prefix (tokens) — below this the API silently won't cache.
const MIN_CACHEABLE: Record<string, number> = {
  "claude-haiku-4-5-20251001": 4096,
  "claude-sonnet-4-6": 2048,
};

// A representative inbound + minimal phase-appropriate state per phase. The state
// only needs to be valid enough to assemble a realistic prompt; the SECOND turn
// varies the runtime (different inbound + history) to prove prefix stability.
interface PhaseCase {
  phase: string;
  state: ConversationStateInput;
  inboundA: string;
  inboundB: string;
}

const CASES: PhaseCase[] = [
  {
    phase: "nurture",
    state: { sourceType: "guide", sourceChannel: "rep_card", heatState: "cold" },
    inboundA: "thanks for the guide, just looking for now",
    inboundB: "honestly a couple shingles blew off in the last storm, is that something you'd see from the ground?",
  },
  {
    phase: "qualify",
    state: { sourceType: "inspection", consequenceSurfaced: false, gateProblem: false },
    inboundA: "yeah the ceiling stain in the back bedroom is getting bigger",
    inboundB: "my wife and I both noticed it, we'd want to deal with it before winter",
  },
  {
    phase: "book",
    state: { gateProblem: true, gateDecisionMaker: true, consequenceSurfaced: true, address: "123 Mesa Hills Dr, El Paso TX" },
    inboundA: "sure, mornings are better for me",
    inboundB: "let's do the Tuesday 9am slot then",
  },
  {
    phase: "revival",
    state: { daysSinceAppointment: 9, consequenceLikelySurfaced: true, primaryObjection: "wanted to think about it" },
    inboundA: "yeah we talked it over and just weren't sure it was the right time",
    inboundB: "the leak is honestly still there though, dripping again last night",
  },
  {
    phase: "reschedule",
    state: { rescheduleSubCase: "no_show", daysSinceAppointment: 3 },
    inboundA: "sorry I missed the appointment, something came up",
    inboundB: "can we try again later this week, maybe thursday",
  },
  {
    phase: "finance",
    state: { affordabilityIsReal: true, daysSinceAppointment: 5 },
    inboundA: "the financing didn't go through, my credit isn't great right now",
    inboundB: "my brother offered to cosign though, would that even help?",
  },
];

function buildInput(c: PhaseCase, inbound: string, history: { role: "lead" | "bot"; content: string }[]): TurnInput {
  return {
    ghlContactId: `__cacheverify_${c.phase}`,
    inboundMessage: inbound,
    conversationState: c.state,
    conversationHistory: history,
    phase: c.phase,
  };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[cache:verify] ANTHROPIC_API_KEY not set — this test makes real model calls. Aborting.");
    process.exit(2);
  }

  const now = Date.now();
  const summary: Record<string, unknown>[] = [];

  for (const c of CASES) {
    section(`Phase: ${c.phase}`);
    const state = withStateDefaults(c.state, c.phase);
    const tier = selectTier(c.phase, state, now).tier;
    const model = MODEL_BY_TIER[tier];

    // Two turns, DIFFERENT runtime (different inbound + history length).
    const inputA = buildInput(c, c.inboundA, []);
    const inputB = buildInput(c, c.inboundB, [
      { role: "lead", content: c.inboundA },
      { role: "bot", content: "Got it — appreciate you telling me." },
    ]);

    const partsA = await assembleBotPromptParts(inputA, state);
    const partsB = await assembleBotPromptParts(inputB, state);

    // (1) prefix byte-identical across turns; runtime differs.
    check(`${c.phase}: stable prefix is byte-identical across two different-runtime turns`, partsA.stablePrefix === partsB.stablePrefix);
    check(`${c.phase}: runtime tail DID differ (proves the varying content is outside the cached prefix)`, partsA.runtime !== partsB.runtime);

    // (2) two sequential live calls sharing the prefix → write then read.
    let usage1: ClaudeUsage | undefined;
    let usage2: ClaudeUsage | undefined;
    await liveClaudeCaller({
      systemPrompt: partsA.full, cachePrefix: partsA.stablePrefix, onUsage: (u) => { usage1 = u; },
      messages: [{ role: "user", content: c.inboundA }], model, maxTokens: DEFAULT_MAX_TOKENS,
    });
    await liveClaudeCaller({
      systemPrompt: partsB.full, cachePrefix: partsB.stablePrefix, onUsage: (u) => { usage2 = u; },
      messages: [{ role: "user", content: c.inboundB }], model, maxTokens: DEFAULT_MAX_TOKENS,
    });

    const c1Creation = usage1?.cache_creation_input_tokens ?? 0;
    const c1Read = usage1?.cache_read_input_tokens ?? 0;
    const c2Read = usage2?.cache_read_input_tokens ?? 0;
    const min = MIN_CACHEABLE[model] ?? 0;
    // The authoritative cached-prefix size is what the SECOND (always-warm) call
    // served from cache. (Deriving it from call-1 cache_creation under-reports
    // whenever a prior run within the 5-min TTL already warmed the prefix — then
    // call 1 READS most of it and writes only the delta.)
    const prefixTokens = Math.max(c2Read, c1Creation + c1Read);
    const cacheable = prefixTokens >= min;

    if (cacheable) {
      // Robust to prior-run warming: call 1 either wrote the prefix (cold) or read
      // it (a prior run warmed it within the TTL) — both prove it is in the cache.
      check(`${c.phase}: call 1 has the prefix in cache (creation>0 cold, or read>0 if pre-warmed)`, c1Creation > 0 || c1Read > 0, usage1);
      check(`${c.phase}: call 2 READ the cached prefix (cache_read_input_tokens >= prefix)`, c2Read >= min, usage2);
    } else {
      console.log(`  [FLAG] ${c.phase}: cached prefix ~${prefixTokens} tok is BELOW the ${model} minimum (${min}) — won't cache on this tier.`);
    }

    const row = {
      phase: c.phase,
      tier,
      model,
      prefixChars: partsA.stablePrefix.length,
      cachedPrefixTokens: prefixTokens,
      minCacheable: min,
      cacheable,
      call1: { input: usage1?.input_tokens ?? 0, cache_creation: c1Creation, cache_read: c1Read, output: usage1?.output_tokens ?? 0 },
      call2: { input: usage2?.input_tokens ?? 0, cache_creation: usage2?.cache_creation_input_tokens ?? 0, cache_read: c2Read, output: usage2?.output_tokens ?? 0 },
    };
    summary.push(row);
    console.log(`  → ${JSON.stringify(row)}`);
  }

  section("MEASUREMENT SUMMARY (paste into docs/bot-v2-telemetry.md)");
  console.log(JSON.stringify(summary, null, 2));

  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`[cache:verify] fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  process.exit(1);
});
