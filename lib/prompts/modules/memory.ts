import type { ConversationContext, PromptModule } from '../types';

/**
 * Returns a prior context instruction based on drip_day and
 * trigger_type. Tells the AI what this homeowner has already
 * seen in the outreach sequence so it never treats known
 * information as new. Does not instruct how to handle objections
 * or referral conversations — those belong to branch.ts.
 */
export function getMemoryModule(context: ConversationContext): PromptModule {
  if (context.trigger_type !== 'drip_reply') {
    return `PRIOR_CONTEXT:\nNo drip messages have been sent to this contact. This is a fresh outreach — either a missed call text-back, an inbound message from the homeowner, or a tagged automation. Do not reference any prior drip sequence. Treat this as the first written contact.`;
  }

  let instruction: string;

  switch (context.drip_day) {
    case 1:
    case null:
      instruction = `This homeowner received the Day 1 drip message — a soft re-introduction referencing the prior inspection. This is the first message they have received from us in the drip sequence. They know we are following up on an inspection. That is the full extent of their prior context. The referral offer has not been mentioned yet.`;
      break;

    case 3:
      instruction = `This homeowner has received two drip messages — the Day 1 re-introduction and the Day 3 value touch. The outreach has been low pressure across both messages. They have seen that we are not aggressive. The referral offer has not been mentioned yet.`;
      break;

    case 7:
      instruction = `This homeowner has received three drip messages including the Day 7 message which contained the $500 referral offer. They have seen the referral offer. Do not present it as new information. Do not re-pitch it. If they are replying to this message the referral may be what brought them back — but do not assume that. Let them tell you. If they ask about the referral directly, answer it simply. The details of how to handle that conversation belong to branch.ts if last_message_context is set to referral_seeded.`;
      break;

    case 14:
      instruction = `This homeowner has received four drip messages. The Day 14 message referenced social proof — homes in the El Paso area that have moved forward with TimeProof. They have seen that others in their area have made decisions. They have also seen the referral offer from Day 7. Do not re-pitch either. They have had four low-pressure touches over two weeks. They are familiar with who we are.`;
      break;

    case 30:
      instruction = `This homeowner has received all five drip messages over 30 days. They have seen the full sequence including the soft re-introduction, the value touch, the $500 referral offer, the social proof message, and the final genuine close. They chose to reply after all of that. That is a deliberate signal. They know who we are, they know about the referral offer, and they decided to reach out anyway. Carry that full context into the conversation. Do not re-introduce anything from the sequence. Just be present and let them lead.`;
      break;

    default:
      instruction = `This homeowner has received at least one drip message but the specific day is unknown. Treat as a Day 1 contact — minimal prior context, referral not yet seeded.`;
      break;
  }

  return `PRIOR_CONTEXT:\n${instruction}`;
}
