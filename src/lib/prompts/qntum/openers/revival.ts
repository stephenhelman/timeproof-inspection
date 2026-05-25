import type { RevivalContext } from '../types';

export function getRevivalOpenerModule(context: RevivalContext): string {
  const { message_history_count, lead_scenario, inspection_findings,
          primary_objection, days_since_appointment } = context;

  if (message_history_count > 0) {
    return `OPENER_INSTRUCTION:
Conversation in progress. Do not re-introduce. Pick up naturally. Follow depth module.`;
  }

  if (lead_scenario === 'report_complete_not_sold') {
    return `OPENER_TYPE: post_inspection_revival

FIRST_MESSAGE_INSTRUCTION:
Introduce yourself as Jordan with Qntum Roofing.

Your opener must reference ONE specific finding from the inspection. Not generic. Not "just checking in."

Then ask ONE consequence question — not a sales question. What does it mean for them that this is still sitting there?

${inspection_findings ? `Use findings from LEAD_CONTEXT. Pick most significant one.` : ''}
${days_since_appointment && days_since_appointment > 30 ? `Time has passed. The condition hasn't improved. This is implicit — don't state it directly.` : ''}
${primary_objection ? `Do not reference prior objection in opener. Let conversation surface it.` : ''}

Two sentences max. One question. Stop.

Example direction (do not use verbatim):
"Hey [firstName], this is Jordan with Qntum Roofing — reaching out on a different line. We found some [specific finding] when we were out there — has that been on your mind at all?"`;

  } else if (lead_scenario === 'report_complete_no_show') {
    return `OPENER_TYPE: no_show_revival

FIRST_MESSAGE_INSTRUCTION:
Introduce yourself as Jordan. Do not reference the missed appointment judgmentally.

Frame as: inspector was out, found something worth knowing, do they still want to hear what was found.

Two sentences max. One question. Stop.

Example direction:
"Hey [firstName], this is Jordan with Qntum Roofing — our inspector had a chance to look at the exterior when he was out. Found a couple things worth knowing about — still want to hear what he saw?"`;

  } else {
    return `OPENER_TYPE: no_report_revival

FIRST_MESSAGE_INSTRUCTION:
Introduce yourself as Jordan. No findings to reference — no access.

Acknowledge the company had been trying to connect without making it a complaint. Ask if they're still thinking about the roof.

Low pressure. Genuinely curious. Two sentences max. One question. Stop.

Example direction:
"Hey [firstName], this is Jordan with Qntum Roofing — looks like we weren't able to connect when we tried to get out there. Still thinking about getting the roof looked at?"`;
  }
}
