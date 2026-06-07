// SCAFFOLD — Jordan Finance bot assembler for JSON mode (BotResponse contract)
// Current production assembler: assemblers/finance.ts (string mode)
// Migration: when ready, replace handleFinanceWebhook in central/route.ts to:
//   1. Call assembleFinancePromptV2 instead of assembleFinancePrompt
//   2. Pass isJsonMode: true to runBot
//   3. Parse BotResponse instead of string signals

import type { BotContext, BotResponse, AreaAppointment } from '../types'

export interface FinanceAssemblerContext {
  // Homeowner info
  homeowner_name: string
  first_name: string
  zone: string
  message_history_count: number

  // Current bot context from DB
  bot_context: BotContext

  // Area appointments for proximity angle (available for future use)
  area_appointments: AreaAppointment[]

  // Jordan-specific context
  lender_attempted: string | null
  options_surfaced: string[]
  inspection_findings: string | null
  days_since_appointment: number | null
  ai_diagnosis_structured: unknown | null
  dispo_notes: string | null
}

// Unused type reference to satisfy import — removed at implementation time
type _BotResponse = BotResponse

export function assembleFinancePromptV2(ctx: FinanceAssemblerContext): string {
  // TODO — implement JSON mode prompt
  // Must instruct Claude to return BotResponse JSON only
  // Must include Jordan master identity
  // Must include finance discovery conversation sequence
  // Must define signals:
  //   FINANCE_RETRY → stage_change: true (viable path identified — create FINANCE_REVIEW task)
  //   FINANCE_DEAD  → stage_change: true (no path found — create REP_FOLLOWUP task)
  //   ESCALATE      → notifyManager
  // Must surface and track options: heloc, credit_union, cosigner, staged_project, family, cash_out_refi
  // Must write explored options back to bot_context.finance_paths_explored
  void ctx
  throw new Error('assembleFinancePromptV2 not yet implemented — scaffold only')
}
