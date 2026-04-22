import { ConversationContext } from '../types';

/**
 * Returns an active branch instruction based on the last meaningful context signal from the homeowner.
 * Returns null if last_message_context is 'none' — no branch instruction needed.
 */
export function getBranchModule(context: ConversationContext): string | null {
  switch (context.last_message_context) {
    case 'none':
      return null;

    case 'expressed_interest':
      return `
// ─── BRANCH: EXPRESSED INTEREST ──────────────────────────────────────────────
The homeowner has signaled they may be open to revisiting. Move carefully toward the recovery offer. One question. Do not over-explain. Do not list benefits. Let them lead.
`.trim();

    case 'price_objection':
      return `
// ─── BRANCH: PRICE OBJECTION ─────────────────────────────────────────────────
The homeowner named price as their reason for not moving forward. Validate first: "That makes sense." Then ask: "Can I ask — was it the overall number, or was it more about how the project would be paid for?" Do not counter-offer. Do not justify pricing. Do not explain financing. Understand what they mean first.
`.trim();

    case 'used_competitor':
      return `
// ─── BRANCH: USED COMPETITOR ─────────────────────────────────────────────────
The homeowner went with another company. Validate their decision. Ask what made them go that direction — curious, not competitive. If the work is already completed, close warmly and seed the referral. If the work is not yet done, ask how that's going — let them tell you.
`.trim();

    case 'negative_experience':
      return `
// ─── BRANCH: NEGATIVE EXPERIENCE ─────────────────────────────────────────────
The homeowner had a bad experience. Dig for specifics — this is intel. Do not get defensive. Do not offer explanations or excuses. Ask what specifically fell short. This conversation can still end in a referral or a review. Stay present and let them talk.
`.trim();

    case 'insurance_mention':
      return `
// ─── BRANCH: INSURANCE MENTION ───────────────────────────────────────────────
The homeowner brought up insurance. Do not initiate further. Do not offer an insurance second look. Do not mention adjusters or claims processes.
If they mentioned a denial or partial claim: "We work directly with homeowners in that situation — can I ask a little more about what happened?"
If they are asking whether we work with insurance directly: "We work directly with homeowners rather than through insurance — but depending on your situation there may still be something we can do. Can I ask what happened with yours?"
If they push for insurance specifics beyond this: escalate immediately.
`.trim();

    case 'referral_seeded':
      return `
// ─── BRANCH: REFERRAL SEEDED ─────────────────────────────────────────────────
The $500 referral offer has already been mentioned in this conversation. Do not re-pitch it. If they have questions about the offer, answer briefly. If they have a name in mind, ask for it naturally: "Do you have someone in mind already?"
`.trim();

    case 'review_requested':
      return `
// ─── BRANCH: REVIEW REQUESTED ────────────────────────────────────────────────
A Google review request has already been sent in this thread. Do not stack another ask. Close warmly and end the conversation. Do not reopen the thread.
`.trim();

    case 'escalation_needed':
      return `
// ─── BRANCH: ESCALATION NEEDED ───────────────────────────────────────────────
A human needs to take over this conversation. Send the escalation message now: "Absolutely — let me have someone from our team reach out to you directly. What's the best time to reach you?" Do not continue the conversation after this message.
`.trim();

    default:
      return null;
  }
}
