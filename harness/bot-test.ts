// Bot test harness CLI (sprint_0_harness.md §4).
//
// Replays a fixture turn (or a multi-turn arc) through the REAL engine seam
// (runComposedBotTurn) with the Claude call mocked by default, and pretty-prints
// the assembled prompt, raw model output, parsed contract, and final result.
//
//   npm run bot:test fixtures/nurture-cold-opener.json
//   npm run bot:test fixtures/nurture-warming.json
//   npm run bot:test fixtures/qualify-gates.json -- --live   # opt-in real call
//
// Mock mode is the default: no API key, no network, instant + deterministic.
// `--live` calls the real Anthropic path with the (stubbed) assembled prompt.

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  runComposedBotTurn,
  threadStateForward,
  withStateDefaults,
} from "../src/lib/bot-v2/engine";
import { liveClaudeCaller, mockClaudeSequenceCaller } from "../src/lib/bot-v2/claude-call";
import { logEnumDrift } from "../src/lib/bot-v2/contract-parse";
import type {
  ConversationStateInput,
  TurnInput,
  TurnResult,
} from "../src/lib/bot-v2/types";

// ─── Fixture shape ──────────────────────────────────────────────────────────

interface ExpectBlock {
  tierSelected?: "haiku" | "sonnet";
  signalType?: string | null;
  parseFailed?: boolean;
  // SPRINT 3: how many repair-ladder attempts the turn used (1=clean parse,
  // 2=attempt-2 repair succeeded, 3=safe fallback). Contract/model-output
  // dependent → enforced in mock mode only.
  parseAttempts?: number;
  // SPRINT 4: substrings that MUST appear in the assembled prompt. Depends only on
  // INPUT (the injected available_slots), not on model output → enforced in BOTH
  // modes. Used to prove slot pre-fetch-and-inject lands the slots in the prompt.
  assembledPromptIncludes?: string[];
  // When true, the WHOLE block is enforced only in mock mode (skipped/eyeballed
  // in live). Individual contract-dependent checks (signalType, parseFailed) are
  // already mock-only by classification regardless of this flag; tierSelected
  // depends only on input state and runs in both modes unless this is set.
  mockOnly?: boolean;
}

interface FixtureTurn {
  inboundMessage: string;
  mockResponse: string;
  // SPRINT 3: the attempt-2 response. When present the mock caller returns
  // `mockResponse` on attempt 1 and `mockRepairResponse` on the repair attempt,
  // so a fixture can prove the ladder repairs (vs falls back) deterministically.
  mockRepairResponse?: string;
  // SPRINT 4: slots injected into this turn's runtime context (book only).
  availableSlots?: { date: string; time: string; label: string }[];
  expect?: ExpectBlock;
}

interface Fixture {
  name: string;
  phase: string;
  ghlContactId: string;
  conversationState?: ConversationStateInput;
  conversationHistory?: { role: "lead" | "bot"; content: string; timestamp?: string }[];
  now?: string; // ISO — pins "now" for deterministic cooldown tests
  // Single-turn:
  inboundMessage?: string;
  mockResponse?: string;
  mockRepairResponse?: string;
  availableSlots?: { date: string; time: string; label: string }[];
  expect?: ExpectBlock;
  // Multi-turn:
  turns?: FixtureTurn[];
}

// ─── Pretty-printing ─────────────────────────────────────────────────────────

const HR = "━".repeat(78);
const hr = "─".repeat(78);

function section(title: string): void {
  console.log(`\n${hr}\n  ${title}\n${hr}`);
}

function printTurnResult(result: TurnResult): void {
  section("TIER SELECTED");
  console.log(`  ${result.modelTier.toUpperCase()}   (${result.tierReason})`);

  section("ASSEMBLED PROMPT");
  console.log(result.assembledPrompt);

  section("RAW MODEL OUTPUT");
  console.log(result.error ? `  [model call error] ${result.error}` : result.rawModelOutput);

  section("PARSED CONTRACT");
  if (result.parsedContract) {
    console.log(JSON.stringify(result.parsedContract, null, 2));
  } else {
    console.log(`  PARSE FAILURE (after ${result.parseAttempts} attempt(s)) — emitting safe fallback`);
  }

  section("FINAL RESULT");
  console.log(`  reply:        ${JSON.stringify(result.reply)}`);
  console.log(`  signal:       ${JSON.stringify(result.signal)}`);
  console.log(`  stateDelta:   ${JSON.stringify(result.stateDelta)}`);
  console.log(`  parseAttempts:${result.parseAttempts}   cooledDown:${result.cooledDown}`);
  if (result.error) console.log(`  error:        ${result.error}`);
}

/**
 * Mode-aware assertions (Sprint 2 Step 0).
 *
 * - MOCK mode: every assertion is ENFORCED (deterministic — they test engine
 *   logic against a known model output).
 * - LIVE mode: live runs are for eyeballing real model output, so
 *   CONTRACT-DEPENDENT assertions (signalType, parseFailed) are NOT enforced —
 *   they're printed as [eyeball] notes and never fail the run. Tier-selection
 *   depends only on INPUT state (not on model output), so it STILL runs in live —
 *   unless the block opts out with `mockOnly: true`.
 *
 * Returns true if all ENFORCED assertions passed (or there were none).
 */
function checkExpect(expect: ExpectBlock | undefined, result: TurnResult, live: boolean): boolean {
  if (!expect) return true;
  section("ASSERTIONS");
  let allPass = true;

  // An ENFORCED check fails the run; an EYEBALL check only prints.
  const check = (label: string, actual: unknown, expected: unknown, enforced: boolean) => {
    const pass = actual === expected;
    if (enforced) {
      allPass = allPass && pass;
      console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    } else {
      console.log(`  [eyeball${pass ? " ✓" : " ✗"}] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)} (live: not enforced)`);
    }
  };

  // tierSelected: input-only → enforced in both modes, unless the block is mockOnly.
  if (expect.tierSelected !== undefined)
    check("tierSelected", result.modelTier, expect.tierSelected, !(live && expect.mockOnly));
  // signalType / parseFailed / parseAttempts: contract-dependent → mock mode only.
  if (expect.signalType !== undefined)
    check("signalType", result.signal.type, expect.signalType, !live);
  if (expect.parseFailed !== undefined)
    check("parseFailed", result.parsedContract === null, expect.parseFailed, !live);
  if (expect.parseAttempts !== undefined)
    check("parseAttempts", result.parseAttempts, expect.parseAttempts, !live);
  // assembledPromptIncludes: input-only (the injected slots) → enforced in BOTH modes.
  if (expect.assembledPromptIncludes !== undefined) {
    for (const needle of expect.assembledPromptIncludes) {
      check(`assembledPrompt includes ${JSON.stringify(needle)}`, result.assembledPrompt.includes(needle), true, true);
    }
  }

  return allPass;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const fixturePath = args.find((a) => !a.startsWith("--"));

  if (!fixturePath) {
    console.error("Usage: npm run bot:test <fixture-path> [-- --live]");
    process.exit(2);
  }

  const absPath = resolvePath(process.cwd(), fixturePath);
  let fixture: Fixture;
  try {
    fixture = JSON.parse(readFileSync(absPath, "utf8")) as Fixture;
  } catch (e) {
    console.error(`[harness] could not load fixture ${absPath}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  const now = fixture.now ? Date.parse(fixture.now) : Date.now();
  if (Number.isNaN(now)) {
    console.error(`[harness] invalid fixture.now: ${fixture.now}`);
    process.exit(1);
  }
  const nowIso = new Date(now).toISOString();

  console.log(HR);
  console.log(`  FIXTURE: ${fixture.name}   (phase=${fixture.phase}, mode=${live ? "LIVE" : "MOCK"})`);
  console.log(HR);

  const turns: FixtureTurn[] = fixture.turns
    ? fixture.turns
    : [{ inboundMessage: fixture.inboundMessage ?? "", mockResponse: fixture.mockResponse ?? "", mockRepairResponse: fixture.mockRepairResponse, availableSlots: fixture.availableSlots, expect: fixture.expect }];

  // Running state threaded across turns. Starts from the fixture's state.
  let runningState: ConversationStateInput = withStateDefaults(
    fixture.conversationState ?? {},
    fixture.phase,
  );
  let history = fixture.conversationHistory ? [...fixture.conversationHistory] : [];

  let allAssertionsPass = true;
  const multi = Boolean(fixture.turns);

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (multi) {
      console.log(`\n${HR}\n  TURN ${i + 1} / ${turns.length}   inbound: ${JSON.stringify(turn.inboundMessage)}\n${HR}`);
    }

    const input: TurnInput = {
      ghlContactId: fixture.ghlContactId,
      inboundMessage: turn.inboundMessage,
      conversationState: runningState,
      conversationHistory: history,
      phase: fixture.phase,
      availableSlots: turn.availableSlots,
    };

    // Mock sequence: attempt-1 response, then the repair response if provided
    // (and the last entry repeats, so an unrepairable fixture stays malformed).
    const mockSequence = [turn.mockResponse, ...(turn.mockRepairResponse ? [turn.mockRepairResponse] : [])];
    const result = await runComposedBotTurn(input, {
      callClaude: live ? liveClaudeCaller : mockClaudeSequenceCaller(mockSequence),
      now,
    });

    printTurnResult(result);

    // Enum-drift surfacing (Sprint 2 Step 0): show near-miss enum values loudly.
    // The engine already warns during the run; we also summarize here so a live
    // eyeball makes drift obvious next to the parsed contract.
    const drift = logEnumDrift(result.parsedContract);
    section("ENUM DRIFT");
    console.log(drift.length === 0 ? "  none" : drift.map((d) => `  ⚠ ${d}`).join("\n"));

    allAssertionsPass = checkExpect(turn.expect, result, live) && allAssertionsPass;

    // Thread state + history forward for the next turn.
    runningState = threadStateForward(runningState, result, nowIso);
    history = [
      ...history,
      { role: "lead", content: turn.inboundMessage },
      { role: "bot", content: result.reply },
    ];

    if (multi && i < turns.length - 1) {
      section(`RUNNING STATE → going into turn ${i + 2}`);
      console.log(`  heatState=${runningState.heatState}  heatPeakReached=${runningState.heatPeakReached}  lastSignal=${runningState.lastSignal}`);
      console.log(`  gateProblem=${runningState.gateProblem}  gateDecisionMaker=${runningState.gateDecisionMaker}  consequenceSurfaced=${runningState.consequenceSurfaced}`);
      console.log(`  objectionsSurfaced=${JSON.stringify(runningState.objectionsSurfaced)}`);
    }
  }

  console.log(`\n${HR}`);
  if (!allAssertionsPass) {
    console.log("  RESULT: one or more assertions FAILED");
    console.log(HR);
    process.exit(1);
  }
  console.log("  RESULT: OK");
  console.log(HR);
}

main().catch((e) => {
  console.error(`[harness] fatal error: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
