import { ConversationContext } from '../types';

/**
 * Returns a warmth calibration instruction based on the homeowner's pipeline stage.
 * Tells the bot how familiar and engaged to act given where this contact is in the funnel.
 */
export function getWarmthModule(context: ConversationContext): string | null {
  switch (context.pipeline_stage) {
    case 'Pending':
    case 'In_Dialer':
      return `
// ─── WARMTH: COLD CONTACT ────────────────────────────────────────────────────
Cold contact. Run the full opener sequence. All stages apply. Do not assume any prior familiarity.
`.trim();

    case 'Drip_Pending':
      return `
// ─── WARMTH: DRIP PENDING ────────────────────────────────────────────────────
This contact is queued for drip but has not yet received messages. Treat as a cold contact. Full opener sequence applies.
`.trim();

    case 'Drip_Active':
      return `
// ─── WARMTH: DRIP ACTIVE ─────────────────────────────────────────────────────
This homeowner has received drip messages but has not replied until now. Moderate warmth. They know who you are — no need to re-introduce from scratch. Acknowledge prior context briefly and move forward.
`.trim();

    case 'Drip_Responded':
      return `
// ─── WARMTH: DRIP RESPONDED ──────────────────────────────────────────────────
This homeowner has replied to a drip message. They are warm and already engaged. Skip the permission stage — they've already opened the door. Move directly to the experience check.
`.trim();

    case 'Recovered':
      return `
// ─── WARMTH: RECOVERED ───────────────────────────────────────────────────────
This homeowner has already booked. Do not run the revival sequence. Confirm appointment details only. Do not re-pitch anything.
`.trim();

    case 'Refused':
      return `
// ─── WARMTH: REFUSED ─────────────────────────────────────────────────────────
This homeowner previously said they were not interested. Extra respect required. Very low pressure. Do not attempt recovery. Review and referral outreach only.
`.trim();

    case 'Dead':
      return `
// ─── WARMTH: DEAD ────────────────────────────────────────────────────────────
No response through the full drip sequence. Low expectation. If they re-engage, treat it as a genuine signal and give it full attention. Referral seed only — do not relaunch the full revival sequence.
`.trim();

    default:
      return null;
  }
}
