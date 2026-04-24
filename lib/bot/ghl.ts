const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-04-15';

function getHeaders(): Record<string, string> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    console.error('[ghl.ts] GHL_API_KEY is not set');
  }
  return {
    'Authorization': `Bearer ${apiKey ?? ''}`,
    'Content-Type': 'application/json',
    'Version': GHL_VERSION,
  };
}

async function ghlFetch(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${GHL_BASE_URL}${path}`;
  console.log('[ghl.ts]', method, path);

  const res = await fetch(url, {
    method,
    headers: getHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[ghl.ts] ${method} ${path} failed with status ${res.status}:`, errorBody);
    throw new Error(
      `GHL API ${method} ${path} failed with status ${res.status}: ${errorBody}`
    );
  }

  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactFieldUpdates = {
  botMessageCount?: number;
  lastMessageContext?: string;
  botThreadId?: string;
  revivalStage?: string;
  dripDay?: number;
  conversationId?: string;
};

export type GHLContact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address1?: string;
  postalCode?: string;
  customField?: Record<string, unknown>;
  tags?: string[];
};

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Sends an SMS via GHL. Requires a conversationId — the v2
 * /conversations/messages endpoint does not accept contactId in the body.
 * Call getConversation (or createConversation) before calling this.
 */
export async function sendSMS(
  contactId: string,
  message: string,
  conversationId?: string
): Promise<void> {
  console.log('[ghl.ts] sendSMS →', { contactId, messageLength: message.length });

  if (!conversationId) {
    console.error(
      '[ghl.ts] sendSMS called without conversationId —',
      'cannot send SMS without a valid conversation.',
      'contactId:', contactId
    );
    throw new Error(
      'sendSMS requires a conversationId. ' +
      'getConversation must be called first.'
    );
  }

  await ghlFetch('/conversations/messages', 'POST', { type: 'SMS', conversationId, message });
}

/**
 * Updates custom fields on a GHL contact. Skips the API call if no
 * fields are defined to avoid sending an empty payload.
 */
export async function updateContactFields(
  contactId: string,
  fields: ContactFieldUpdates
): Promise<void> {
  console.log('[ghl.ts] updateContactFields →', { contactId, fields });

  const customField: Record<string, string | number> = {};

  if (fields.botMessageCount !== undefined) customField['botMessageCount'] = fields.botMessageCount;
  if (fields.lastMessageContext !== undefined) customField['lastMessageContext'] = fields.lastMessageContext;
  if (fields.botThreadId !== undefined) customField['botThreadId'] = fields.botThreadId;
  if (fields.revivalStage !== undefined) customField['revivalStage'] = fields.revivalStage;
  if (fields.dripDay !== undefined) customField['dripDay'] = fields.dripDay;
  if (fields.conversationId !== undefined) customField['conversationId'] = fields.conversationId;

  if (Object.keys(customField).length === 0) {
    console.warn('[ghl.ts] updateContactFields called with no defined fields — skipping');
    return;
  }

  await ghlFetch(`/contacts/${contactId}`, 'PUT', { customField });
}

/**
 * Adds tags to a GHL contact.
 */
export async function addTags(contactId: string, tags: string[]): Promise<void> {
  console.log('[ghl.ts] addTags →', { contactId, tags });

  if (tags.length === 0) {
    console.warn('[ghl.ts] addTags called with empty tags array — skipping');
    return;
  }

  await ghlFetch(`/contacts/${contactId}/tags`, 'POST', { tags });
}

/**
 * Removes tags from a GHL contact. Available for when a rep manually
 * clears bot_paused or similar workflow tags.
 */
export async function removeTags(contactId: string, tags: string[]): Promise<void> {
  console.log('[ghl.ts] removeTags →', { contactId, tags });

  if (tags.length === 0) {
    console.warn('[ghl.ts] removeTags called with empty tags array — skipping');
    return;
  }

  await ghlFetch(`/contacts/${contactId}/tags`, 'DELETE', { tags });
}

/**
 * Fetches a GHL contact by ID. Utility function for debugging and
 * future use — not currently called in the bot webhook flow.
 */
export async function getContact(contactId: string): Promise<GHLContact> {
  console.log('[ghl.ts] getContact →', { contactId });

  const data = await ghlFetch(`/contacts/${contactId}`, 'GET') as { contact: GHLContact };
  return data.contact;
}

/**
 * Looks up the GHL conversationId for a contact via the search endpoint.
 * Returns null if no conversation thread exists yet.
 */
export async function getConversation(contactId: string): Promise<string | null> {
  console.log('[ghl.ts] getConversation →', { contactId });

  const data = await ghlFetch(
    `/conversations/search?contactId=${contactId}`,
    'GET'
  ) as { conversations: { id: string }[] };

  console.log('[ghl.ts] getConversation raw response:', JSON.stringify(data));

  const conversationId = data.conversations[0]?.id ?? null;
  console.log('[ghl.ts] getConversation returning:', conversationId);

  return conversationId;
}

/**
 * Creates a new GHL conversation for a contact. Use when getConversation
 * returns null (first inbound from this contact).
 */
export async function createConversation(contactId: string): Promise<string> {
  console.log('[ghl.ts] createConversation →', { contactId });

  const data = await ghlFetch('/conversations', 'POST', { contactId }) as { id: string };

  if (!data.id) {
    throw new Error(`createConversation: no id in response for contactId ${contactId}`);
  }

  return data.id;
}
