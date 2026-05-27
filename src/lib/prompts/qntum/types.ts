import type { TimeOfDay } from '../../time-utils';

export type { TimeOfDay };
export type PromptModule = string;

export type BotType = 'qualify' | 'nurture' | 'book' | 'revival' | 'reschedule' | 'finance';

export type ConversationTrack =
  | 'problem_aware'
  | 'problem_unaware'
  | 'resistant'
  | 'warm';

// ─── QUALIFY ──────────────────────────────────────────────────────────────────

export type QualifyLastMessageContext =
  | 'none'
  | 'expressed_interest'
  | 'problem_confirmed'
  | 'problem_denied'
  | 'timing_objection'
  | 'decision_maker_issue'
  | 'financial_signal'
  | 'competitor_mention'
  | 'insurance_mention'
  | 'negative_experience'
  | 'stalling'
  | 'escalation_needed';

// Legacy alias used by existing qualify route
export type LastMessageContext = QualifyLastMessageContext;

export interface QualifyContext {
  bot_type: 'qualify';
  homeowner_name: string;
  first_name: string;
  source_zip: string;
  zone: string;
  message_history_count: number;
  last_message_context: QualifyLastMessageContext;
  conversation_track: ConversationTrack;

  // Form data — may be null if Facebook lead with no qualify form
  roof_age: string | null;
  known_issues: string[] | null;
  last_inspected: string | null;
  decision_maker_home: string | null;

  // Strong signal flag — set by assembler based on form data
  has_strong_signal: boolean;

  // Source context — affects qualify opener
  source: 'facebook-inspection' | 'facebook-guide' | 'door' | 'card' | null;
  came_from_nurture: boolean;
  scheduling_approved_pause: boolean;
}

// ─── NURTURE ──────────────────────────────────────────────────────────────────

export type NurtureLastMessageContext =
  | 'none'
  | 'intent_signal'
  | 'curious_engaged'
  | 'skeptical'
  | 'problem_mentioned'
  | 'no_problem_aware'
  | 'stalling'
  | 'not_interested';

export interface NurtureContext {
  bot_type: 'nurture';
  homeowner_name: string;
  first_name: string;
  source: 'facebook-guide' | 'door' | 'card' | 'organic';
  rep: string | null;
  message_history_count: number;
  last_message_context: NurtureLastMessageContext;

  // Guide form data
  roof_type: string | null;
  roof_age: string | null;
  issues_noticed: string[] | null;
  last_inspected: string | null;
  address: string | null;

  // Insight tracking
  used_insight_ids: string[];

  // Drip context — only set for Soft Close Nurture drip messages
  is_drip: boolean;
  drip_sequence_position: 1 | 2 | 3 | 4 | null;
}

// ─── BOOK ─────────────────────────────────────────────────────────────────────

export type BookLastMessageContext =
  | 'none'
  | 'address_provided'    // homeowner just gave their address
  | 'slot_accepted'
  | 'slot_rejected'
  | 'stall'
  | 'stall_followup'
  | 'needs_different_time'
  | 'confirmed'
  | 'escalation_needed';

export interface BookContext {
  bot_type: 'book';
  homeowner_name: string;
  first_name: string;
  source_zip: string;
  zone: string;
  message_history_count: number;
  last_message_context: BookLastMessageContext;

  available_slots: Array<{
    date: string;
    time: string;
    label: string;
    zone_label: string;
  }>;

  locked_slot: {
    date:  string;
    time:  string;
    label: string; // verbatim — used in confirmation SMS
  } | null;

  qualify_summary: {
    problem_confirmed:        boolean;
    specific_issue:           string | null;
    roof_age:                 string | null;
    decision_maker_confirmed: boolean;
  };

  trigger: 'qualified_handoff' | 'inbound_sms' | 'stall_followup';

  // Address collection state
  address_collected:   boolean;       // true once homeowner has provided address
  confirmed_address:   string | null; // the address they gave

  // Time-of-day preference detected from homeowner conversation
  time_preference:     TimeOfDay;
  specific_start_hour?: number;       // from "after X" pattern
}

// ─── REVIVAL ──────────────────────────────────────────────────────────────────

export type RevivalScenario =
  | 'report_complete_not_sold'
  | 'report_complete_no_show'
  | 'no_report_no_show';

export type RevivalLastMessageContext =
  | 'none'
  | 'expressed_interest'
  | 'objection_price'
  | 'objection_timing'
  | 'objection_spouse'
  | 'objection_competitor'
  | 'objection_need_to_think'
  | 'consequence_acknowledged'
  | 'referral_seeded'
  | 'not_interested'
  | 'escalation_needed';

export interface RevivalContext {
  bot_type: 'revival';
  homeowner_name: string;
  first_name: string;
  source_zip: string;
  zone: string;
  message_history_count: number;
  last_message_context: RevivalLastMessageContext;
  conversation_track: ConversationTrack;

  lead_scenario: RevivalScenario;
  inspection_completed: boolean;
  inspection_findings: string | null;
  days_since_appointment: number | null;

  outcome: 'demo_not_sold' | 'no_show' | 'porched' | null;
  decision_maker_present: boolean | null;
  primary_objection: string | null;
  dispo_notes: string | null;

  referral_seed_planted: boolean;
}

// ─── RESCHEDULE ───────────────────────────────────────────────────────────────

export type RescheduleReason =
  | 'cancelled_by_homeowner'
  | 'one_legger'
  | 'time_constraint'
  | 'porched'
  | 'rep_schedule_conflict'
  | 'weather'
  | 'booking_stall_exhausted'
  | 'other';

export type RescheduleLastMessageContext =
  | 'none'
  | 'slot_accepted'
  | 'slot_rejected'
  | 'stall'
  | 'confirmed'
  | 'wont_rebook'
  | 'discovery_engaged'
  | 'escalation_needed';

export interface RescheduleContext {
  bot_type: 'reschedule';
  homeowner_name: string;
  first_name: string;
  source_zip: string;
  zone: string;
  message_history_count: number;
  last_message_context: RescheduleLastMessageContext;

  available_slots: Array<{
    date: string;
    time: string;
    label: string;
    zone_label: string;
  }>;
  locked_slot: { date: string; time: string; label: string } | null;

  reschedule_reason: RescheduleReason;
  inspection_completed: boolean;
  inspection_findings: string | null;
  prior_outcome: string | null;
  dispo_notes: string | null;
  from_booking_stall: boolean;
  has_pivoted_to_revival: boolean;
}

// ─── FINANCE ──────────────────────────────────────────────────────────────────

export type FinanceLastMessageContext =
  | 'none'
  | 'open_to_options'
  | 'exploring_heloc'
  | 'exploring_credit_union'
  | 'exploring_cosigner'
  | 'exploring_staged'
  | 'exploring_other'
  | 'option_identified'
  | 'firmly_cant_proceed'
  | 'escalation_needed';

export interface FinanceContext {
  bot_type: 'finance';
  homeowner_name: string;
  first_name: string;
  source_zip: string;
  zone: string;
  message_history_count: number;
  last_message_context: FinanceLastMessageContext;

  inspection_findings: string | null;
  days_since_appointment: number | null;
  lender_attempted: string | null;
  dispo_notes: string | null;

  options_surfaced: string[];
}
