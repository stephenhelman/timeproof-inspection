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

  if (last_message_context === 'financial_signal') {
    return `CONVERSATION_POSITION: financial_signal_check

CURRENT_DIRECTIVE:
BEFORE treating this as a financial constraint — read the homeowner's last message.

If their message suggests they think the inspection costs money (any form of
"I don't want to pay", "how much does it cost", "what's the charge", "do I have to pay",
"is it free", "I can't afford it" referring to the inspection):

→ This is a misunderstanding, not a real objection.
  Do NOT close. Do NOT soft-close. Do NOT validate as a constraint.
  Correct it immediately: "The inspection is completely free — no charge at all
  to come out and take a look. Would that change things for you?"
  One correction. One question. Stop. Wait for their answer.
  If they re-engage → continue qualification.
  Only if they still object after knowing it's free → treat as real constraint below.

If their message is a genuine financial constraint (they know it's free and still object,
or they reference repair cost, project cost, financing):

→ Ask one gentle follow-up to understand the specific constraint, then respect their answer.
  If the constraint is real and near-term, close warmly.

LENGTH_RULE:
One to two exchanges remaining if genuine constraint confirmed. Otherwise continue naturally.`;
  }

  // ── Threshold map ───────────────────────────────────────────────────────────
  const thresholds = {
    opening_ends_at: 2,
    approaching_close_at: conversation_track === 'resistant' ? 6 : 8,
    hard_limit: 12,
  };

  const { opening_ends_at, approaching_close_at, hard_limit } = thresholds;

  let position: 'opening' | 'mid_conversation' | 'approaching_close' | 'hard_limit_reached';

  if (message_history_count < opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < approaching_close_at) {
    position = 'mid_conversation';
  } else if (message_history_count < hard_limit) {
    position = 'approaching_close';
  } else {
    position = 'hard_limit_reached';
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
    directive = `BEFORE SOFT CLOSING — check these first:

If the last message was a price or cost question, or any form of "I don't want to pay":
→ Do NOT soft close. The inspection is free. Correct the misunderstanding:
  "The inspection is completely free — no charge at all to come out and take a look.
   Would that change things for you?"
  One sentence. One question. Stop.

If the last message was a soft timing hedge ("not right now", "maybe later",
"still thinking", "let me think about it", "I'll have to check"):
→ Do NOT soft close on the first hedge. Ask one consequence question first:
  "What would it mean for you if there was something going on up there
   that you didn't catch for another few months?"
  If they hedge again after that → then soft close.

Only soft close when the homeowner has explicitly said they're not interested
after being informed the inspection is free.

You are close to a booking. Read the last 2 messages.

If the homeowner has offered availability, asked to
schedule, asked if you can come out, or said yes to
the inspection in any form:

→ Emit [QUALIFIED] immediately. One short message.
  Do not describe a handoff. Do not mention a
  scheduling team. Do not say "let me connect you."
  Just confirm warmly and emit the signal.

  Right:
  "Tomorrow works — we'll get you taken care of. [QUALIFIED]"

  Wrong:
  "Let me get you connected with our scheduling team..."
  "I'm going to hand you off to someone who can..."
  "Our scheduling system is on their end..."

The system handles everything after [QUALIFIED] fires.
You do not need to explain what happens next.
The homeowner does not need to know there is a handoff.
To them it is one continuous conversation.

If the homeowner asks "Can't you do it" or similar —
they are confused by the handoff language. This only
happens if you described a handoff instead of emitting
[QUALIFIED]. Do not let this situation occur.

If BOTH qualifying gates are confirmed:
  1. Genuine interest — homeowner wants the inspection
  2. Decision maker — right people will be home
Emit [QUALIFIED] at the end of your next message.

If decision maker is still unconfirmed — ask now:
"One quick thing — will everyone who'd need to be
part of the conversation be around when we come out?"
Then on their answer, emit [QUALIFIED].

LENGTH RULE:
One sentence. Emit signal. Done.`;

  } else {
    directive = `The conversation has reached its limit. Do NOT automatically
escalate. Read the last 3 messages and determine which path
applies:

PATH A — Booking intent present:
If the homeowner has shown any of the following in the
last 3 messages:
  - Offering their availability ("I have time tomorrow",
    "I'm free this week", "today works")
  - Asking if you can come out
  - Asking when you can come
  - Saying yes, sure, let's do it, go ahead

→ Treat as fully qualified. Emit [QUALIFIED].
  The homeowner has self-qualified through their own words.
  Do not make them wait for a human call.
  Example: "Tomorrow works great — let me get you on the
  schedule. [QUALIFIED]"

PATH B — Engaged but no booking intent yet:
Homeowner is still in conversation but hasn't offered
availability or asked to book.

→ Ask one direct closing question then close warmly.
  "Based on everything you've described, it sounds like
  getting someone out there would give you a real answer.
  Is there a day this week that works for you?"
  If they respond positively → [QUALIFIED]
  If they don't commit → [SOFT_CLOSE]

PATH C — Conversation has stalled or homeowner is cold:
Short replies, disengaged, or hasn't responded to
consequence questions.

→ Close warmly. Emit [SOFT_CLOSE].
  "That makes sense — if the timing opens up and you want
  to get eyes on it, we're easy to reach. Take care."
  Do NOT escalate a cold lead to a human call.

ESCALATION is only appropriate when:
  - Homeowner explicitly asks to speak to someone
  - Homeowner is angry or frustrated
  - Homeowner pushes on pricing or insurance specifics
  - These have NOT changed — escalation is for situations
    that require human judgment, not conversations that
    simply ran long`;
  }

  const remaining = hard_limit - message_history_count;
  const lengthRule = position === 'opening'
    ? `Full runway ahead. Do not rush. You have up to ${hard_limit} exchanges total.`
    : position === 'mid_conversation'
    ? `You have roughly ${remaining} exchanges remaining. Be aware of pace — don't count down out loud.`
    : position === 'approaching_close'
    ? `One to two exchanges remaining. Move toward resolution.`
    : `Limit reached. Resolve now — [QUALIFIED], [SOFT_CLOSE], or escalation only. No further exchanges after this.`;

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
- Homeowner offering their availability
- Conversation running longer than expected

These are QUALIFICATION SIGNALS. When a homeowner describes
active damage or urgency, move toward booking — not escalation.
Acknowledge what they described, ask one follow-up question,
and continue the qualification conversation naturally.`;
}
