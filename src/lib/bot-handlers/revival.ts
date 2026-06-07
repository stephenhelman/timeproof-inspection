// SCAFFOLD — Jordan Revival bot handler (JSON mode)
// Current production handler: handleRevivalWebhook in central/route.ts (string mode)
// Migration: when ready —
//   1. Implement assembleRevivalPromptV2 in assemblers/revival-v2.ts
//   2. Implement handleRevivalWebhook below
//   3. Import it in central/route.ts replacing the inline function
//   4. Replace inline handleRevivalWebhook body with: return handleRevivalWebhook(ctx)
//   5. Add 'revival' case to inbound SMS switch in central/route.ts

import type { Lead, SrLead } from '@prisma/client'
import type { BotContext, BotResponse } from '../prompts/qntum/types'
import { EMPTY_BOT_CONTEXT } from '../prompts/qntum/types'
import {
  runBot,
  readBotContextFromDb,
  writeBotContextToDb,
  getAreaAppointments,
  getOrCreateThread,
  appendMessage,
} from '../bot-engine'
import { assembleRevivalPromptV2 } from '../prompts/qntum/assemblers/revival-v2'

// Unused type references — present to surface migration shape, removed at implementation time
type _BotResponse = BotResponse
type _BotContext = BotContext
const _emptyCtx = EMPTY_BOT_CONTEXT

interface RevivalWebhookCtx {
  lead: Lead
  srLead: SrLead
  ghlContactId: string
  trigger: string
  inboundMsg: string
}

export async function handleRevivalWebhook(ctx: RevivalWebhookCtx): Promise<void> {
  // TODO — implement JSON mode revival handler
  // Pattern to follow: src/lib/bot-handlers/qualify.ts
  //
  // Steps:
  // 1. readBotContextFromDb(ghlContactId) — load accumulated context
  // 2. getAreaAppointments(zone) — proximity data
  // 3. Load inspect data from DB: aiDiagnosisStructured, postDiagnosisAdmission, warningSignResponses
  // 4. assembleRevivalPromptV2(ctx) — build JSON mode system prompt
  // 5. runBot(systemPrompt, messages, { isJsonMode: true, maxTokens: 600, ghlContactId })
  // 6. Parse BotResponse
  // 7. writeBotContextToDb(ghlContactId, 'revival', response.bot_context)
  // 8. Mirror bot_context to GHL opportunity field — fire and forget
  // 9. Route on response.signal:
  //    RE_QUALIFY   → transitionLead + moveGhlOpportunityStage(GHL_STAGE_RE_QUALIFIED)
  //                   + createGhlOpportunity on Inspection pipeline at Appointment Set
  //    DEAD         → transitionLead to DEAD / silent
  //    ESCALATE     → notifyManager + updateSrLead silent
  // 10. If !stage_change && response.message → sendGhlSms(ghlContactId, response.message)
  // 11. If response.bot_context.referral_seed_planted → update thread metadata
  void ctx
  void readBotContextFromDb
  void writeBotContextToDb
  void getAreaAppointments
  void getOrCreateThread
  void appendMessage
  void assembleRevivalPromptV2
  void runBot
  void _emptyCtx
  throw new Error('handleRevivalWebhook not yet implemented — scaffold only')
}
