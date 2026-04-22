import { ConversationContext, OpenerType, PromptModule } from '../types';

/**
 * Determines the current position in the conversation, the active
 * directive for this exchange, and the remaining runway before
 * escalation or warm close. Consumes opener type resolved by
 * assembler.ts from opener.ts output. Does not handle objection
 * content, tone, or referral logic — those belong to other modules.
 */
export function getDepthModule(
  context: ConversationContext,
  openerType: OpenerType
): PromptModule {
  const { message_history_count, last_message_context, pipeline_stage, drip_day } = context;

  // Override 1 — Hard stop
  if (last_message_context === 'escalation_needed') {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
The conversation requires a human. Send the escalation message exactly as written in master.ts and stop responding. Do not acknowledge any other content in the homeowner's message. Do not continue the conversation under any circumstances.

LENGTH_RULE:
No further exchanges. This thread is closed for AI response.`;
  }

  // Override 2 — Hard count limit
  if (message_history_count >= 10) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
This conversation has reached its maximum length. Send the escalation message and stop. Do not summarize the conversation. Do not explain why you are escalating. Just send the escalation message.

LENGTH_RULE:
No further exchanges.`;
  }

  // Override 3 — Recovered pipeline
  if (pipeline_stage === 'Recovered') {
    return `CONVERSATION_POSITION: mid_conversation

CURRENT_DIRECTIVE:
This homeowner has already been recovered and has an appointment scheduled. Do not run the revival sequence. Do not ask about their prior experience. Respond only to what they sent and assist with appointment context if needed. Keep it brief and warm.

LENGTH_RULE:
No defined limit. Respond as needed and close warmly when the exchange is complete.`;
  }

  // Override 4 — Negative experience early escalation
  if (last_message_context === 'negative_experience' && message_history_count >= 4) {
    return `CONVERSATION_POSITION: approaching_close

CURRENT_DIRECTIVE:
A negative experience has been surfaced. You have been in this conversation long enough to have gathered the key information. Offer to have someone from the team reach out directly. Warm, not defensive. Do not dig further.

LENGTH_RULE:
One or two exchanges remaining. Offer escalation and close.`;
  }

  // Override 5 — Insurance pushed past one exchange
  if (last_message_context === 'insurance_mention' && message_history_count >= 3) {
    return `CONVERSATION_POSITION: escalate_now

CURRENT_DIRECTIVE:
The homeowner has continued pressing on insurance specifics. This requires a human. Send the escalation message now. Do not attempt to answer insurance questions.

LENGTH_RULE:
No further exchanges.`;
  }

  // Threshold map (internal, not exported)
  type Thresholds = { opening_ends_at: number; approaching_close_at: number; hard_limit: number };

  const thresholdMap: Record<Exclude<OpenerType, 'door_opener'>, Thresholds> = {
    curiosity_hook:        { opening_ends_at: 2, approaching_close_at: 6, hard_limit: 8 },
    warm_acknowledgment:   { opening_ends_at: 1, approaching_close_at: 5, hard_limit: 7 },
    grateful_reply:        { opening_ends_at: 1, approaching_close_at: 3, hard_limit: 5 },
    low_friction_referral: { opening_ends_at: 1, approaching_close_at: 3, hard_limit: 5 },
  };

  let thresholds: Thresholds;

  if (openerType === 'door_opener') {
    if (drip_day === 7) {
      thresholds = { opening_ends_at: 1, approaching_close_at: 7, hard_limit: 9 };
    } else if (drip_day === 30) {
      thresholds = { opening_ends_at: 1, approaching_close_at: 4, hard_limit: 6 };
    } else {
      thresholds = { opening_ends_at: 1, approaching_close_at: 5, hard_limit: 7 };
    }
  } else {
    thresholds = thresholdMap[openerType];
  }

  const { opening_ends_at, approaching_close_at, hard_limit } = thresholds;

  // Position resolution
  let position: 'opening' | 'mid_conversation' | 'approaching_close' | 'escalate_now';

  if (message_history_count < opening_ends_at) {
    position = 'opening';
  } else if (message_history_count < approaching_close_at) {
    position = 'mid_conversation';
  } else if (message_history_count < hard_limit) {
    position = 'approaching_close';
  } else {
    position = 'escalate_now';
  }

  // Directives by position
  let directive: string;

  if (position === 'opening') {
    if (openerType === 'curiosity_hook' && message_history_count === 0) {
      directive = `You have not sent a message yet. Send the curiosity hook only — one short human message that creates an opening. Do not mention the company, the inspection, or any reason for the contact. Reference the missed call. Ask if you caught them at a bad time. Stop. Wait for their reply.`;
    } else if (openerType === 'curiosity_hook' && message_history_count === 1) {
      directive = `They replied to the curiosity hook. Now deliver the frame in one message. Introduce yourself by first name. Name the company as the roofing company that came out to their property. Reference the inspection briefly and naturally. Ask if they have a couple of minutes. Do not ask about their experience yet. One message. Stop.`;
    } else {
      directive = `You are in the opening exchange. Acknowledge their message naturally using the instruction from the opener module. Ask one open question. Do not move to the experience check yet. Wait for their response.`;
    }
  } else if (position === 'mid_conversation') {
    if (last_message_context === 'expressed_interest') {
      directive = `The homeowner has signaled they may be open to revisiting. Move carefully to the recovery offer. One question or one short offer — do not over-explain. Ask if a short ten-minute conversation would be worth their time. Let the question breathe.`;
    } else if (last_message_context === 'price_objection') {
      directive = `Price has been named as the reason they held off. Validate it fully before anything else. Then ask one curiosity question about it. Do not counter-offer. Do not justify or explain pricing. Understand the specific nature of the objection first.`;
    } else if (last_message_context === 'used_competitor') {
      directive = `They went with someone else. Validate that fully. Ask what made them go that direction. If the work is already done, acknowledge it warmly and begin moving toward close. If it is not done, ask how that is going and let them tell you.`;
    } else if (last_message_context === 'negative_experience') {
      directive = `A negative experience has been surfaced. Dig for specifics with genuine curiosity — this is valuable information, not a problem to manage. Do not get defensive. Ask what specifically fell short. This conversation can still end in a referral or a review.`;
    } else if (last_message_context === 'insurance_mention') {
      directive = `The homeowner has brought up insurance. Do not initiate further insurance discussion. Do not offer a second look or mention adjusters. If they mentioned a denial or partial claim, respond: we work directly with homeowners in that situation and ask what happened. If they are asking whether we work with insurance directly, respond: we work with homeowners rather than through insurance but depending on the situation there may be something we can do, then ask what happened with theirs. Stay at one exchange on this topic. If they push further, escalate.`;
    } else {
      directive = `You are in the core of the conversation. Work through the NEPQ stages in order. You should now be moving through the experience check, understanding why they did not move forward, and listening for the real reason. One question per message. Do not skip stages. Do not pitch anything yet.`;
    }
  } else if (position === 'approaching_close') {
    directive = `You are near the end of this conversation. If a recovery has not been secured, make one clean offer — a short ten-minute conversation to see if there is something that makes sense now. If they are not open, pivot to the Google review ask. Humble, not pushy. After the review ask or if they decline both, close warmly and stop. Do not re-open new topics.`;
  } else {
    directive = `This conversation has reached its natural limit. Send the escalation message. Do not continue. Do not summarize.`;
  }

  // Length rules by position
  let lengthRule: string;

  if (position === 'opening') {
    lengthRule = `You are at the start of this conversation. Full runway ahead. Do not rush the stages.`;
  } else if (position === 'mid_conversation') {
    const remaining = hard_limit - message_history_count;
    lengthRule = `You are in the active conversation. You have ${remaining} exchanges remaining before you should offer escalation or close warmly. Do not count down out loud. Just be aware of the pace.`;
  } else if (position === 'approaching_close') {
    lengthRule = `You are near the end of this conversation. One to two exchanges remaining. Move toward a clean resolution — recovery offer, review ask, or warm close. Do not start new topics.`;
  } else {
    lengthRule = `No further exchanges. Send the escalation message and stop.`;
  }

  return `CONVERSATION_POSITION: ${position}

CURRENT_DIRECTIVE:
${directive}

LENGTH_RULE:
${lengthRule}`;
}
