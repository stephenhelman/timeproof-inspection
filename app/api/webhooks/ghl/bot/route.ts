import { NextResponse } from 'next/server';
import { buildContext } from '@/lib/bot/context';
import { getOrCreateThread, updateThread } from '@/lib/bot/thread';
import { assemblePrompt } from '@/lib/prompts/assembler';
import { callClaude } from '@/lib/bot/claude';
import { sendSMS, updateContact, addTags } from '@/lib/bot/ghl';
import { checkEscalation } from '@/lib/bot/escalation';

/**
 * Receives conversation events from Fusion REI for tpusa contacts.
 * Verifies the request, builds conversation context, assembles the
 * Claude system prompt, calls the Claude API, sends the SMS reply
 * via GHL, and updates all contact fields and thread state.
 * Separate from the revival sync webhook at /api/webhooks/ghl.
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-ghl-secret');
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const customData: Record<string, string | null> | undefined = body?.customData;
  if (!customData) {
    return NextResponse.json({ error: 'customData is required' }, { status: 400 });
  }

  const contactId: string = customData.contactId ?? '';
  if (!contactId) {
    return NextResponse.json({ error: 'customData.contactId is required' }, { status: 400 });
  }

  // The homeowner's inbound message text — check top-level and customData fallbacks.
  const homeownerMessage: string =
    (body.message as string | undefined) ??
    customData.messageBody ??
    customData.body ??
    customData.smsBody ??
    '';

  try {
    // 1. Build typed conversation context from raw customData
    const context = buildContext(customData);

    // 2. Retrieve or create the persistent conversation thread
    const { threadId, messages, isNew } = await getOrCreateThread(contactId);

    // 3. Assemble the full Claude system prompt
    const systemPrompt = assemblePrompt(context);

    if (!systemPrompt || systemPrompt.trim().length === 0) {
      console.error('[route.ts] assemblePrompt returned empty string');
      throw new Error('System prompt assembly failed — empty result');
    }

    // 4. Append the current inbound message to thread history before calling Claude
    const messagesWithInbound = [
      ...messages,
      { role: 'user' as const, content: homeownerMessage },
    ];

    const cleanMessages = messagesWithInbound.filter(
      (m) => m.content && m.content.trim().length > 0
    );

    if (cleanMessages.length === 0) {
      console.error('[route.ts] No valid messages to send to Claude');
      return new Response(JSON.stringify({ error: 'No message content' }), {
        status: 400,
      });
    }

    // 5. Call Claude with system prompt and full message history including inbound
    const responseText = await callClaude(systemPrompt, cleanMessages);

    // 6. Send the SMS reply via GHL before writing any state
    await sendSMS(contactId, responseText);

    // 7. Persist both messages to the thread
    await updateThread(threadId, homeownerMessage, responseText);

    // 8. Update contact fields — botThreadId only written for new threads
    const contactUpdates: Parameters<typeof updateContact>[1] = {
      botMessageCount: context.message_history_count + 1,
      lastMessageContext: context.last_message_context,
      ...(isNew ? { botThreadId: threadId } : {}),
    };
    await updateContact(contactId, contactUpdates);

    // 9. Detect escalation and tag if triggered — always the last operation
    const escalated = checkEscalation(responseText);
    if (escalated) {
      await addTags(contactId, ['bot_paused', 'tpusa_escalated']);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[bot webhook] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
