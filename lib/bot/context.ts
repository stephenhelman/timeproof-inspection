import { ConversationContext } from '@/lib/prompts/types';

export type ContextResult = {
  context: ConversationContext;
  messageBody: string;
};

const VALID_TRIGGER_TYPES: ConversationContext['trigger_type'][] = [
  'missed_call_textback',
  'drip_reply',
  'inbound_sms',
  'review_tag',
  'referral_tag',
];

const VALID_PIPELINE_STAGES: ConversationContext['pipeline_stage'][] = [
  'Pending',
  'In_Dialer',
  'Drip_Pending',
  'Drip_Active',
  'Drip_Responded',
  'Recovered',
  'Refused',
  'Dead',
];

const VALID_LAST_MESSAGE_CONTEXTS: ConversationContext['last_message_context'][] = [
  'none',
  'expressed_interest',
  'price_objection',
  'used_competitor',
  'negative_experience',
  'insurance_mention',
  'referral_seeded',
  'review_requested',
  'escalation_needed',
];

/**
 * Converts raw Fusion webhook customData into a typed
 * ConversationContext. Handles string coercion, null safety,
 * and unknown value fallbacks for all union type fields.
 * Also extracts messageBody for use in the route handler.
 */
export function buildContext(data: Record<string, string | null>): ContextResult {
  const triggerType = VALID_TRIGGER_TYPES.includes(data.triggerType as ConversationContext['trigger_type'])
    ? (data.triggerType as ConversationContext['trigger_type'])
    : 'inbound_sms';

  const pipelineStage = VALID_PIPELINE_STAGES.includes(data.revivalStage as ConversationContext['pipeline_stage'])
    ? (data.revivalStage as ConversationContext['pipeline_stage'])
    : 'Pending';

  const dripDay = (() => {
    if (!data.dripDay) return null;
    const parsed = parseInt(data.dripDay, 10);
    if (isNaN(parsed)) return null;
    return parsed as ConversationContext['drip_day'];
  })();

  const messageHistoryCount = (() => {
    const parsed = parseInt(data.messageHistoryCount ?? '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  })();

  const lastMessageContext = VALID_LAST_MESSAGE_CONTEXTS.includes(
    data.lastMessageContext as ConversationContext['last_message_context']
  )
    ? (data.lastMessageContext as ConversationContext['last_message_context'])
    : 'none';

  const messageBody = data.messageBody ?? '';

  return {
    context: {
      trigger_type: triggerType,
      pipeline_stage: pipelineStage,
      drip_day: dripDay,
      message_history_count: messageHistoryCount,
      last_message_context: lastMessageContext,
      homeowner_name: data.homeownerName ?? '',
      address: data.address ?? '',
      zip_code: data.zipCode ?? '',
    },
    messageBody,
  };
}
