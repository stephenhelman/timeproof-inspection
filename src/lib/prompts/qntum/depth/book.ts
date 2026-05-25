import type { BookContext } from '../types';

export function getBookDepthModule(context: BookContext): string {
  const { message_history_count, last_message_context } = context;

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
Send the escalation message exactly as written and stop.

ESCALATION_MESSAGE:
"I want to make sure you get the right answer on that — let me have someone from our team give you a quick call. What time works best?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (message_history_count >= 5) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
This conversation has reached its limit. Send the escalation message and stop.

ESCALATION_MESSAGE:
"I want to make sure you get the right answer on that — let me have someone from our team give you a quick call. What time works best?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (last_message_context === 'confirmed') {
    return `CONVERSATION_POSITION: booked

CURRENT_DIRECTIVE:
The homeowner has confirmed a slot. Repeat it back clearly and end with [BOOKED: YYYY-MM-DD HH:MM] (24h time in the signal).

Direction: "You're all set — got you down for [day] at [time]. Our inspector will reach out the morning of with a heads up."

LENGTH_RULE:
One message. Stop.`;
  }

  if (last_message_context === 'stall') {
    return `CONVERSATION_POSITION: stall

CURRENT_DIRECTIVE:
The homeowner needs to check their schedule. Send one acknowledgment and stop. Emit [STALL].

Direction: "No problem — I'll check back with you tomorrow. Take your time."

Do not follow up in this thread. GHL will fire the stall_followup webhook in 24 hours.

LENGTH_RULE:
One message. Stop.`;
  }

  if (last_message_context === 'slot_rejected' || last_message_context === 'needs_different_time') {
    return `CONVERSATION_POSITION: slot_negotiation

CURRENT_DIRECTIVE:
The offered slot didn't work. Ask what time of day or what days generally work best for them — then work from their answer. Do not present a menu. One question. If you need more slots, end with [CHECK_MORE_SLOTS].

Direction: "What time of day works better for you?"

LENGTH_RULE:
One to two exchanges remaining. Move toward booking.`;
  }

  // ── Threshold map ───────────────────────────────────────────────────────────
  const thresholds = { opening_ends_at: 1, approaching_close_at: 3, hard_limit: 5 };
  const { opening_ends_at, approaching_close_at, hard_limit } = thresholds;

  let position: 'opening' | 'mid_conversation' | 'approaching_close';
  if (message_history_count < opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < approaching_close_at) {
    position = 'mid_conversation';
  } else {
    position = 'approaching_close';
  }

  let directive: string;

  if (position === 'opening') {
    directive = `The transition message was just sent. Wait for the homeowner's reply before anything else. When they reply, treat it as their first real response and follow mid_conversation directive.`;
  } else if (position === 'mid_conversation') {
    directive = `You are negotiating a time. Offer one slot at a time — not a numbered list. If the homeowner rejects the slot, ask what works better for them before offering another. Keep it practical and warm. The goal is one confirmed booking in the next one or two exchanges.`;
  } else {
    directive = `You are near the end of this conversation's runway. If the homeowner has not committed — ask one direct but gentle question: "Is there a time this week that would actually work for you?" If they stall again, emit [STALL] and close. Do not extend past the hard limit.`;
  }

  const remaining = hard_limit - message_history_count;
  const lengthRule = position === 'opening'
    ? `Waiting for first homeowner reply.`
    : `${remaining} exchange(s) remaining. Move toward a confirmed booking.`;

  return `CONVERSATION_POSITION: ${position}

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${lengthRule}`;
}
