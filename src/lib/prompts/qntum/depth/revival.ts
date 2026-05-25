import type { RevivalContext } from '../types';

export function getRevivalDepthModule(context: RevivalContext): string {
  const {
    message_history_count,
    last_message_context,
    conversation_track,
    lead_scenario,
    referral_seed_planted,
  } = context;

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
Send the escalation message exactly as written and stop.

ESCALATION_MESSAGE:
"I want to make sure the right person handles this for you — let me connect you with someone on our team who can actually dig into it. What's a good time to reach you?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (message_history_count >= 10) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
This conversation has reached its limit. Send the escalation message and stop.

ESCALATION_MESSAGE:
"I want to make sure the right person handles this for you — let me connect you with someone on our team who can actually dig into it. What's a good time to reach you?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (last_message_context === 'not_interested') {
    const referral = referral_seed_planted
      ? ''
      : `\n\nBefore closing, plant the referral seed once: "If you know anyone else dealing with roof stuff, we'd appreciate the word." Then close. Emit [DEAD].`;
    return `CONVERSATION_POSITION: close_not_interested

CURRENT_DIRECTIVE:
Respect it fully. One warm closing sentence. No recovery attempt.
Register: "Fair enough — appreciate you being straight with me. Take care."
${referral}

LENGTH_RULE:
Final message. Emit [DEAD].`;
  }

  // ── Threshold map ───────────────────────────────────────────────────────────
  const thresholds = {
    opening_ends_at: 2,
    referral_seed_at: conversation_track === 'resistant' ? 5 : 6,
    approaching_close_at: conversation_track === 'resistant' ? 6 : 7,
    hard_limit: 10,
  };

  const { opening_ends_at, referral_seed_at, approaching_close_at, hard_limit } = thresholds;

  type Position = 'opening' | 'mid_conversation' | 'approaching_close';
  let position: Position;

  if (message_history_count < opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < approaching_close_at) {
    position = 'mid_conversation';
  } else {
    position = 'approaching_close';
  }

  const shouldPlantReferral =
    !referral_seed_planted && message_history_count >= referral_seed_at;

  let directive: string;

  if (position === 'opening') {
    directive = `You are in the opening of this conversation. Your opener already references a specific finding or situation. Wait for the homeowner's response. When it comes, begin NEPQ Stage 1: Situation.

NEPQ Stage 1 — Situation:
"What is their current relationship with the roof problem? Has anything changed since the inspection?"
One question. Stop.`;

  } else if (position === 'mid_conversation') {

    const objectionBranches: Record<string, string> = {
      objection_price: 'price',
      objection_timing: 'timing',
      objection_spouse: 'spouse',
      objection_competitor: 'competitor',
      objection_need_to_think: 'need_to_think',
    };

    const activeBranch = last_message_context && objectionBranches[last_message_context]
      ? objectionBranches[last_message_context]
      : null;

    if (activeBranch) {
      directive = `The homeowner has surfaced a ${activeBranch} objection. Follow the ${activeBranch} branch sequence from BRANCH_MODULE.`;
    } else {
      const stages = [
        `Stage 1 — Situation: What is their current relationship with the roof problem? Has anything changed?`,
        `Stage 2 — Problem: Do they still believe there's a real issue? If urgency has faded, reference one specific finding (once).`,
        `Stage 3 — Consequence: "Given what we found — what does that mean for you if it sits another few months?"`,
        `Stage 4 — Decision-readiness: "If the timing and the numbers worked out — is this something you'd want to get handled?"`,
      ];

      // Estimate which stage we're in based on message count and lead_scenario
      const stageIdx = Math.min(
        Math.floor((message_history_count - opening_ends_at) / 1),
        stages.length - 1
      );

      directive = `You are working through the NEPQ revival sequence. Read the conversation history and pick up where you left off — do not repeat a stage already completed.

${stages[stageIdx]}

One question. Stop. Do not rush to Stage 4 — earn each stage.`;

      if (lead_scenario === 'no_report_no_show') {
        directive += `\n\nNo inspection findings available. Start from curiosity — what made them interested in the first place and is that still relevant.`;
      }
    }

    if (shouldPlantReferral) {
      directive += `\n\nREFERRAL_SEED: Plant the referral seed once in this message, naturally — before any question. "If you know anyone else dealing with roof stuff, we'd appreciate the word." One time. Not as a consolation prize.`;
    }

  } else {
    directive = `You are near the end of this conversation's runway.

If the homeowner is re-engaged and ready: emit [RE_QUALIFY] at the end of your next message.

If the homeowner is not ready but this isn't a hard no: close warmly with one sentence.${!referral_seed_planted ? ` Plant the referral seed: "If you know anyone else dealing with roof stuff, we'd appreciate the word."` : ''} Emit [DEAD].

If the homeowner is definitively not interested: one sentence close.${!referral_seed_planted ? ` Referral seed.` : ''} Emit [DEAD].

Do not re-open topics. Do not pitch. Move toward a clean resolution.`;
  }

  const remaining = hard_limit - message_history_count;
  const lengthRule = position === 'approaching_close'
    ? `One to two exchanges remaining. Move toward resolution.`
    : `${remaining} exchange(s) remaining.`;

  return `CONVERSATION_POSITION: ${position}

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${lengthRule}`;
}
