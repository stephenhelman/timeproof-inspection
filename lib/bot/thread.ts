// After adding the BotThread model below to prisma/schema.prisma, run:
//   npx prisma migrate dev --name add_bot_thread

import { prisma } from '@/src/lib/prisma';

export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Retrieves an existing BotThread for the contact, or creates a new one
 * with an empty message history. Returns the thread ID, the message
 * history array for Claude, and whether the thread was newly created.
 */
export async function getOrCreateThread(contactId: string): Promise<{
  threadId: string;
  messages: ClaudeMessage[];
  isNew: boolean;
}> {
  const existing = await prisma.botThread.findUnique({ where: { contactId } });

  if (existing) {
    return {
      threadId: existing.id,
      messages: existing.messages as ClaudeMessage[],
      isNew: false,
    };
  }

  const created = await prisma.botThread.create({
    data: { contactId, messages: [] },
  });

  return {
    threadId: created.id,
    messages: [],
    isNew: true,
  };
}

/**
 * Appends the homeowner's inbound message and the bot's response to
 * the thread's message history and persists it to Neon.
 */
export async function updateThread(
  threadId: string,
  homeownerMessage: string,
  botResponse: string
): Promise<void> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new Error(`BotThread ${threadId} not found`);

  const messages = thread.messages as ClaudeMessage[];
  const updated: ClaudeMessage[] = [
    ...messages,
    { role: 'user', content: homeownerMessage },
    { role: 'assistant', content: botResponse },
  ];

  await prisma.botThread.update({
    where: { id: threadId },
    data: { messages: updated },
  });
}
