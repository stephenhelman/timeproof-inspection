// SCAFFOLD — Jordan Finance bot handler (JSON mode)
// Current production handler: handleFinanceWebhook in central/route.ts (string mode)
// Migration: when ready —
//   1. Implement assembleFinancePromptV2 in assemblers/finance-v2.ts
//   2. Implement handleFinanceWebhook below
//   3. Import it in central/route.ts replacing the inline function
//   4. Replace inline handleFinanceWebhook body with: return handleFinanceWebhook(ctx)

import type { Lead, SrLead } from '@prisma/client'
import type { BotContext, BotResponse } from '../prompts/qntum/types'
import { EMPTY_BOT_CONTEXT } from '../prompts/qntum/types'
import {
  runBot,
  readBotContextFromDb,
  writeBotContextToDb,
  getOrCreateThread,
  appendMessage,
  notifyRep,
} from '../bot-engine'
import { assembleFinancePromptV2 } from '../prompts/qntum/assemblers/finance-v2'

// Unused type references — present to surface migration shape, removed at implementation time
type _BotResponse = BotResponse
type _BotContext = BotContext
const _emptyCtx = EMPTY_BOT_CONTEXT

interface FinanceWebhookCtx {
  lead: Lead
  srLead: SrLead
  ghlContactId: string
  trigger: string
  inboundMsg: string
}

export async function handleFinanceWebhook(ctx: FinanceWebhookCtx): Promise<void> {
  // TODO — implement JSON mode finance handler
  // Pattern to follow: src/lib/bot-handlers/qualify.ts and handleFinanceWebhook in central/route.ts
  //
  // Steps:
  // 1. readBotContextFromDb(ghlContactId) — load accumulated context
  // 2. Load inspect data from DB: aiDiagnosisStructured, findingsNotes
  // 3. assembleFinancePromptV2(ctx) — build JSON mode system prompt
  // 4. runBot(systemPrompt, messages, { isJsonMode: true, maxTokens: 600, ghlContactId })
  // 5. Parse BotResponse
  // 6. writeBotContextToDb(ghlContactId, 'finance', response.bot_context)
  //    Note: response.bot_context.finance_paths_explored should accumulate explored options
  // 7. Route on response.signal:
  //    FINANCE_RETRY → addGhlTag sr_finance_ready + removeGhlTag sr_credit_fail
  //                    + prisma.task.create(FINANCE_REVIEW, assigned to finance manager)
  //                    + notifyRep with path summary
  //    FINANCE_DEAD  → transitionLead DEAD/silent + moveGhlOpportunityStage(GHL_STAGE_EXHAUSTED)
  //                    + prisma.task.create(REP_FOLLOWUP)
  //    ESCALATE      → notifyManager + updateSrLead silent
  // 8. If !stage_change && response.message → sendGhlSms(ghlContactId, response.message)
  void ctx
  void readBotContextFromDb
  void writeBotContextToDb
  void getOrCreateThread
  void appendMessage
  void notifyRep
  void assembleFinancePromptV2
  void runBot
  void _emptyCtx
  throw new Error('handleFinanceWebhook not yet implemented — scaffold only')
}
