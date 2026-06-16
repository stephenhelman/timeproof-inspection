// New bot engine — model tier selection.
//
// This is the REAL tiering rule from ARCHITECTURE §3 (NOT a stub — the harness
// brief calls out that this logic is simple and worth getting right now). The
// tier line is "is real objection-or-gate work happening here," not the
// Alex/Jordan boundary.

import { COOLDOWN_WINDOW_MS } from "./config";
import type { ConversationStateInput, ModelTier } from "./types";

export interface TierDecision {
  tier: ModelTier;
  reason: string;
  // True when a nurture lead was warming but its inbound aged past the cooldown
  // window, so we treat it as cold this turn (ARCHITECTURE §3 lazy cooldown).
  cooledDown: boolean;
}

// Sonnet for the missions where the hard work (gates / objection excavation) happens.
const ALWAYS_SONNET = new Set(["qualify", "revival", "reschedule", "finance"]);

/**
 * Select the model tier for a turn.
 *
 * @param phase the active mission/phase
 * @param state the conversation state (heatState / heatLastInbound drive nurture)
 * @param now   current time in ms (injectable for deterministic tests)
 */
export function selectTier(
  phase: string,
  state: ConversationStateInput,
  now: number,
): TierDecision {
  if (ALWAYS_SONNET.has(phase)) {
    return { tier: "sonnet", reason: `${phase}: real gate/objection work → Sonnet`, cooledDown: false };
  }

  // Book is logistics for an already-qualified lead → Haiku. WOBBLING escalation
  // is DEFINED but DORMANT (ARCHITECTURE §3), so book always selects Haiku for now.
  if (phase === "book") {
    return { tier: "haiku", reason: "book: logistics (WOBBLING escalation dormant) → Haiku", cooledDown: false };
  }

  if (phase === "nurture") {
    if (state.heatState === "warming") {
      // Lazy cooldown: cool measured by time since the lead's last INBOUND only.
      const last = state.heatLastInbound ? Date.parse(state.heatLastInbound) : NaN;
      if (!Number.isNaN(last) && now - last > COOLDOWN_WINDOW_MS) {
        return {
          tier: "haiku",
          reason: "nurture: warming but last inbound older than COOLDOWN_WINDOW → cooled to Haiku",
          cooledDown: true,
        };
      }
      return { tier: "sonnet", reason: "nurture: warming → Sonnet", cooledDown: false };
    }
    return { tier: "haiku", reason: "nurture: cold → Haiku", cooledDown: false };
  }

  // silent / unknown phases: no real model work expected — default cheap.
  return { tier: "haiku", reason: `${phase}: default → Haiku`, cooledDown: false };
}
