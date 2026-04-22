export interface ConversationContext {
  trigger_type:
    | 'missed_call_textback'
    | 'drip_reply'
    | 'inbound_sms'
    | 'review_tag'
    | 'referral_tag';

  pipeline_stage:
    | 'Pending'
    | 'In_Dialer'
    | 'Drip_Pending'
    | 'Drip_Active'
    | 'Drip_Responded'
    | 'Recovered'
    | 'Refused'
    | 'Dead';

  /** Which drip message they replied to (1, 3, 7, 14, 30), or null if not a drip reply */
  drip_day: 1 | 3 | 7 | 14 | 30 | null;

  /** Total exchanges in this thread so far */
  message_history_count: number;

  last_message_context:
    | 'none'
    | 'expressed_interest'
    | 'price_objection'
    | 'used_competitor'
    | 'negative_experience'
    | 'insurance_mention'
    | 'referral_seeded'
    | 'review_requested'
    | 'escalation_needed';

  homeowner_name: string;
  address: string;
  zip_code: string;
}

export type PromptModule = string;
