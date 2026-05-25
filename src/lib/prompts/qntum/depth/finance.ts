import type { FinanceContext } from '../types';

export function getFinanceDepthModule(context: FinanceContext): string {
  const {
    message_history_count,
    last_message_context,
    options_surfaced,
  } = context;

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
Send the escalation message exactly as written and stop.

ESCALATION_MESSAGE:
"This is worth a real conversation — let me have our financing specialist give you a call. What's the best time to reach you?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (message_history_count >= 12) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
This conversation has reached its limit. Send the escalation message and stop.

ESCALATION_MESSAGE:
"This is worth a real conversation — let me have our financing specialist give you a call. What's the best time to reach you?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (last_message_context === 'firmly_cant_proceed') {
    return `CONVERSATION_POSITION: close_no_path

CURRENT_DIRECTIVE:
The homeowner has been honest — there is no viable path right now. Respect it completely. Close honestly.

Direction: "I want to be straight with you — if the timing or the numbers can't work right now, that's a real answer and I respect it. Where do you think things land?"

If they confirm no path: close warmly.
"Fair enough — appreciate you being straight with me. If anything changes, we're easy to reach."
Emit [FINANCE_DEAD].

LENGTH_RULE:
One to two exchanges. Move toward a clean close.`;
  }

  if (last_message_context === 'option_identified') {
    return `CONVERSATION_POSITION: option_found

CURRENT_DIRECTIVE:
A viable path has been surfaced. Do not over-sell it. Ask one clarifying question to confirm it's actually actionable for them.

"Is that something you could actually move on, or is there still a hurdle with it?"

If yes — emit [FINANCE_RETRY].
If needs more time — emit [FINANCE_PENDING].

LENGTH_RULE:
One to two exchanges. Move toward signal.`;
  }

  // ── Threshold map ───────────────────────────────────────────────────────────
  const thresholds = {
    opening_ends_at: 2,
    early_discovery_ends_at: 5,
    deep_discovery_ends_at: 9,
    approaching_close_at: 9,
    hard_limit: 12,
  };

  type Position = 'opening' | 'early_discovery' | 'deep_discovery' | 'approaching_close';
  let position: Position;

  if (message_history_count < thresholds.opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < thresholds.early_discovery_ends_at) {
    position = 'early_discovery';
  } else if (message_history_count < thresholds.deep_discovery_ends_at) {
    position = 'deep_discovery';
  } else {
    position = 'approaching_close';
  }

  let directive: string;

  if (position === 'opening') {
    directive = `You are early in this conversation. Get one real answer about where they stand now. Watch for option signals — any mention of equity, credit unions, family, timing, or home value is a thread to follow. One question. Stop.`;

  } else if (position === 'early_discovery') {
    directive = `You are in early discovery. Ask one discovery question per exchange. Build a picture of what's possible without naming specific products.

${options_surfaced.length > 0
  ? `Already discussed: ${options_surfaced.join(', ')}. Do not revisit these.`
  : `No options surfaced yet. Work through the discovery register — equity, credit unions, timing, family, staged project.`}

One question per exchange. Build the picture before narrowing.`;

  } else if (position === 'deep_discovery') {
    directive = `You are in deep discovery. You should have a rough picture of their situation by now. Narrow focus — dig into the viable paths, close out the unviable ones naturally.

${options_surfaced.length > 0
  ? `Paths surfaced: ${options_surfaced.join(', ')}. Deepen the conversation on the most viable one.`
  : `No clear path yet. Try one more angle from the discovery register before moving toward close.`}

If a viable path emerges — ask one clarifying question to confirm it's real and actionable. Emit [FINANCE_RETRY] if yes. Emit [FINANCE_PENDING] if needs time.`;

  } else {
    directive = `You are approaching the close. By now you know whether a path exists or not.

If a path exists: confirm it's real and actionable. Emit [FINANCE_RETRY] or [FINANCE_PENDING].

If no path exists: be honest.
"I want to be straight with you — if the timing or the numbers can't work right now, that's a real answer and I respect it. Where do you think things land?"

Accept whatever they say. Emit [FINANCE_DEAD] if confirmed no path.

Do not extend this conversation past its natural end.`;
  }

  const remaining = thresholds.hard_limit - message_history_count;

  return `CONVERSATION_POSITION: ${position}

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${remaining} exchange(s) remaining. Two sentences max per message. One question. Stop.`;
}
