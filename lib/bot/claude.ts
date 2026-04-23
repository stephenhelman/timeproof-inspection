import { ClaudeMessage } from '@/lib/bot/thread';

/**
 * Calls the Anthropic Claude API with the assembled system prompt
 * and full conversation thread. Returns the AI response as a plain
 * string ready to send as SMS. Uses a 300 token ceiling to enforce
 * SMS-appropriate response length.
 */
export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set — Claude call skipped');
    return 'Hey, just wanted to follow up — is now a good time to connect?';
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API request failed with status ${response.status}`);
  }

  const data = await response.json() as { content: { text: string }[] };

  try {
    return data.content[0].text;
  } catch {
    throw new Error('Claude API response parsing failed');
  }
}
