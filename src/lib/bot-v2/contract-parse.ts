// New bot engine — contract parsing + validation (Sprint 2 helpers + Sprint 3 ladder).
//
// Utilities the engine uses around JSON.parse:
//   - stripCodeFences : remove markdown ```json … ``` wrapping the model adds
//                       despite being told not to (the #1 cause of Sprint 0 live
//                       parse failures).
//   - logEnumDrift    : log (NOT fix) near-miss enum values so a silently-wrong
//                       enum (e.g. "warm" instead of the "WARMING" signal) is
//                       VISIBLE. A wrong enum that fails an === check downstream
//                       would mean a lead never escalates — we want to see it.
//   - parseContract   : SPRINT 3. The strict parse+validate that backs the repair
//                       ladder (ARCHITECTURE §5). Enforces the REQUIRED fields
//                       (reply, signal.type) and the REBOOKED-confidence
//                       conditional; gracefully degrades OPTIONAL fields (missing →
//                       backfilled, out-of-enum scalar → logged + nulled). It never
//                       throws; it returns a discriminated result the engine ladder
//                       branches on.
//   - buildRepairUserMessage : SPRINT 3. The attempt-2 repair prompt — feeds the
//                       malformed output back with the exact required shape.
//
// This parse layer is PERSONA-AGNOSTIC (ARCHITECTURE §5 — the contract shape is
// shared by Alex and Jordan), so the one ladder serves both personas.

import type { BotContract, ContractState, Signal } from "./types";

// ─── Fence stripping ────────────────────────────────────────────────────────
//
// Handles the common wrappings: ```json\n{…}\n```, ```\n{…}\n```, and stray
// leading/trailing backticks. If no fence is present, returns the trimmed input
// unchanged. We only strip an OUTER fence; we never touch the JSON body.
export function stripCodeFences(raw: string): string {
  let s = raw.trim();

  // Opening fence: ``` optionally followed by a language tag (e.g. json) and a newline.
  const opening = /^```[^\n]*\n?/;
  // Closing fence: a trailing ``` possibly preceded by a newline.
  const closing = /\n?```$/;

  if (opening.test(s)) s = s.replace(opening, "");
  if (closing.test(s)) s = s.replace(closing, "");

  return s.trim();
}

// ─── Enum-drift guard ───────────────────────────────────────────────────────
//
// The exact, verbatim enum sets the contract instructs the model to use
// (kernel/04_signals.md + kernel/05_json_contract.md). A value that is non-null
// and outside its set is "drift" — logged loudly, not silently corrected.

const SIGNAL_TYPES = new Set([
  "QUALIFIED",
  "BOOKED",
  "REBOOKED",
  "NOT_INTERESTED",
  "ESCALATE",
  "STALL",
  "SOFT_CLOSE",
  "WARMING",
  "WOBBLING",
]);
const SIGNAL_CONFIDENCE = new Set(["solid", "soft"]);
const NEPQ_PHASES = new Set(["connection", "situation", "problem", "consequence", "commitment"]);
const URGENCY = new Set(["none", "low", "medium", "high"]);
const OBJECTION_FAMILIES = new Set([
  "price",
  "time",
  "trust",
  "authority",
  "need",
  "grievance",
  "competitor",
]);

/** Log any near-miss enum value in a parsed contract. Returns the drift messages
 *  (also used by the harness so it can surface drift in its output). */
export function logEnumDrift(contract: BotContract | null): string[] {
  if (!contract) return [];
  const drift: string[] = [];
  const note = (field: string, value: unknown, allowed: Set<string>) => {
    if (value == null) return; // null is a valid "unset" for every enum field
    if (typeof value !== "string" || !allowed.has(value)) {
      drift.push(`${field}=${JSON.stringify(value)} (expected one of: ${[...allowed].join(", ")} | null)`);
    }
  };

  const signal = contract.signal as { type?: unknown; confidence?: unknown } | undefined;
  note("signal.type", signal?.type, SIGNAL_TYPES);
  note("signal.confidence", signal?.confidence, SIGNAL_CONFIDENCE);

  const state = contract.state as Record<string, unknown> | undefined;
  if (state) {
    note("state.nepqPhase", state.nepqPhase, NEPQ_PHASES);
    note("state.urgency", state.urgency, URGENCY);
    if (Array.isArray(state.objectionsSurfaced)) {
      state.objectionsSurfaced.forEach((o, i) => {
        const fam = (o as Record<string, unknown>)?.family;
        note(`state.objectionsSurfaced[${i}].family`, fam, OBJECTION_FAMILIES);
      });
    }
  }

  if (drift.length > 0) {
    console.warn(`[bot-v2] ENUM DRIFT detected in model output:\n  - ${drift.join("\n  - ")}`);
  }
  return drift;
}

// ─── parseContract — the validating parse behind the repair ladder ──────────
//
// ARCHITECTURE §5 "Validation (the repair ladder + graceful degradation)":
//   - REQUIRED: `reply` (non-empty string), `signal.type` (present; null is a
//     valid value meaning "continue"). Missing/ill-typed required → FAILURE
//     (the engine triggers the next ladder rung).
//   - CONDITIONAL: when `signal.type === "REBOOKED"`, `signal.confidence` is
//     required (solid|soft). Missing → FAILURE. (Jordan-only; built now because
//     the ladder is shared — ARCHITECTURE §5.)
//   - REQUIRED-field enum drift is a FAILURE (repair it). OPTIONAL-field enum
//     drift is logged and nulled, not failed (graceful degradation).
//   - OPTIONAL fields missing → NOT a failure; backfilled by the merge layer.
//
// Returns a discriminated result; NEVER throws. On success the contract is
// already normalized (signal is a full object; out-of-enum optional scalars are
// nulled) so the engine can use it directly.

export interface ParseSuccess {
  ok: true;
  contract: BotContract;
}
export interface ParseFailure {
  ok: false;
  reason: string;
}
export type ParseResult = ParseSuccess | ParseFailure;

export function parseContract(raw: string): ParseResult {
  let obj: unknown;
  try {
    obj = JSON.parse(stripCodeFences(raw));
  } catch {
    return { ok: false, reason: "json_parse_failed" };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "not_a_json_object" };
  }
  const root = obj as Record<string, unknown>;

  // ── REQUIRED: reply ──
  if (typeof root.reply !== "string" || root.reply.trim() === "") {
    return { ok: false, reason: "missing_or_empty_reply" };
  }

  // ── REQUIRED: signal + signal.type ──
  if (!("signal" in root) || root.signal === undefined) {
    return { ok: false, reason: "missing_signal" };
  }
  let type: unknown;
  let confidence: unknown = null;
  let reason: unknown = null;
  const rawSignal = root.signal;
  if (rawSignal === null) {
    // A bare `null` signal is leniently treated as "continue" (type null).
    type = null;
  } else if (typeof rawSignal === "string") {
    type = rawSignal;
  } else if (typeof rawSignal === "object" && !Array.isArray(rawSignal)) {
    const s = rawSignal as Record<string, unknown>;
    if (!("type" in s)) return { ok: false, reason: "missing_signal_type" };
    type = s.type;
    confidence = s.confidence ?? null;
    reason = s.reason ?? null;
  } else {
    return { ok: false, reason: "malformed_signal" };
  }

  // signal.type is REQUIRED → a non-null value outside the enum is a FAILURE.
  if (type !== null && (typeof type !== "string" || !SIGNAL_TYPES.has(type))) {
    return { ok: false, reason: `bad_signal_type_enum:${JSON.stringify(type)}` };
  }

  // CONDITIONAL: REBOOKED requires a valid confidence.
  if (type === "REBOOKED" && !(typeof confidence === "string" && SIGNAL_CONFIDENCE.has(confidence))) {
    return { ok: false, reason: "rebooked_missing_confidence" };
  }
  // confidence is OPTIONAL for every other signal → drift is logged + nulled.
  if (type !== "REBOOKED" && confidence !== null && !(typeof confidence === "string" && SIGNAL_CONFIDENCE.has(confidence))) {
    console.warn(`[bot-v2] nulled out-of-enum signal.confidence=${JSON.stringify(confidence)} (optional field)`);
    confidence = null;
  }

  const signal: Signal = {
    type: (type ?? null) as Signal["type"],
    confidence: (confidence ?? null) as Signal["confidence"],
    reason: reason == null ? null : String(reason),
  };

  // ── OPTIONAL: state (backfill + scrub optional scalar enums) ──
  const state = scrubState(root.state);

  return { ok: true, contract: { reply: root.reply, signal, state } };
}

// Graceful degradation for the OPTIONAL state block: pass values through, but
// null any out-of-enum OPTIONAL scalar enum (nepqPhase, urgency) so a near-miss
// never poisons downstream === checks. Objection-family drift is surfaced by
// logEnumDrift (we don't drop the objection — its key carries the surfaceForm).
function scrubState(raw: unknown): ContractState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const s = { ...(raw as Record<string, unknown>) };
  if (s.nepqPhase != null && !(typeof s.nepqPhase === "string" && NEPQ_PHASES.has(s.nepqPhase))) {
    console.warn(`[bot-v2] nulled out-of-enum state.nepqPhase=${JSON.stringify(s.nepqPhase)} (optional field)`);
    s.nepqPhase = null;
  }
  if (s.urgency != null && !(typeof s.urgency === "string" && URGENCY.has(s.urgency))) {
    console.warn(`[bot-v2] nulled out-of-enum state.urgency=${JSON.stringify(s.urgency)} (optional field)`);
    s.urgency = null;
  }
  return s as ContractState;
}

// ─── buildRepairUserMessage — the attempt-2 repair prompt ───────────────────
//
// Fed back as a user turn after the malformed assistant output (ARCHITECTURE §5
// attempt 2). Restates the EXACT required shape and the hard rules, and asks for
// valid JSON only. Persona-agnostic — the persona/contract context is already in
// the (unchanged) system prompt; this only re-asserts the machine contract.
const REPAIR_SHAPE_HINT =
  `{\n` +
  `  "reply": "<your SMS text, in persona voice>",\n` +
  `  "signal": { "type": <SIGNAL or null>, "confidence": "solid|soft|null", "reason": "string|null" },\n` +
  `  "state": { /* only model-authored fields you actually know */ }\n` +
  `}`;

export function buildRepairUserMessage(malformed: string, reason: string): string {
  return [
    "Your previous response was NOT valid against the required output contract and could not be used.",
    `Problem detected: ${reason}.`,
    "Here is exactly what you returned:",
    "<malformed>",
    malformed,
    "</malformed>",
    "",
    "Re-send your answer as ONE valid JSON object in this exact shape — no prose, no markdown, no code fences, no text before or after:",
    REPAIR_SHAPE_HINT,
    "",
    "Hard rules you MUST satisfy:",
    "- `reply` is a non-empty string in your persona's voice.",
    "- `signal.type` is REQUIRED and must be EXACTLY one of: QUALIFIED, BOOKED, REBOOKED, NOT_INTERESTED, ESCALATE, STALL, SOFT_CLOSE, WARMING, WOBBLING, or null. Do not invent values, do not lowercase.",
    "- If `signal.type` is REBOOKED, `signal.confidence` must be \"solid\" or \"soft\".",
    "- Emit ONLY model-authored `state` fields; never emit system-authored fields.",
    "The first character of your reply must be `{` and the last must be `}`.",
  ].join("\n");
}
