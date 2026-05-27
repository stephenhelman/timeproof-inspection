import type { QualifyContext } from '../types';

export function getQualifyMemoryModule(context: QualifyContext): string {
  const { roof_age, known_issues, last_inspected, decision_maker_home, has_strong_signal, previousBotContext } = context;

  const hasFormData = roof_age !== null || known_issues !== null;

  if (!hasFormData) {
    let noFormInstruction = `PRIOR_CONTEXT:
This homeowner came from a Facebook ad. No qualify form was completed. You have no data on their roof condition, age, or situation. Treat this as a blank slate — surface everything through conversation. Start with situation questions before anything else.`;
    if (previousBotContext) {
      noFormInstruction += `\n\nPrior context: "${previousBotContext}"`;
    }
    return noFormInstruction;
  }

  const issueList = known_issues && known_issues.length > 0
    ? known_issues.filter(i => i !== "I haven't noticed anything").join(', ')
    : null;

  const hasActiveIssues = issueList && issueList.length > 0;
  const isOldRoof = roof_age === '20+ years';
  const neverInspected = last_inspected === 'Never, as far as I know';
  const decisionMakerUncertain = decision_maker_home === 'No' || decision_maker_home === 'Not sure';

  let instruction = `PRIOR_CONTEXT:
This homeowner completed a qualify form before this conversation. Use this data to inform your questions invisibly — do not read it back to them like a checklist, and do not reference the form.`;

  if (has_strong_signal) {
    instruction += `

STRONG SIGNAL PRESENT — reference naturally if it fits the conversation, but only once:`;

    if (hasActiveIssues) {
      instruction += `
- Reported issues: ${issueList}. If they seem unaware of urgency, a single natural reference is permitted. Example register: "You mentioned noticing some ${known_issues![0].toLowerCase()} — how long has that been going on?" Use judgment — if the conversation is already moving well, let it flow without the reference.`;
    }

    if (isOldRoof) {
      instruction += `
- Roof age: 20+ years. Older roofs have a higher failure rate regardless of visible symptoms. You can acknowledge age if it comes up naturally, but do not lead with it.`;
    }

    if (neverInspected) {
      instruction += `
- Never professionally inspected. This is meaningful context for consequence questions.`;
    }
  } else {
    instruction += `

WEAK OR NEUTRAL SIGNAL — no strong indicators from form data. Treat this as discovery territory. Surface the situation through questions, not references.`;
  }

  if (decisionMakerUncertain) {
    instruction += `

DECISION MAKER FLAG: Homeowner indicated the decision maker may not be present. This must be resolved before [QUALIFIED] is emitted. Do not raise it early — wait until the conversation has built enough warmth. It should feel like a natural logistics question, not a screening question.`;
  }

  if (previousBotContext) {
    instruction += `\n\nPrior context: "${previousBotContext}"`;
  }

  return instruction;
}
