import { ConversationContext } from '../types';

/**
 * Returns a conversation depth rule based on message history count and trigger type.
 * Tells the bot when to continue, when to offer escalation, and when to hard-stop.
 */
export function getDepthModule(context: ConversationContext): string | null {
  const { trigger_type, drip_day, message_history_count, last_message_context } = context;

  // Hard rule: any thread over 10 exchanges escalates unconditionally
  if (message_history_count > 10) {
    return `
// ─── DEPTH: HARD ESCALATION ──────────────────────────────────────────────────
This thread has exceeded 10 exchanges. Send the escalation message now and stop responding. Do not continue the conversation under any circumstance.
`.trim();
  }

  // Negative experience branch: escalate at 4+ regardless of other context
  if (last_message_context === 'negative_experience' && message_history_count >= 4) {
    return `
// ─── DEPTH: NEGATIVE EXPERIENCE ESCALATION ───────────────────────────────────
This thread involves a negative experience and has reached 4 exchanges. Offer human escalation now regardless of other context. Do not continue probing.
`.trim();
  }

  if (trigger_type === 'missed_call_textback') {
    if (message_history_count <= 6) {
      return `
// ─── DEPTH: MISSED CALL TEXTBACK (${message_history_count} exchanges) ──────────────────────────
Continue normally. You are within the natural range for a text-back conversation.
`.trim();
    } else {
      return `
// ─── DEPTH: MISSED CALL TEXTBACK LIMIT REACHED ───────────────────────────────
You have reached the natural close of a text-back conversation. Offer escalation or close warmly. Do not extend the thread further.
`.trim();
    }
  }

  if (trigger_type === 'drip_reply') {
    if ((drip_day === 1 || drip_day === 3) && message_history_count > 4) {
      return `
// ─── DEPTH: DRIP REPLY DAY ${drip_day} LIMIT REACHED ────────────────────────────────
Early drip reply has extended past 4 exchanges. Offer escalation or close warmly. Do not keep the thread open.
`.trim();
    }

    if (drip_day === 7) {
      if (message_history_count <= 8) {
        return `
// ─── DEPTH: DRIP REPLY DAY 7 (${message_history_count} exchanges) ───────────────────────────
Continue normally. Day 7 is a warm reply — this thread has room to develop. You are within range.
`.trim();
      } else {
        return `
// ─── DEPTH: DRIP REPLY DAY 7 LIMIT REACHED ──────────────────────────────────
Day 7 reply has extended past 8 exchanges. Escalate or close warmly now.
`.trim();
      }
    }

    if ((drip_day === 14 || drip_day === 30) && message_history_count > 5) {
      return `
// ─── DEPTH: DRIP REPLY DAY ${drip_day} LIMIT REACHED ────────────────────────────────
Late drip reply has extended past 5 exchanges. Close warmly or escalate. Do not continue extending the thread.
`.trim();
    }
  }

  return null;
}
