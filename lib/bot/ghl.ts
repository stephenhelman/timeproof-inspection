const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

function ghlHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export type ContactUpdates = {
  botMessageCount?: number;
  lastMessageContext?: string;
  botThreadId?: string;
};

/**
 * Sends an SMS to the contact via the GHL REST API.
 */
export async function sendSMS(contactId: string, message: string): Promise<void> {
  const res = await fetch(`${GHL_BASE_URL}/conversations/messages`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message,
    }),
  });

  if (!res.ok) {
    throw new Error(`sendSMS failed with status ${res.status}`);
  }
}

/**
 * Updates custom fields on a GHL contact. Only sends fields that are
 * present in the updates object — undefined values are excluded.
 */
export async function updateContact(
  contactId: string,
  updates: ContactUpdates
): Promise<void> {
  const customField: Record<string, string | number> = {};

  if (updates.botMessageCount !== undefined) customField['botMessageCount'] = updates.botMessageCount;
  if (updates.lastMessageContext !== undefined) customField['lastMessageContext'] = updates.lastMessageContext;
  if (updates.botThreadId !== undefined) customField['botThreadId'] = updates.botThreadId;

  if (Object.keys(customField).length === 0) return;

  const res = await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders(),
    body: JSON.stringify({ customField }),
  });

  if (!res.ok) {
    throw new Error(`updateContact failed with status ${res.status}`);
  }
}

/**
 * Adds tags to a GHL contact.
 */
export async function addTags(contactId: string, tags: string[]): Promise<void> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({ tags }),
  });

  if (!res.ok) {
    throw new Error(`addTags failed with status ${res.status}`);
  }
}
