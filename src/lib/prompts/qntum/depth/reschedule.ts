import type { RescheduleContext } from '../types';

export function getRescheduleDepthModule(context: RescheduleContext): string {
  const {
    message_history_count,
    last_message_context,
    reschedule_reason,
    has_pivoted_to_revival,
    from_booking_stall,
    inspection_findings,
  } = context;

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
Send the escalation message exactly as written and stop.

ESCALATION_MESSAGE:
"Let me get one of our coordinators to reach out and sort this out properly. What time works best for a quick call?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (message_history_count >= 12) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
This conversation has reached its absolute limit. Send the escalation message and stop.

ESCALATION_MESSAGE:
"Let me get one of our coordinators to reach out and sort this out properly. What time works best for a quick call?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (last_message_context === 'confirmed') {
    return `CONVERSATION_POSITION: rescheduled

CURRENT_DIRECTIVE:
The homeowner confirmed a new slot. Repeat it back clearly and end with [RESCHEDULED: YYYY-MM-DD HH:MM].

Direction: "You're all set — got you down for [day] at [time]. Our inspector will reach out the morning of."

LENGTH_RULE:
One message. Stop.`;
  }

  // ── Pivot trigger ───────────────────────────────────────────────────────────

  const shouldPivot =
    has_pivoted_to_revival ||
    last_message_context === 'wont_rebook' ||
    (message_history_count >= 3 && last_message_context !== 'confirmed' && !from_booking_stall);

  if (shouldPivot) {
    const findingsHook = inspection_findings
      ? `\n\nYou have inspection findings available as a consequence hook. Use ONE finding if it creates a natural opening — don't lead with it mechanically.`
      : `\n\nNo inspection findings available. Ask: "Is the roof still something you're thinking about, or has that moved to the back burner?"`;

    return `CONVERSATION_POSITION: pivoted_to_revival

CURRENT_DIRECTIVE:
Rescheduling has stalled or been declined. Stop offering slots. Pivot to discovery.

Ask one discovery question about their situation. The goal is to find out what actually stopped them — not to push the reschedule.${findingsHook}

Follow the Revival NEPQ sequence from here:
Stage 1 — Situation: What's going on for them now? Has anything changed?
Stage 2 — Problem: Do they still think the roof is worth addressing?
Stage 3 — Consequence: What happens if this keeps sitting?
Stage 4 — Decision-readiness: If the timing worked, is this something they'd want to handle?

Emit [RE_QUALIFY] if re-engaged and ready. Emit [DEAD] if not viable.

LENGTH_RULE:
Up to 6 more exchanges in pivot mode. Do not rush — but move with purpose.`;
  }

  // ── Active reschedule flow ──────────────────────────────────────────────────

  const thresholds = { hard_limit_reschedule: 3, hard_limit_total: 6 };

  let directive: string;

  if (message_history_count === 0) {
    directive = `Opener just sent. Wait for homeowner reply.`;
  } else if (last_message_context === 'slot_rejected' || last_message_context === 'stall') {
    directive = `The slot was rejected or the homeowner is stalling. Ask what works better for them — time of day, day of week. One question. Work from their answer before offering another slot.\nDo not present a menu. If they keep rejecting without giving constraints, end with [CHECK_MORE_SLOTS].`;
  } else if (reschedule_reason === 'one_legger') {
    directive = `One-legger reschedule — make sure to confirm decision maker availability before locking a new slot.\n"When would work for everyone to be there?" One question.`;
  } else {
    directive = `Offer one slot at a time. If rejected, ask what works better before offering another. Work toward one confirmed booking. If no commitment in 2-3 exchanges, pivot to revival.`;
  }

  const remaining = thresholds.hard_limit_reschedule - Math.min(message_history_count, thresholds.hard_limit_reschedule);

  return `CONVERSATION_POSITION: active_reschedule

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${remaining > 0 ? `${remaining} reschedule exchange(s) before pivot.` : 'At pivot threshold — move toward resolution or pivot to revival.'}`;
}
