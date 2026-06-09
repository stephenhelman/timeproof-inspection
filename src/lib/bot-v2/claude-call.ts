// New bot engine — the mockable Claude call layer (sprint_0_harness.md §2).
//
// The engine reaches the model through a single injected `ClaudeCaller`. The
// harness swaps in a MOCK caller (canned fixture output) by default so runs are
// instant, free, and deterministic; production / live mode uses `liveClaudeCaller`.
//
// ┌─ FLAG / known deviation from the harness brief (walked through with the user) ─┐
// │ The brief §2 says "do NOT fork callClaudeRaw — reuse the single               │
// │ implementation, mockable." That function lives in src/lib/bot-engine.ts, is   │
// │ NOT exported, and that file (a) is on the Do-NOT-touch list (it also houses    │
// │ transitionLead and the bot handlers' engine) and (b) imports the whole        │
// │ @/-aliased prisma+GHL graph, which the raw-Node harness runner cannot load.    │
// │ So live mode here makes its own fetch (same request shape as callClaudeRaw)    │
// │ rather than importing it. This is the ONE place the new engine and the legacy  │
// │ engine duplicate the HTTP call; Sprint 3 ("unify the model-call path") is the  │
// │ point at which they should converge onto one shared implementation.           │
// └───────────────────────────────────────────────────────────────────────────────┘

import type { ClaudeUsage } from "./types";

export interface ClaudeCallParams {
  systemPrompt: string;
  messages: { role: string; content: string }[];
  model: string;
  maxTokens?: number;

  // SPRINT 6 — prompt caching (Step 3). The STABLE prefix (kernel + methodology +
  // persona + mission) the live caller sends as a SEPARATE system text block with
  // a `cache_control: {type:"ephemeral"}` breakpoint, so it is cached (5-minute
  // TTL) and the fresh runtime tail is not. MUST be a byte-prefix of systemPrompt;
  // the caller reconstructs the original prompt exactly by concatenating the two
  // blocks, so behavior is unchanged — only a cache breakpoint is inserted.
  // Omitted → single uncached system block (mock mode, or callers that opt out).
  cachePrefix?: string;
  // SPRINT 6 — usage sink. The live caller reports the API's usage block here so
  // the engine can log prompt-cache + cost telemetry (Step 4). Mock callers ignore it.
  onUsage?: (usage: ClaudeUsage) => void;
}

export type ClaudeCaller = (params: ClaudeCallParams) => Promise<string>;

// System content blocks for the Anthropic API. A `cache_control` breakpoint on a
// block caches everything up to and including it (render order: tools → system →
// messages). We use the default ~5-minute ephemeral cache (NOT the 1-hour option —
// SMS turns are bursty; the win is the prefix staying warm across concurrent leads
// in the same phase, which 5-minute captures — ARCHITECTURE / Sprint 6 Step 3).
type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

// Build the `system` field. With a cachePrefix that is a true byte-prefix of the
// full prompt, emit TWO blocks — [cached stable prefix][fresh runtime tail] — whose
// concatenation is byte-identical to the original single string (the JSON format
// directive stays in the fresh tail, exactly where it was appended before). Without
// a usable prefix, emit one plain block (no caching).
function buildSystemField(systemPrompt: string, cachePrefix: string | undefined): string | SystemBlock[] {
  const full = systemPrompt + JSON_FORMAT_INSTRUCTION;
  if (cachePrefix && systemPrompt.startsWith(cachePrefix) && cachePrefix.length > 0) {
    const tail = full.slice(cachePrefix.length); // "\n\n" + runtime + JSON_FORMAT_INSTRUCTION
    return [
      { type: "text", text: cachePrefix, cache_control: { type: "ephemeral" } },
      { type: "text", text: tail },
    ];
  }
  return full;
}

// Mirrors the format directive used by src/lib/bot-engine.ts so live output
// parses the same way production does.
const JSON_FORMAT_INSTRUCTION =
  `\n\nRESPONSE FORMAT — MANDATORY:\n` +
  `Return ONLY a raw JSON object. No markdown. No code fences. No backticks. No prose before or after.\n` +
  `The first character of your response must be { and the last character must be }.\n` +
  `JSON.parse() will be called directly on your response. Any wrapping will cause a failure.`;

/** LIVE caller — actually hits the Anthropic API. Used a few times per sprint. */
export const liveClaudeCaller: ClaudeCaller = async ({ systemPrompt, messages, model, maxTokens, cachePrefix, onUsage }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("[bot-v2] ANTHROPIC_API_KEY not set — cannot run --live mode");
  }

  // Prompt caching is GA with anthropic-version 2023-06-01 — `cache_control` in
  // the body needs no beta header. The breakpoint lands on the stable-prefix block
  // built by buildSystemField.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? 600,
      system: buildSystemField(systemPrompt, cachePrefix),
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[bot-v2] Claude API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { content: { text: string }[]; usage?: ClaudeUsage };
  if (data.usage && onUsage) onUsage(data.usage);
  return data.content[0]?.text ?? "";
};

/** MOCK caller factory — returns the canned model output verbatim. */
export function mockClaudeCaller(cannedResponse: string): ClaudeCaller {
  return async () => cannedResponse;
}

/**
 * SEQUENCE mock caller — returns the i-th canned response per successive call,
 * repeating the LAST entry once the sequence is exhausted. This is what lets a
 * fixture exercise the repair ladder deterministically: e.g. [malformed, valid]
 * proves attempt-2 repair SUCCEEDS, while [malformed] (repeating) proves the
 * safe fallback fires on an unrepairable turn. Sprint 3.
 */
export function mockClaudeSequenceCaller(responses: string[]): ClaudeCaller {
  let i = 0;
  return async () => {
    const idx = Math.min(i, responses.length - 1);
    i += 1;
    return responses[idx] ?? "";
  };
}
