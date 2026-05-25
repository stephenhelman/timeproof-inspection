import type { RevivalContext } from '../types';

export function getRevivalMemoryModule(context: RevivalContext): string {
  const {
    lead_scenario, inspection_findings, days_since_appointment,
    outcome, decision_maker_present, primary_objection, dispo_notes
  } = context;

  let memory = `LEAD_CONTEXT:\n`;

  if (lead_scenario === 'report_complete_not_sold') {
    memory += `Full inspection completed. Homeowner was present for results. Did not move forward.\n`;

    if (inspection_findings) {
      memory += `\nWHAT WAS FOUND:\n${inspection_findings}\n\nThis is your most powerful context. Use ONE specific finding in your opener. Pick the most significant. Let that do the work.`;
    }

    if (days_since_appointment) {
      memory += `\nDays since inspection: ${days_since_appointment}.`;
      if (days_since_appointment > 30) {
        memory += ` The condition has not improved. Consequence question waiting to happen.`;
      }
    }

    if (primary_objection) {
      memory += `\nPRIMARY OBJECTION AT DEMO: ${primary_objection}. Do not lead with this. Let the conversation surface it. When it does, follow the ${primary_objection} branch.`;
    }

    if (decision_maker_present === false) {
      memory += `\nDECISION MAKER NOTE: Not all decision makers were present. May be why deal didn't close. Address if it surfaces — don't lead with it.`;
    }

    if (dispo_notes) {
      memory += `\nREP NOTES: ${dispo_notes}. Background context only — do not reference directly.`;
    }

  } else if (lead_scenario === 'report_complete_no_show') {
    memory += `Inspector arrived. Homeowner was not home. Partial/exterior report completed.`;
    if (inspection_findings) {
      memory += `\nOBSERVED FROM EXTERIOR:\n${inspection_findings}`;
    }
    memory += `\nDo not make homeowner feel guilty. Something came up. Find out if they still want to know what was found.`;

  } else {
    memory += `Inspector came out. Nobody was home. No access. No report completed.`;
    memory += `\nNo findings to reference. Start from curiosity — what made them interested, is that still relevant.`;
  }

  return memory;
}
