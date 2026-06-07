// SCAFFOLD — Jordan Revival bot assembler for JSON mode (BotResponse contract)
// Current production assembler: assemblers/revival.ts (string mode)
// Migration: when ready, replace handleRevivalWebhook in central/route.ts to:
//   1. Call assembleRevivalPromptV2 instead of assembleRevivalPrompt
//   2. Pass isJsonMode: true to runBot
//   3. Parse BotResponse instead of string signals

import type { BotContext, BotResponse, AreaAppointment } from '../types'

export interface RevivalAssemblerContext {
  // Homeowner info
  homeowner_name: string
  first_name: string
  zone: string
  message_history_count: number

  // Current bot context from DB
  bot_context: BotContext

  // Area appointments for proximity angle
  area_appointments: AreaAppointment[]

  // Jordan-specific context (these will be on bot_context in JSON mode)
  lead_scenario: string
  days_since_appointment: number | null
  inspection_findings: string | null
  ai_diagnosis_structured: unknown | null
  post_diagnosis_admission: string | null
  warning_sign_responses: unknown | null
  primary_objection: string | null
  dispo_notes: string | null
  referral_seed_planted: boolean
}

// Unused type reference to satisfy import — removed at implementation time
type _BotResponse = BotResponse

export function assembleRevivalPromptV2(ctx: RevivalAssemblerContext): string {
  // TODO — implement JSON mode prompt
  // Must instruct Claude to return BotResponse JSON only
  // Must include Jordan master identity
  // Must include NEPQ revival sequence
  // Must define signals: RE_QUALIFY (stage_change: true), DEAD (stage_change: true), ESCALATE
  // Must include referral seed logic
  // Must reference inspection findings and objection from bot_context
  void ctx
  throw new Error('assembleRevivalPromptV2 not yet implemented — scaffold only')
}
