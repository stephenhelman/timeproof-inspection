// SCAFFOLD — Jordan Reschedule bot handler (JSON mode)
// Current production handler: handleRescheduleWebhook in central/route.ts (string mode)
// Migration: when ready —
//   1. Implement assembleReschedulePromptV2 in assemblers/reschedule-v2.ts
//   2. Implement handleRescheduleWebhook below
//   3. Import it in central/route.ts replacing the inline function
//   4. Replace inline handleRescheduleWebhook body with: return handleRescheduleWebhook(ctx)
//   5. Parse response.rescheduled_slot instead of regex-matching [RESCHEDULED: ...]

import type { Lead, SrLead } from '@prisma/client'
import type { BotContext, BotResponse } from '../prompts/qntum/types'
import { EMPTY_BOT_CONTEXT } from '../prompts/qntum/types'
import {
  runBot,
  readBotContextFromDb,
  writeBotContextToDb,
  getAreaAppointments,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  getOrCreateThread,
  appendMessage,
  notifyRep,
} from '../bot-engine'
import { assembleReschedulePromptV2 } from '../prompts/qntum/assemblers/reschedule-v2'

// Unused type references — present to surface migration shape, removed at implementation time
type _BotResponse = BotResponse
type _BotContext = BotContext
const _emptyCtx = EMPTY_BOT_CONTEXT

interface RescheduleWebhookCtx {
  lead: Lead
  srLead: SrLead
  ghlContactId: string
  trigger: string
  inboundMsg: string
}

export async function handleRescheduleWebhook(ctx: RescheduleWebhookCtx): Promise<void> {
  // TODO — implement JSON mode reschedule handler
  // Pattern to follow: src/lib/bot-handlers/qualify.ts and handleRescheduleWebhook in central/route.ts
  //
  // Steps:
  // 1. readBotContextFromDb(ghlContactId) — load accumulated context
  // 2. getAvailableSlots(zone, isDistance, timePreference) — fetch live slots
  // 3. createSlotLock if no existing lock — same as current string-mode handler
  // 4. getAreaAppointments(zone) — proximity data
  // 5. assembleReschedulePromptV2(ctx) — build JSON mode system prompt
  // 6. runBot(systemPrompt, messages, { isJsonMode: true, maxTokens: 600, ghlContactId })
  // 7. Parse BotResponse
  // 8. writeBotContextToDb(ghlContactId, 'reschedule', response.bot_context)
  // 9. Route on response.signal:
  //    RESCHEDULED → validateSlotBeforeConfirm, createAppointmentWithInspection({ createdBy: 'JORDAN' })
  //                  + prisma.slotLock.deleteMany + transitionLead INSPECTION_SCHEDULED/silent
  //                  + notifyRep
  //    RE_QUALIFY  → transitionLead NEW/booking + addGhlTag sr_booking
  //    DEAD        → transitionLead DEAD/silent
  //    ESCALATE    → notifyManager + updateSrLead silent
  // 10. If !stage_change && response.message → sendGhlSms(ghlContactId, response.message)
  void ctx
  void readBotContextFromDb
  void writeBotContextToDb
  void getAreaAppointments
  void getAvailableSlots
  void createSlotLock
  void validateSlotBeforeConfirm
  void getOrCreateThread
  void appendMessage
  void notifyRep
  void assembleReschedulePromptV2
  void runBot
  void _emptyCtx
  throw new Error('handleRescheduleWebhook not yet implemented — scaffold only')
}
