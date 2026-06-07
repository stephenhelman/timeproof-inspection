import type { FinanceContext } from '../types';

interface DiagnosisZone {
  zone?: string;
  findingType?: string;
  severity?: string;
}

interface AiDiagnosis {
  zones?: DiagnosisZone[];
  overallSeverity?: string;
  primaryConcern?: string;
}

export function getFinanceMemoryModule(context: FinanceContext): string {
  const {
    inspection_findings,
    days_since_appointment,
    lender_attempted,
    dispo_notes,
    ai_diagnosis_structured = null,
    options_surfaced,
  } = context;

  let memory = `FINANCE_CONTEXT:\n`;
  memory += `This homeowner already said yes. Do not treat this as a re-selling conversation. Do not re-sell the roof. Your only job is to help them discover a path forward through questions.\n`;

  if (inspection_findings) {
    memory += `\nINSPECTION FINDINGS (consequence context — use sparingly, they already know):\n${inspection_findings}\n`;
  }

  // Structured diagnosis — use severity and primary concern for implicit consequence framing
  const diag = ai_diagnosis_structured as AiDiagnosis | null;
  if (diag?.primaryConcern || diag?.overallSeverity) {
    memory += `\nSEVERITY CONTEXT (implicit only — do not quote directly):\n`;
    if (diag.primaryConcern) memory += `Primary concern: ${diag.primaryConcern}\n`;
    if (diag.overallSeverity) memory += `Overall severity: ${diag.overallSeverity}\n`;
    if (diag.zones && diag.zones.length > 0) {
      const highSeverity = diag.zones.filter((z) => z.severity === 'high' || z.severity === 'critical');
      if (highSeverity.length > 0) {
        memory += `High/critical zones: ${highSeverity.map((z) => [z.zone, z.findingType].filter(Boolean).join(' — ')).join('; ')}\n`;
      }
    }
    memory += `Use this to understand the weight of the situation — not to pressure.\n`;
  }

  if (days_since_appointment !== null) {
    memory += `\nDays since inspection: ${days_since_appointment}.`;
    if (days_since_appointment > 30) {
      memory += ` Time is passing — the condition isn't improving. Use this as implicit context only.`;
    }
  }

  if (lender_attempted) {
    memory += `\nLENDER ATTEMPTED: ${lender_attempted}. Do not suggest they try this lender again.\n`;
  }

  if (dispo_notes) {
    memory += `\nRep notes: ${dispo_notes}. Background only — do not reference directly.\n`;
  }

  // Options surfaced — prevent re-raising paths already discussed
  if (options_surfaced.length > 0) {
    memory += `\nOPTIONS ALREADY SURFACED: ${options_surfaced.join(', ')}. Do not re-raise these paths — they've been discussed.\n`;
  }

  // Discovery question register
  memory += `
DISCOVERY_QUESTION_REGISTER:
These questions surface funding paths without naming them directly. Adapt — never use verbatim.

Equity:
"Do you have equity in the home — have you looked at any options tied to that?"

Credit unions:
"Have you worked with a local credit union before, or mostly traditional banks?"

Family:
"Is this something where family could be part of the picture at all?"

Staged project:
"Is there any version of this where we address the most urgent areas first and phase the rest?"

Timing:
"Is there anything coming up — a bonus, a tax return — where the timing might open up?"

DISCOVERY_TARGETS (never name directly — surface through questions):
- HELOC (home equity line of credit)
- Credit union personal loan
- Co-signer
- Cash-out refinance
- Staged project (phase the work)
- Family contribution
- Timing shift (bonus, tax return)
- Insurance angle (only if homeowner brings it up)

PROHIBITED:
Never suggest financing options directly.
Never reference the failed lender again.
Never re-sell the roof — they already made the decision.
Never promise approval or specific rates.`;

  return memory;
}
