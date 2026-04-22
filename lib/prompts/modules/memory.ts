import { ConversationContext } from '../types';

/**
 * Returns a memory instruction based on which drip day triggered this reply.
 * Tells the bot what the homeowner has already seen so it doesn't repeat or re-pitch stale context.
 */
export function getMemoryModule(context: ConversationContext): string | null {
  switch (context.drip_day) {
    case null:
      return `
// ─── MEMORY: NO DRIP CONTEXT ─────────────────────────────────────────────────
No drip context. Fresh contact. No prior messages have been sent in this sequence.
`.trim();

    case 1:
    case 3:
      return `
// ─── MEMORY: EARLY DRIP (DAY ${context.drip_day}) ──────────────────────────────────────────
Early in the drip sequence. The referral offer has not yet been seeded in this drip. The full $500 referral pitch is available — deliver it naturally before closing.
`.trim();

    case 7:
      return `
// ─── MEMORY: DAY 7 DRIP ──────────────────────────────────────────────────────
The Day 7 message included the $500 referral offer. If the homeowner is replying to this message, they may be responding to that offer specifically. Acknowledge the offer naturally — do not re-pitch it cold. Ask if they have someone in mind.
`.trim();

    case 14:
      return `
// ─── MEMORY: DAY 14 DRIP ─────────────────────────────────────────────────────
A social proof message was sent on Day 14. This homeowner has seen multiple touches from us. Keep the re-introduction brief and warm — they are not a stranger.
`.trim();

    case 30:
      return `
// ─── MEMORY: DAY 30 DRIP ─────────────────────────────────────────────────────
This was the final message in the drip sequence. If the homeowner replied to this, treat it as a genuine signal of renewed interest. Give it full attention. Do not rush. Do not treat it as routine — this reply matters.
`.trim();

    default:
      return null;
  }
}
