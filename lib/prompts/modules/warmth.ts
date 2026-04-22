import type { ConversationContext, PromptModule } from '../types';

/**
 * Returns a warmth calibration instruction based on pipeline_stage.
 * Tells the AI how familiar this homeowner is with TimeProof and
 * what level of social warmth to bring into the conversation.
 * Does not handle conversation flow, objections, or message content.
 */
export function getWarmthModule(context: ConversationContext): PromptModule {
  let instruction: string;

  switch (context.pipeline_stage) {
    case 'Pending':
      instruction = `This is a cold contact. The homeowner has had no meaningful interaction with TimeProof since the original inspection. Do not assume any familiarity. Introduce the company context naturally when the frame is delivered. Treat this as a first real conversation.`;
      break;

    case 'In_Dialer':
      instruction = `This contact has received call attempts over up to five days but has not answered. From their perspective they may have seen missed calls from an unfamiliar number. They have no confirmed awareness of who has been calling. Treat this as a cold contact. Do not reference the missed calls as a series — only the most recent one if relevant.`;
      break;

    case 'Drip_Pending':
      instruction = `This contact has not yet entered the drip sequence. Five days of call attempts went unanswered. No messaging has been sent yet. Cold contact. Full introduction is appropriate when the frame is delivered.`;
      break;

    case 'Drip_Active':
      instruction = `This homeowner has received at least one drip message. They know the outreach is from a roofing company following up on a past inspection. They have not replied but they have been receiving messages. Treat them as aware but not yet engaged. Skip heavy re-introduction — they have context. Moderate warmth.`;
      break;

    case 'Drip_Responded':
      instruction = `This homeowner has replied to a drip message at some point. They are actively engaged. They know who we are. Skip re-introduction entirely. Treat this as a warm conversation already in progress. Match their energy and move forward naturally.`;
      break;

    case 'Recovered':
      instruction = `This homeowner has already been recovered and has an appointment scheduled. depth.ts handles this with a full override. Approach with warmth appropriate for a confirmed appointment — helpful, brief, no revival language.`;
      break;

    case 'Refused':
      instruction = `This homeowner previously told a rep they were not interested. They said no. Be completely honest with yourself about that context. Do not approach this conversation with any recovery agenda unless they signal openness themselves. If they are re-engaging it is on their terms — they may have changed their mind, they may have a referral, or they may be open to leaving a review. Let them lead entirely. Maximum respect. Zero pressure. Do not pitch anything unless they open the door first.`;
      break;

    case 'Dead':
      instruction = `This contact did not respond through the full 30-day drip sequence. If they are re-engaging now it is a completely voluntary signal on their part. Treat it with genuine appreciation. Zero agenda. Zero pressure. Be present and responsive to whatever they bring. Do not reference the length of time that has passed. Do not mention the drip sequence. Just be a person responding to another person who reached out.`;
      break;

    default:
      instruction = `Treat as an active contact with some prior context. Moderate warmth.`;
      break;
  }

  return `WARMTH_CALIBRATION:\n${instruction}`;
}
