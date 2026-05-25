import type { QualifyContext } from '../types';

export function getQualifyDepthModule(context: QualifyContext): string {
  const { message_history_count, last_message_context, conversation_track } = context;

  // ── Hard overrides ──────────────────────────────────────────────────────────

  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
Send the escalation message exactly as written and stop. Do not acknowledge any other content in their message.

ESCALATION_MESSAGE:
"That's a bit outside what I can help with over text — let me get someone from our team to reach out directly. What's a good time for them to call?"

LENGTH_RULE:
No further exchanges after escalation message is sent.`;
  }

  if (message_history_count >= 8) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
This conversation has reached its limit. Send the escalation message and stop.

ESCALATION_MESSAGE:
"That's a bit outside what I can help with over text — let me get someone from our team to reach out directly. What's a good time for them to call?"

LENGTH_RULE:
No further exchanges.`;
  }

  if (last_message_context === 'financial_signal') {
    return `CONVERSATION_POSITION: approaching_close

CURRENT_DIRECTIVE:
A financial signal has surfaced — the homeowner has indicated timing, budget, or decision constraints. Do not push past this. Ask one gentle follow-up to understand specifically what the constraint is, then respect whatever they say. If the constraint is real and near-term, close warmly. Do not attempt to overcome it.

LENGTH_RULE:
One to two exchanges remaining. Move toward a clean resolution.`;
  }

  // ── Threshold map ───────────────────────────────────────────────────────────
  const thresholds = {
    opening_ends_at: 2,
    approaching_close_at: conversation_track === 'resistant' ? 5 : 6,
    hard_limit: 8,
  };

  const { opening_ends_at, approaching_close_at, hard_limit } = thresholds;

  let position: 'opening' | 'mid_conversation' | 'approaching_close' | 'escalate_now';

  if (message_history_count < opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < approaching_close_at) {
    position = 'mid_conversation';
  } else if (message_history_count < hard_limit) {
    position = 'approaching_close';
  } else {
    position = 'escalate_now';
  }

  // ── Directives ──────────────────────────────────────────────────────────────

  let directive: string;

  if (position === 'opening') {
    directive = `You are early in this conversation. Your only job right now is to understand their situation. Do not probe for urgency yet — earn the right to ask deeper questions first. Follow the opener instruction. One question. Stop.`;

  } else if (position === 'mid_conversation') {

    if (conversation_track === 'problem_aware') {
      directive = `The homeowner has confirmed they believe there's an issue. Move to consequence. Ask what happens for them if the roof keeps going without being addressed. Let their answer tell you how urgent this really is. Do not manufacture urgency — surface it. One question. Stop.

After consequence is established, move to decision-readiness. The question should feel like natural logistics, not a qualification screen:
"If our inspector finds something that needs attention — is that something you'd want to handle fairly quickly, or would timing need to work out a certain way for you?"

This question surfaces financial and decision-making constraints without naming them. Listen carefully to the answer. If they hedge, ask one follow-up. If they're clear, accept it and move to decision maker confirmation.`;

    } else if (conversation_track === 'problem_unaware') {
      directive = `The homeowner isn't sure they have a problem — they may have clicked out of curiosity or a general sense of "it's been a while." Do not tell them they probably have a problem. Ask consequence questions that help them think through it themselves.

Useful question register:
"When's the last time someone actually got up there and looked at it?"
"Has anything inside the house made you wonder — water stains, higher bills, anything like that?"
"What would it mean for you if there was something going on up there that you didn't know about yet?"

One question per message. Do not ask all of these. Pick the one that fits where the conversation is. Move toward surfacing their own awareness before probing for decision-readiness.`;

    } else if (conversation_track === 'resistant') {
      directive = `This homeowner is guarded or giving short answers. Do not push the NEPQ stages — you'll lose them. Slow down. Ask one very low-friction question that gives them control of the conversation. Match their energy. If they're short, be shorter. The goal right now is to get one real answer, not to progress the qualification track. A warm close is better than a forced qualification.`;

    } else {
      directive = `The homeowner is engaged and giving you real answers. Work through the NEPQ stages — situation, problem, consequence, decision-readiness. You have runway. Use it carefully. One question per message. Do not rush to qualify them — let the conversation do the work.`;
    }

  } else if (position === 'approaching_close') {
    directive = `You are near the end of this conversation's runway. You should have enough information by now to know whether this is a real opportunity.

If BOTH of the following are true — emit [QUALIFIED] at the end of your next message:
  1. The homeowner has shown genuine interest and some sense of urgency
  2. Decision maker situation is confirmed (everyone will be home, or it's been addressed)

If decision maker is still unresolved — ask now, directly but naturally:
"One quick thing — will everyone who'd need to be part of the decision be around when our inspector comes out?"

If they are not ready to move forward — do not push. Close warmly:
"That makes total sense. If anything changes or you want to revisit it, we're easy to reach. Take care."

Do not re-open topics. Do not pitch. Move toward a clean resolution.`;

  } else {
    directive = `Send the escalation message and stop.`;
  }

  const remaining = hard_limit - message_history_count;
  const lengthRule = position === 'opening'
    ? `Full runway ahead. Do not rush. You have up to ${hard_limit} exchanges total.`
    : position === 'mid_conversation'
    ? `You have roughly ${remaining} exchanges remaining. Be aware of pace — don't count down out loud.`
    : position === 'approaching_close'
    ? `One to two exchanges remaining. Move toward resolution.`
    : `No further exchanges.`;

  return `CONVERSATION_POSITION: ${position}

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${lengthRule}

ESCALATION_GUARD:
NEVER ESCALATE FOR:
- Homeowner describing roof damage or symptoms
- Homeowner mentioning water intrusion, leaks, or moisture
- Homeowner describing interior damage (ceiling stains,
  soft spots, wet drywall, water marks)
- Homeowner expressing urgency about their situation
- Homeowner asking if you can come out
- Homeowner saying they have a leak or active damage

These are QUALIFICATION SIGNALS. When a homeowner describes
active damage or urgency, move toward booking — not escalation.
Acknowledge what they described, ask one follow-up question,
and continue the qualification conversation naturally.`;
}
