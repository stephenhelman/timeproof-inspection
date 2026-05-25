import type { NurtureContext } from '../types';

export function getNurtureDepthModule(context: NurtureContext): string {
  const {
    message_history_count,
    last_message_context,
    used_insight_ids,
    is_drip,
    drip_sequence_position,
  } = context;

  const insightBudgetRemaining = 6 - used_insight_ids.length;

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'not_interested') {
    return `CONVERSATION_POSITION: close_not_interested

CURRENT_DIRECTIVE:
The homeowner has said they're not interested. Respect it fully. One warm closing sentence. No recovery attempt.
Register: "Fair enough — if you ever want to know what's going on up there, we're easy to reach. Take care."
Emit [NOT_INTERESTED] at the end of your message.

LENGTH_RULE:
Final message. No further exchanges.`;
  }

  if (last_message_context === 'intent_signal') {
    return `CONVERSATION_POSITION: intent_bridge

CURRENT_DIRECTIVE:
The homeowner has shown a clear intent signal. You have already been instructed to emit [INSPECTION_INTENT] — this position is active while you ask the bridge question. Ask one NEPQ question to carry the transition naturally.

Direction: "That's worth knowing about — I want to make sure we'd actually be able to help before going too far down that road. What's got you thinking about the roof right now?"

One question. Stop. Route handler will handle the ZIP gate.

LENGTH_RULE:
One exchange. Stay warm and unhurried.`;
  }

  // ── Drip-specific depth ─────────────────────────────────────────────────────

  if (is_drip && drip_sequence_position !== null) {
    const pos = drip_sequence_position;

    let dripDirective: string;

    if (pos === 1) {
      dripDirective = `This is the first drip check-in (day 3). Reference something specific from the prior thread. Lead with one new educational insight if available. Ask one soft question. Feel like a natural continuation, not a campaign.`;
    } else if (pos === 2) {
      dripDirective = `This is the second drip message (day 7). Reference something from what they shared earlier. Share one new insight if budget allows. Ask one gentle situational question. Keep it even more conversational — they've heard from you once already.`;
    } else if (pos === 3) {
      dripDirective = `This is the third drip message (day 14). More time has passed. Acknowledge that in your tone — not explicitly, but in how unhurried you are. Lead with one specific piece of context from their situation. One soft question.`;
    } else {
      dripDirective = `This is the final drip message (day 30). This is the last proactive reach-out. Make it feel complete — not desperate. Reference something real from their situation. Close warmly if they don't respond. Emit [SOFT_CLOSE] at the end of your message.`;
    }

    return `CONVERSATION_POSITION: drip_${pos}

CURRENT_DIRECTIVE:
${dripDirective}

INSIGHT_BUDGET: ${insightBudgetRemaining} insight(s) remaining.

LENGTH_RULE:
Two sentences max. One question. Do not fill space.`;
  }

  // ── Threshold map ───────────────────────────────────────────────────────────
  const thresholds = {
    opening_ends_at: 2,
    approaching_close_at: 5,
    hard_limit: 6,
  };

  const { opening_ends_at, approaching_close_at, hard_limit } = thresholds;

  type Position = 'opening' | 'mid_conversation' | 'approaching_close';
  let position: Position;

  if (message_history_count < opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < approaching_close_at) {
    position = 'mid_conversation';
  } else {
    position = 'approaching_close';
  }

  let directive: string;

  if (position === 'opening') {
    directive = `You are early in this conversation. Your job is to be a knowledgeable neighbor — not a sales funnel. Ask one soft situational question. Weave in one educational insight from AVAILABLE_INSIGHTS if the conversation creates a natural opening. Watch for intent signals.

Do not build urgency. Do not probe for decision-making authority. Do not mention the inspection unless they bring it up.`;

  } else if (position === 'mid_conversation') {
    directive = `You are in the middle of a genuine conversation. Continue asking soft situational questions. Use insights contextually — one per message, never forced. Watch every reply for intent signals.

${last_message_context === 'problem_mentioned' ? `The homeowner has mentioned a specific problem. This is an opening to deliver one relevant consequence-adjacent insight (from failureZones, hiddenDamageTimeline, or atticImportance). Still no NEPQ pressure — let the insight do the work.` : ''}
${last_message_context === 'skeptical' ? `The homeowner is skeptical. Back off. Match their energy. Ask one very soft question that gives them control. Do not push an insight this exchange.` : ''}
${last_message_context === 'curious_engaged' ? `The homeowner is engaged and curious. This is your best window. Use one strong insight and ask one follow-up question that goes one layer deeper.` : ''}

Insight budget: ${insightBudgetRemaining} remaining. Do not use an insight just to fill space.`;

  } else {
    directive = `You are approaching the end of this bot's runway. You have had enough exchanges to know whether this homeowner has any awareness of their roof situation.

If they've shown any curiosity or mentioned anything about their roof — close warmly with one final question or observation. Emit [SOFT_CLOSE] at the end.

If they've been engaged but no intent signal has appeared — close with warmth and leave the door open. "If anything ever comes up with the roof, we're easy to reach." Emit [SOFT_CLOSE].

If they've been completely unresponsive or dismissive — close simply. Emit [SOFT_CLOSE].

Do not pitch. Do not manufacture urgency. Close with respect.`;
  }

  const remaining = hard_limit - message_history_count;
  const lengthRule = position === 'opening'
    ? `Full runway. ${hard_limit} exchanges total. Do not rush.`
    : position === 'mid_conversation'
    ? `${remaining} exchange(s) remaining. Stay aware of pace.`
    : `One or two exchanges remaining. Move toward a clean close.`;

  return `CONVERSATION_POSITION: ${position}

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${lengthRule}`;
}
