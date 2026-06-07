// SCAFFOLD — Jordan Reschedule bot assembler for JSON mode (BotResponse contract)
// Current production assembler: assemblers/reschedule.ts (string mode)
// Migration: when ready, replace handleRescheduleWebhook in central/route.ts to:
//   1. Call assembleReschedulePromptV2 instead of assembleReschedulePrompt
//   2. Pass isJsonMode: true to runBot
//   3. Parse BotResponse instead of string signals
//   4. Use response.rescheduled_slot instead of regex-matching [RESCHEDULED: ...]

import type { BotContext, BotResponse, AreaAppointment } from '../types'

export interface RescheduleAssemblerContext {
  // Homeowner info
  homeowner_name: string
  first_name: string
  zone: string
  message_history_count: number

  // Current bot context from DB
  bot_context: BotContext

  // Area appointments for proximity angle
  area_appointments: AreaAppointment[]

  // Slot data
  available_slots: Array<{
    date: string
    time: string
    label: string
    zone_label: string
  }>
  locked_slot: { date: string; time: string; label: string } | null

  // Jordan-specific context
  reschedule_reason: string
  from_booking_stall: boolean
  has_pivoted_to_revival: boolean
  inspection_findings: string | null
  dispo_notes: string | null
}

// Unused type reference to satisfy import — removed at implementation time
type _BotResponse = BotResponse

export function assembleReschedulePromptV2(ctx: RescheduleAssemblerContext): string {
  // TODO — implement JSON mode prompt
  // Must instruct Claude to return BotResponse JSON only
  // Must include Jordan master identity
  // Must include reschedule conversation sequence
  // Must define signals:
  //   RESCHEDULED → stage_change: true, rescheduled_slot: "YYYY-MM-DD HH:MM"
  //   RE_QUALIFY  → stage_change: true (homeowner wants full re-demo)
  //   DEAD        → stage_change: true (won't rebook)
  //   ESCALATE    → notifyManager
  // Must include available_slots and locked_slot in prompt context
  void ctx
  throw new Error('assembleReschedulePromptV2 not yet implemented — scaffold only')
}
