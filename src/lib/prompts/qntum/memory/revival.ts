import type { RevivalContext } from '../types';

interface DiagnosisZone {
  zone?: string;
  findingType?: string;
  severity?: string;
  confidence?: string;
  referencedWarningSign?: string;
}

interface AiDiagnosis {
  zones?: DiagnosisZone[];
  overallSeverity?: string;
  primaryConcern?: string;
  homeownerAdmissions?: string[];
}

export function getRevivalMemoryModule(context: RevivalContext): string {
  const {
    lead_scenario, inspection_findings, days_since_appointment,
    ai_diagnosis_structured = null, post_diagnosis_admission = null, warning_sign_responses = null,
    outcome, decision_maker_present, primary_objection, dispo_notes
  } = context;

  let memory = `LEAD_CONTEXT:\n`;

  if (lead_scenario === 'report_complete_not_sold') {
    memory += `Full inspection completed. Homeowner was present for results. Did not move forward.\n`;

    if (inspection_findings) {
      memory += `\nWHAT WAS FOUND:\n${inspection_findings}\n\nThis is your most powerful context. Use ONE specific finding in your opener. Pick the most significant. Let that do the work.`;
    }

    // Structured AI diagnosis — zone-level detail
    const diag = ai_diagnosis_structured as AiDiagnosis | null;
    if (diag?.zones && diag.zones.length > 0) {
      memory += `\n\nAI DIAGNOSIS (structured):\n`;
      if (diag.primaryConcern) memory += `Primary concern: ${diag.primaryConcern}\n`;
      if (diag.overallSeverity) memory += `Overall severity: ${diag.overallSeverity}\n`;
      memory += `Zones:\n`;
      for (const z of diag.zones) {
        const parts = [z.zone, z.findingType, z.severity ? `severity: ${z.severity}` : null, z.confidence ? `confidence: ${z.confidence}` : null].filter(Boolean);
        memory += `  - ${parts.join(' | ')}`;
        if (z.referencedWarningSign) memory += ` (linked: ${z.referencedWarningSign})`;
        memory += `\n`;
      }
      if (diag.homeownerAdmissions && diag.homeownerAdmissions.length > 0) {
        memory += `Homeowner admitted: ${diag.homeownerAdmissions.join('; ')}\n`;
      }
    }

    // Post-diagnosis admission — homeowner's own words after seeing the report
    if (post_diagnosis_admission) {
      memory += `\nHOMEOWNER ADMISSION (after seeing report): "${post_diagnosis_admission}"\nThey know. Use this to re-anchor — not as a gotcha.`;
    }

    // Warning sign responses
    if (warning_sign_responses && Object.keys(warning_sign_responses).length > 0) {
      const yesWarnings = Object.entries(warning_sign_responses)
        .filter(([, v]) => v === true || v === 'yes')
        .map(([k]) => k);
      if (yesWarnings.length > 0) {
        memory += `\nWARNING SIGNS CONFIRMED BY HOMEOWNER: ${yesWarnings.join(', ')}. These are their words, not yours.`;
      }
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
