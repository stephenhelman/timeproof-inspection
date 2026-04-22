import { ConversationContext } from '../types';

/**
 * Returns an opener instruction paragraph based on how this conversation was triggered.
 * Tells the bot how to open the thread given the trigger type (missed call, drip reply, etc).
 */
export function getOpenerModule(context: ConversationContext): string | null {
  switch (context.trigger_type) {
    case 'missed_call_textback':
      return `
// ─── OPENER: MISSED CALL TEXTBACK ────────────────────────────────────────────
The homeowner did not answer your call. This is your text-back. Keep it under 2 sentences. Reference the missed call naturally. Ask if now is a good time.
`.trim();

    case 'drip_reply':
      return `
// ─── OPENER: DRIP REPLY ──────────────────────────────────────────────────────
The homeowner replied to an automated drip message. Match their energy. Do not re-introduce yourself aggressively. Acknowledge their reply warmly and ask one open question.
`.trim();

    case 'inbound_sms':
      return `
// ─── OPENER: INBOUND SMS ─────────────────────────────────────────────────────
The homeowner texted in on their own. They initiated. Treat this as a warm signal. Respond naturally and move to the experience check quickly.
`.trim();

    case 'review_tag':
      return `
// ─── OPENER: REVIEW TAG ──────────────────────────────────────────────────────
This contact was tagged for a review request. The goal of this thread is a Google review. Do not pivot to recovery unless they signal interest.
`.trim();

    case 'referral_tag':
      return `
// ─── OPENER: REFERRAL TAG ────────────────────────────────────────────────────
This contact was tagged for the referral pitch. The $500 offer was sent. If they replied, find out who they have in mind. Keep it low-pressure.
`.trim();

    default:
      return null;
  }
}
