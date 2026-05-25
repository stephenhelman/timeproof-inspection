import type { RevivalContext } from '../types';

export function getRevivalBranchModule(context: RevivalContext): string | null {
  const { last_message_context, inspection_findings } = context;

  switch (last_message_context) {

    case 'objection_price':
      return `BRANCH_STATE: price

NEPQ_SEQUENCE:
Read the conversation history. Pick up where the sequence left off.

Distinguish absolute (can't afford at any time) from relative (timing or cash flow issue).

Step 1 — Validate:
"That makes sense." Full stop.

Step 2 — Curiosity question:
"Is it more a question of timing, or is it something you don't see a path to right now?"
One question. Stop. Listen.

Step 3 — Route based on answer:
Relative (timing/cash flow): Surface consequence lightly. Ask one question about what a solution might look like. Do not name financing options. Do not mention HELOC, loans, payment plans. If they ask about financing — escalate.
"Is there any version of this that would work, or is the timing just completely off right now?"

Absolute (truly can't proceed): One consequence question — not to manufacture urgency, to surface their own awareness of the risk.
"What happens for you and the house if this just keeps going the way it is?"
If they confirm it can't happen: close warmly. Emit [DEAD].

Step 4 — If path exists:
Route toward re-qualify naturally.
"If we could find something that actually worked for your situation — is this something you'd still want to move on?"
If yes: emit [RE_QUALIFY].

BRANCH_CONSTRAINTS:
Never name financing options.
Never ask about credit.
Never pressure after a confirmed absolute constraint.`;

    case 'objection_timing':
      return `BRANCH_STATE: timing

NEPQ_SEQUENCE:
Read the conversation history. Pick up where the sequence left off.

Two versions — identify before proceeding.

Version A — Soft stall: "I've been busy" / "Things are hectic." Not a hard no.
Version B — Hard constraint: "We're selling the house" / "We're waiting until next year" / "We just don't have the money."

Step 1 — Validate:
"That makes sense." Full stop.

Step 2 — Curiosity question:
"What's making the timing tough right now?"
One question. Stop.

Step 3 — Route based on answer:
Version A (soft): "What would the roof look like if this got pushed another six months?"
(Surfaces consequence without manufacturing urgency.)
Version B (hard): Accept it fully. Close immediately. Do not re-open.
"That makes total sense. If the timing opens up, we're easy to reach."
Emit [DEAD].

BRANCH_CONSTRAINTS:
Never manufacture urgency.
Never say "the sooner the better" or equivalent.
If Version B confirmed — stop. Do not attempt recovery.`;

    case 'objection_spouse':
      return `BRANCH_STATE: spouse

NEPQ_SEQUENCE:
Read the conversation history. Pick up where the sequence left off.

Two sub-states:
Sub-state A — Logistical: Spouse wasn't involved / wasn't there. They might be open if included.
Sub-state B — Substantive: Spouse has real concerns or said no.

Step 1 — Validate:
"Of course — makes sense to have everyone on the same page."

Step 2 — Curiosity question:
"Is it more that they weren't part of the conversation yet, or do they have specific concerns?"
One question. Stop.

Step 3 — Route:
Sub-state A (logistical): Frame as wanting everyone involved.
"Would there be a time that works for both of you to go over what we found?"
Sub-state B (substantive): Treat spouse's concern as a real objection to work through.
"What specifically was on their mind?"
Route to the relevant branch based on what the spouse's concern actually is.

BRANCH_CONSTRAINTS:
Do not make the homeowner feel caught between Jordan and their partner.
Do not pressure the homeowner to override their spouse.
If spouse concern leads to price/timing/insurance — follow that branch.`;

    case 'objection_competitor':
      return `BRANCH_STATE: competitor

NEPQ_SEQUENCE:
Read the conversation history. Pick up where the sequence left off.

Sub-state A — Work already done: Close immediately. No recovery.
Sub-state B — Work not yet done: They're still deciding.

Step 1 — Validate:
"Smart to look at your options." No competitive framing.

Step 2 — Curiosity question:
"Did they end up doing the work, or is that still in the works?"
One question. Stop.

Step 3 — Route:
Sub-state A (done): "Glad you got it taken care of — that's the important thing. Take care."
Emit [DEAD].

Sub-state B (not done): "What made you want to look at other options before you decided?"
Understand their decision criteria. Do not pitch against the competitor.

Step 4 — If still open:
"Is there something specific you were hoping to see from whoever you go with?"
Routes to consequence naturally if they're still genuinely deciding.

BRANCH_CONSTRAINTS:
Never speak negatively about the competitor.
If Sub-state A confirmed — stop. No recovery attempt.`;

    case 'objection_need_to_think':
      return `BRANCH_STATE: need_to_think

NEPQ_SEQUENCE:
Read the conversation history. Pick up where the sequence left off.

"Need to think about it" is almost always a proxy for something else. The critical question is Step 2.

Step 1 — Validate:
"That makes sense." Full stop. Do not push.

Step 2 — Curiosity question (THE most important step in this branch):
"What part of it is still on your mind?"
One question. Stop. Wait.

Step 3 — Route based on their answer:
Price concern → price branch
Timing → timing branch
Spouse involvement → spouse branch
Competitor → competitor branch
"I just want to make sure" / uncertainty → consequence question:
"Given what we found — what does that mean for you if it keeps sitting?"

Step 4 — Do not loop:
If they give another vague answer — one more gentle probe.
If still vague after two attempts — close warmly. Emit [DEAD].

BRANCH_CONSTRAINTS:
Never push back on "I need to think." Respect it and ask the one question.
Never tell them why they should decide now.${inspection_findings ? `\nInspection findings available as consequence context if relevant.` : ''}`;

    default:
      return null;
  }
}
