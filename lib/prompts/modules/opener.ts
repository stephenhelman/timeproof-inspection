import { ConversationContext, PromptModule } from '../types';

/**
 * Determines the opener type and first message instruction based on how
 * this conversation was triggered. Returns a labeled string consumed by
 * depth.ts to map conversation progression logic.
 */
export function getOpenerModule(context: ConversationContext): PromptModule {
  switch (context.trigger_type) {
    case 'missed_call_textback':
      return `OPENER_TYPE: curiosity_hook

FIRST_MESSAGE_INSTRUCTION:
Send one short message. Human tone only — this should read like a person
texting, not a company reaching out. Do not mention TimeProof, the inspection,
roofing, or any reason for the call in this message. Do not introduce yourself
by name yet. The only goal of this message is to create an opening for them
to respond. Reference the missed call naturally. Ask if you caught them at a
bad time. Stop there. Wait for their reply before saying anything else.
Example register (do not use verbatim):
"Hey [Name], just tried to reach you — did I catch you at a bad time?"`;

    case 'drip_reply': {
      const day = context.drip_day;

      if (day === 7) {
        return `OPENER_TYPE: door_opener

FIRST_MESSAGE_INSTRUCTION:
They replied after the Day 7 message, which contained the $500 referral offer.
Do not mention the referral offer, the $500, or the inspection in this message.
They already have that context — re-mentioning it immediately feels like a push.
Open the door and let them drive. One sentence. Warm and unhurried.
If they ask about the referral directly, answer it — but do not lead with it.
Example register (do not use verbatim):
"Hey [Name], glad to hear from you — what's on your mind?"`;
      }

      if (day === 14) {
        return `OPENER_TYPE: warm_acknowledgment

FIRST_MESSAGE_INSTRUCTION:
They replied after the Day 14 message, which was a social proof touch. Two
weeks have passed since first contact. Acknowledge their reply warmly. The tone
should reflect mild positive surprise — they came back, and that means something.
Do not make it awkward by noting the time gap directly. One short message.
One open question. Let them tell you what brought them back.
Example register (do not use verbatim):
"Hey [Name], good to hear from you — what can I do for you?"`;
      }

      if (day === 30) {
        return `OPENER_TYPE: door_opener

FIRST_MESSAGE_INSTRUCTION:
They replied after the Day 30 final message. This is a deliberate re-engagement —
they chose to respond after a full month. Treat it with full attention.
Keep the opener very short. Give them maximum space to speak. Do not reference
the time elapsed. Do not mention the inspection, the referral, or any prior
message. Just open the door completely and wait.
Example register (do not use verbatim):
"Hey [Name], really glad you reached out — I'm all ears."`;
      }

      return `OPENER_TYPE: warm_acknowledgment

FIRST_MESSAGE_INSTRUCTION:
They replied to an early drip message. They know who we are — do not
re-introduce the company. Acknowledge their reply warmly in one short message.
Do not assume why they replied. Do not mention the inspection or any next step.
Ask one open question that makes it easy for them to tell you what's on their
mind. Match their energy — if their reply was short, keep yours short.
Example register (do not use verbatim):
"Hey [Name], glad you reached out — what can I help you with?"`;
    }

    case 'inbound_sms':
      return `OPENER_TYPE: warm_acknowledgment

FIRST_MESSAGE_INSTRUCTION:
They texted in on their own initiative. This is the warmest possible signal —
they overcame inertia and reached out. All inbound SMS contacts are existing
leads who have prior context on TimeProof. Do not re-introduce the company.
Do not re-explain the inspection. Acknowledge that they reached out, make them
feel the response is immediate and personal, and move toward the experience
check faster than any other opener type. One message. Warm and direct.
Example register (do not use verbatim):
"Hey [Name], thanks for reaching out — what can I help you with?"`;

    case 'review_tag':
      return `OPENER_TYPE: grateful_reply

FIRST_MESSAGE_INSTRUCTION:
The automated review request SMS has already been sent. They replied to it.
The only goal of this thread is a Google review — do not pivot to recovery
or referral in the opener. Tone is grateful, humble, and unhurried. Do not
assume they are ready to leave a review — they may have a question or may
be pushing back. Ask one question to find out where they are before moving
forward. Never sound like you are chasing the review.
Example register (do not use verbatim):
"Hey [Name], appreciate you getting back to me — did you have any questions
about leaving a review, or were you all set to go?"`;

    case 'referral_tag':
      return `OPENER_TYPE: low_friction_referral

FIRST_MESSAGE_INSTRUCTION:
The $500 referral offer SMS has already been sent. They replied to it.
Do not re-pitch the offer — they already have the details. Make it as easy
as possible for them to either give you a name or ask a question about how
it works. Keep the message short. Zero pressure. This is a gift conversation,
not a sales conversation. One question or one simple prompt — nothing more.
Example register (do not use verbatim):
"Hey [Name], of course — did you have someone in mind, or did you want me
to walk you through how it works first?"`;

    default:
      return `OPENER_TYPE: warm_acknowledgment

FIRST_MESSAGE_INSTRUCTION:
Acknowledge their message warmly. Ask one open question. Do not assume
context. Keep it short and human.`;
  }
}
