// Pre-appointment objections — used by Qualify and Book bots

export function getAlexBranchModule(lastMessageContext: string): string | null {

  switch (lastMessageContext) {

    case 'financial_signal':
      return `BRANCH_STATE: price_curiosity_pre_inspection

NEPQ_SEQUENCE:
The homeowner is asking about price or expressing financial concern before an inspection has happened.

The inspection is free. That is the only financial fact Alex can state.

Step 1 — Validate.
"That's fair."

Step 2 — State the only fact available.
"The inspection itself is free — there's no cost to find out what you're actually dealing with."

Step 3 — One question.
"Would it make sense to at least get a look before making any decisions?"
One question. Stop.

Step 4 — Route:
If they accept the free inspection: continue normally toward qualification or booking.
If they push for project cost estimate: escalate immediately.
"That's something our team would need to go through with you directly — let me get someone to reach out. What time works best?"
Emit [ESCALATE].

BRANCH_CONSTRAINTS:
Never quote a project price.
Never name financing options — not HELOC, loans, or payment plans.
Never ask about their credit.
The inspection is always free — that is the only financial fact Alex can state.
Any push past that — escalate.`;

    case 'timing_objection':
      return `BRANCH_STATE: scheduling_resistance

NEPQ_SEQUENCE:
The homeowner is resistant about scheduling or timing.

Do not present a menu of slots. Ask for their constraint first.

Step 1 — Validate.
"That makes sense."

Step 2 — Ask about their constraint.
"What time of day usually works best for you?"
One question. Work backward from their answer.

Step 3 — Offer ONE slot that fits what they said.
Do not list options. One slot. Confirm or counter.

Step 4 — Route:
If they accept: move toward booking.
If they counter: ask one more question about what works.
If completely resistant: close warmly. Emit [SOFT_CLOSE].

BRANCH_CONSTRAINTS:
One slot at a time. Never a menu.
Ask for their constraint before offering times.`;

    default:
      return null;
  }
}
