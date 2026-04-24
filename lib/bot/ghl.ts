import HighLevel from '@gohighlevel/api-client';

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

// ─── Client ───────────────────────────────────────────────────────────────────

function getClient() {
  const token = process.env.GHL_API_KEY;
  if (!token) {
    console.error('[ghl.ts] GHL_API_KEY is not set');
  }
  return new HighLevel({
    privateIntegrationToken: token ?? '',
  });
}

function getLocationId(): string {
  return process.env.GHL_LOCATION_ID ?? '';
}

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
  console.log('[ghl.ts] sendSMS →', {
    contactId,
    conversationId: conversationId ?? 'none',
    messageLength: message.length,
  });

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

  try {
    const client = getClient();
    // SDK DTO declares contactId as required but the actual GHL v2 API
    // requires conversationId. The SDK proxies the body directly so we
    // cast to bypass the type mismatch.
    await client.conversations.sendANewMessage({
      type: 'SMS',
      conversationId,
      message,
    } as any);
  } catch (error) {
    console.error('[ghl.ts] sendSMS error:', error);
    throw error;
  }
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

  try {
    const client = getClient();
    // SDK UpdateContactDto uses customFields (array) but the GHL API also
    // accepts customField (object). Cast to preserve the object format.
    await client.contacts.updateContact(
      { contactId },
      { customField } as any
    );
  } catch (error) {
    console.error('[ghl.ts] updateContactFields error:', error);
    throw error;
  }
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

  try {
    const client = getClient();
    await client.contacts.addTags({ contactId }, { tags });
  } catch (error) {
    console.error('[ghl.ts] addTags error:', error);
    throw error;
  }
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

  try {
    const client = getClient();
    await client.contacts.removeTags({ contactId }, { tags });
  } catch (error) {
    console.error('[ghl.ts] removeTags error:', error);
    throw error;
  }
}

/**
 * Fetches a GHL contact by ID. Utility function for debugging and
 * future use — not currently called in the bot webhook flow.
 */
export async function getContact(contactId: string): Promise<GHLContact> {
  console.log('[ghl.ts] getContact →', { contactId });

  try {
    const client = getClient();
    const data = await client.contacts.getContact({ contactId });
    const c = data.contact!;
    return {
      id: c.id ?? '',
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      phone: c.phone ?? '',
      email: c.email ?? undefined,
      address1: c.address1 ?? undefined,
      postalCode: c.postalCode ?? undefined,
      customField: c.customFields as unknown as Record<string, unknown> | undefined,
      tags: c.tags ?? undefined,
    };
  } catch (error) {
    console.error('[ghl.ts] getContact error:', error);
    throw error;
  }
}

/**
 * Looks up the GHL conversationId for a contact via the search endpoint.
 * Returns null if no conversation thread exists yet.
 */
export async function getConversation(contactId: string): Promise<string | null> {
  console.log('[ghl.ts] getConversation →', { contactId });

  try {
    const client = getClient();
    const data = await client.conversations.searchConversation({
      locationId: getLocationId(),
      contactId,
    });

    console.log('[ghl.ts] getConversation raw response:', JSON.stringify(data));

    const conversationId = data.conversations?.[0]?.id ?? null;
    console.log('[ghl.ts] getConversation result:', conversationId ?? 'null');

    return conversationId;
  } catch (error) {
    console.error('[ghl.ts] getConversation error:', error);
    throw error;
  }
}

/**
 * Creates a new GHL conversation for a contact. Use when getConversation
 * returns null (first inbound from this contact).
 */
export async function createConversation(contactId: string): Promise<string> {
  console.log('[ghl.ts] createConversation →', { contactId });

  try {
    const client = getClient();
    const data = await client.conversations.createConversation({
      locationId: getLocationId(),
      contactId,
    });

    const conversationId = data.conversation?.id;
    if (!conversationId) {
      throw new Error(`createConversation: no id in response for contactId ${contactId}`);
    }

    return conversationId;
  } catch (error) {
    console.error('[ghl.ts] createConversation error:', error);
    throw error;
  }
}
