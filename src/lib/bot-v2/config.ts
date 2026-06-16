// New bot engine — tunable configuration constants.

import type { ModelTier } from "./types";

// Cooldown window for the heat system (ARCHITECTURE §3). A warmed lead whose
// last INBOUND is older than this cools back to cold (Haiku) at assembly time.
// Start at 48–72h; tune from telemetry.
export const COOLDOWN_WINDOW_HOURS = 48;
export const COOLDOWN_WINDOW_MS = COOLDOWN_WINDOW_HOURS * 60 * 60 * 1000;

// Model IDs by tier (ARCHITECTURE §3).
// MODEL_HAIKU matches the id already used in src/lib/bot-engine.ts.
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";

export const MODEL_BY_TIER: Record<ModelTier, string> = {
  haiku: MODEL_HAIKU,
  sonnet: MODEL_SONNET,
};

// The full JSON contract — a reply PLUS the model-authored state block
// (objectionsSurfaced entries + the 5-slot summary, emitted on handoff turns) —
// is the largest on Jordan's recovery missions. 600 truncated it mid-JSON, which
// tripped the repair ladder into the safe fallback on otherwise-good turns. This
// is a ceiling, not a charge (you pay only for tokens generated), so the headroom
// costs nothing on short turns and buys parse reliability on full-contract turns.
export const DEFAULT_MAX_TOKENS = 1500;
