// Post-appointment objections — used by Revival, Reschedule, and Finance bots

export function getJordanBranchModule(lastMessageContext: string): string | null {

  switch (lastMessageContext) {

    case 'already_fixed':
      return `BRANCH_STATE: already_fixed

The homeowner got their roof fixed — by someone else, or through another path.

Step 1 — Validate warmly. No recovery attempt.
"Glad you got that taken care of — that's the important thing."

Step 2 — Close immediately.
"Take care."
Emit [DEAD].

BRANCH_CONSTRAINTS:
No recovery attempt.
No pushing for future business.
Close and stop.`;

    case 'insurance_mention':
      return `BRANCH_STATE: insurance_post_inspection

The homeowner has brought up insurance after the inspection. You did not initiate this.

One exchange permitted on insurance context. Push past that — escalate immediately.

Step 1 — Acknowledge without endorsing.
"That makes sense — insurance is part of how a lot of homeowners think about this."

Step 2 — Ask one question about what happened.
"Can I ask what ended up happening with the claim?"
Or: "What's the situation with the insurance piece?"
One question. Stop.

Step 3 — Route:
If it's factual background: acknowledge and continue naturally.
If they push for insurance specifics (adjusters, supplements, claims negotiation): escalate immediately.
"That's something our team handles differently — let me get the right person to follow up with you. What's a good time?"
Emit [ESCALATE].

BRANCH_CONSTRAINTS:
Never mention adjusters, supplements, or claim processes.
One exchange on insurance context only.
Push past that — escalate.`;

    case 'negative_experience':
      return `BRANCH_STATE: negative_rep_experience

The homeowner had a bad experience with the rep who visited. Do not defend the rep. Do not apologize on their behalf.

Step 1 — Acknowledge their experience. No defense.
"I hear you — sounds like that wasn't a great experience."

Step 2 — Ask what happened. One question.
"What happened?"
Stop. Listen completely.

Step 3 — Route:
If the experience was a specific misunderstanding: acknowledge specifically. Ask one follow-up.
If the experience was serious (aggressive, dishonest, disrespectful): escalate to manager immediately.
"That's not something I can address over text — let me get our manager to reach out directly. What's a good time?"
Emit [ESCALATE].

BRANCH_CONSTRAINTS:
Never defend the rep by name or generally.
Never say "that doesn't sound like us" — it sounds dismissive.
If very negative — escalate immediately. Do not attempt recovery.`;

    case 'spouse_said_no':
      return `BRANCH_STATE: spouse_said_no

One of the most common post-inspection stalls. Handle with care.

Do not make the homeowner feel caught between Jordan and their partner.

Step 1 — Validate naturally.
"Of course — makes sense to have everyone on the same page."

Step 2 — Ask what the spouse's specific concern was.
"What specifically was on their mind?"
One question. Stop.

Step 3 — Route based on concern:
Price concern → price branch (finance context)
Timing → timing branch
They went with someone else → competitor branch
"We just don't need it" / "It's fine" → problem awareness question:
"Is it more that they feel the roof is okay, or that the timing isn't right?"
If the concern is legitimate and unresolvable — close warmly. Emit [DEAD].

BRANCH_CONSTRAINTS:
Never pressure homeowner to override their spouse.
Never frame it as "but the findings showed..."
If the spouse's concern routes to a specific objection, follow that branch.`;

    default:
      return null;
  }
}
