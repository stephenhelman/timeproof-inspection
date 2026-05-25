import type { FinanceContext } from '../types';

// Finance discovery sequences — deeper sequences for specific option paths

export function getFinanceBranchModule(context: FinanceContext): string | null {
  const { last_message_context, options_surfaced } = context;

  switch (last_message_context) {

    case 'exploring_heloc':
      return `BRANCH_STATE: exploring_heloc

The homeowner has indicated they may have home equity. Do not name "HELOC" unless they did. Work through discovery questions.

Step 1 — Validate.
"That's worth looking into."

Step 2 — Curiosity question.
"Have you looked at what your equity position looks like right now?"
One question. Stop.

Step 3 — Route:
If they have equity and are open: ask about their bank relationship.
"Is that something you'd go through your current bank, or have you worked with other lenders before?"
If they're uncertain about equity: "Most lenders can give you a rough number pretty quickly — is that something you'd want to look into?"
If they've already tried equity-based lending and it failed: acknowledge and pivot to the next discovery target.

BRANCH_CONSTRAINTS:
Do not say "HELOC" unless they do.
Do not promise approval or estimate amounts.`;

    case 'exploring_credit_union':
      return `BRANCH_STATE: exploring_credit_union

The homeowner may have a credit union relationship or is open to one.

Step 1 — Validate.
"Credit unions are worth a look — they tend to have more flexibility than big banks."

Step 2 — Curiosity question.
"Have you worked with a local credit union before, or mostly traditional banks?"
One question. Stop.

Step 3 — Route:
If yes, credit union relationship: "Is that something you'd want to go back to them with?"
If no prior relationship: "A lot of people don't realize you can join most local credit unions just by living in the area — have you looked into that?"
If they've already tried: acknowledge and pivot.

BRANCH_CONSTRAINTS:
Do not promise credit union approval.
Do not name specific credit unions unless the homeowner does.`;

    case 'exploring_cosigner':
      return `BRANCH_STATE: exploring_cosigner

The homeowner may have a family member or close relationship who could co-sign.

Step 1 — Validate.
"That's an option some people use."

Step 2 — Curiosity question (gently — this is personal).
"Is there someone in your life who could be part of something like that?"
One question. Stop.

Step 3 — Route:
If yes and open: "Is that a conversation you've had, or would you need to talk through it with them?"
If uncertain: "No pressure — just want to make sure we've looked at everything available."
If no: acknowledge and pivot to next target.

BRANCH_CONSTRAINTS:
Be sensitive — this is the most personal option. Do not push.`;

    case 'exploring_staged':
      return `BRANCH_STATE: exploring_staged

The homeowner may be able to phase the work — address the most urgent areas first.

Step 1 — Validate.
"That's actually how a lot of projects go."

Step 2 — Curiosity question.
"Is there any version of this where we address the most urgent areas first and figure out the rest over time?"
One question. Stop.

Step 3 — Route:
If open to staged: "The most critical areas based on what we found were [finding]. Would it make sense to start there?"
If they need to see numbers first: "That's a conversation our team would need to have with you directly — would it help to set that up?"
Emit [FINANCE_RETRY] if they want to move forward on staged approach.

BRANCH_CONSTRAINTS:
Do not promise a specific staged-project price.
If they want numbers — route to rep, not Jordan.`;

    case 'exploring_other':
      return `BRANCH_STATE: exploring_other

The homeowner is open to options but the specific path isn't clear yet.

Continue working through the discovery register. Ask the next question that hasn't been covered.

${options_surfaced.length > 0
  ? `Already surfaced: ${options_surfaced.join(', ')}. Move to a path not yet explored.`
  : `No paths explored yet. Start with equity or timing questions.`}

One discovery question. Stop. Build the picture.

BRANCH_CONSTRAINTS:
Never name funding products directly.
One question per exchange.`;

    default:
      return null;
  }
}
