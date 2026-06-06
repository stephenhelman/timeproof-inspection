// ─────────────────────────────────────────────────────────────
// GHL CONTACTS & OPPORTUNITIES
// Manages GHL contact creation, updates, and pipeline placement.
// Used by intake routes to replace outbound webhook calls.
//
// SDK: ghl-sdk (handles contact + opportunity API surface)
//
// Note on conversationId: The old TimeProof system required
// fetching/creating a conversationId before sending SMS.
// The active system sends with contactId only and is working.
// TODO: revisit conversationId requirement at scale if SMS
// delivery issues arise.
// ─────────────────────────────────────────────────────────────

import { ContactsClient, OpportunitiesClient } from "ghl-sdk";

// ── Types ──────────────────────────────────────────────────────

export interface QntumContactInput {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  // Qntum-specific fields — mapped to GHL custom field IDs
  srSource?: string; // GHL_FIELD_SR_SOURCE
  srBotStage?: string; // GHL_FIELD_SR_BOT_STAGE
  leadId?: string; // GHL_FIELD_LEAD_ID
  rep?: string; // GHL_FIELD_REP
  roofType?: string; // GHL_FIELD_ROOF_TYPE
  roofAge?: string; // GHL_FIELD_ROOF_AGE
  issuesNoticed?: string; // GHL_FIELD_ISSUES_NOTICED (comma-separated)
  lastInspected?: string; // GHL_FIELD_LAST_INSPECTED
}

export interface QntumOpportunityInput {
  ghlContactId: string;
  contactName: string;
  pipelineId: string; // from env var
  pipelineStageId: string; // from env var
  sourceName: string; // e.g. "facebook-guide", "door-inspection"
}

// ── Internal helpers ───────────────────────────────────────────

function getClients() {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    contacts: new ContactsClient(key),
    opportunities: new OpportunitiesClient(key),
  };
}

function getLocationId(): string {
  const id = process.env.GHL_LOCATION_ID;
  if (!id) throw new Error("GHL_LOCATION_ID is not set");
  return id;
}

// Maps QntumContactInput named fields to GHL custom field IDs from env vars.
// Returns both `value` (required by create) and `field_value` (required by update)
// so the same array can be passed to either SDK call.
function buildCustomFields(
  input: QntumContactInput,
): Array<{ id: string; value: string; field_value: string }> {
  const fields: Array<{ id: string; value: string; field_value: string }> = [];

  const map: Array<[string | undefined, string | undefined]> = [
    [process.env.GHL_FIELD_SR_SOURCE, input.srSource],
    [process.env.GHL_FIELD_SR_BOT_STAGE, input.srBotStage],
    [process.env.GHL_FIELD_LEAD_ID, input.leadId],
    [process.env.GHL_FIELD_REP, input.rep],
    [process.env.GHL_FIELD_ROOF_TYPE, input.roofType],
    [process.env.GHL_FIELD_ROOF_AGE, input.roofAge],
    [process.env.GHL_FIELD_ISSUES_NOTICED, input.issuesNoticed],
    [process.env.GHL_FIELD_LAST_INSPECTED, input.lastInspected],
  ];

  for (const [fieldId, value] of map) {
    if (fieldId && value !== undefined && value !== "") {
      fields.push({ id: fieldId, value, field_value: value });
    }
  }

  return fields;
}

// ── Contact management ─────────────────────────────────────────

// Create or update a GHL contact (upsert by phone).
// If existingGhlContactId is provided — update existing contact.
// If not — create new contact and return the new ghlContactId.
export async function upsertGhlContact(
  input: QntumContactInput,
  existingGhlContactId?: string,
): Promise<{ ghlContactId: string; isNew: boolean }> {
  const { contacts } = getClients();
  const customFields = buildCustomFields(input);

  const basePayload = {
    firstName: input.firstName,
    lastName: input.lastName ?? "",
    phone: input.phone,
    email: input.email,
    address1: input.address1,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    customFields,
  };
  console.log(basePayload);

  if (existingGhlContactId) {
    await contacts.update(existingGhlContactId, basePayload);
    return { ghlContactId: existingGhlContactId, isNew: false };
  }

  const locationId = getLocationId();
  const result = await contacts.create({ ...basePayload, locationId });
  const ghlContactId = result?.contact?.id;

  if (!ghlContactId) {
    throw new Error("upsertGhlContact: GHL did not return a contact ID");
  }

  return { ghlContactId, isNew: true };
}

// Update only specific custom fields on an existing contact.
// Used for bot stage updates mid-conversation.
export async function updateGhlContactFields(
  ghlContactId: string,
  fields: Partial<
    Pick<QntumContactInput, "srSource" | "srBotStage" | "leadId" | "rep" | "roofAge" | "issuesNoticed" | "lastInspected">
  >,
): Promise<void> {
  const { contacts } = getClients();
  const customFields = buildCustomFields(fields as QntumContactInput);

  if (customFields.length === 0) return;

  await contacts.update(ghlContactId, { customFields });
}

// ── Opportunity management ─────────────────────────────────────

// Create a new opportunity in a pipeline stage.
// Stage creation is what triggers GHL workflows.
// Returns ghlOpportunityId.
export async function createGhlOpportunity(
  input: QntumOpportunityInput,
): Promise<string> {
  const { opportunities } = getClients();
  const locationId = getLocationId();

  const result = await opportunities.create({
    pipelineId: input.pipelineId,
    pipelineStageId: input.pipelineStageId,
    contactId: input.ghlContactId,
    name: `${input.contactName} — ${input.sourceName}`,
    locationId,
    status: "open",
  });

  const ghlOpportunityId = result?.opportunity?.id;

  if (!ghlOpportunityId) {
    throw new Error(
      "createGhlOpportunity: GHL did not return an opportunity ID",
    );
  }

  return ghlOpportunityId;
}

// Update standard contact fields (address, name, etc.) on an existing contact.
// Used by the book bot to save the homeowner-provided address.
export async function updateGhlContact(
  ghlContactId: string,
  fields: {
    address1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  },
): Promise<void> {
  const { contacts } = getClients();
  await contacts.update(ghlContactId, fields);
}

// Move an existing opportunity to a different pipeline stage.
// Used by DISPO outcomes and bot transitions.
export async function moveGhlOpportunityStage(
  ghlOpportunityId: string,
  pipelineStageId: string,
): Promise<void> {
  const { opportunities } = getClients();
  await opportunities.update(ghlOpportunityId, { pipelineStageId });
}

// Write a single custom field value to a GHL contact.
// Used by bot routes to store pipeline context fields (e.g. sr_previous_context).
export async function writeGhlContactCustomField(
  ghlContactId: string,
  fieldId: string,
  value: string,
): Promise<void> {
  const { contacts } = getClients();
  // Assign to a typed variable to avoid inline excess-property check on the SDK union type.
  const customFields: Array<{ id: string; value: string; field_value: string }> = [
    { id: fieldId, value, field_value: value },
  ];
  await contacts.update(ghlContactId, { customFields });
}

// Read a single custom field value from a GHL contact.
// Returns null if the field is not found or the contact cannot be fetched.
export async function getGhlContactCustomField(
  ghlContactId: string,
  fieldId: string,
): Promise<string | null> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/${encodeURIComponent(ghlContactId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      contact?: { customFields?: Array<{ id: string; value?: string; field_value?: string }> };
    };
    const fields = data?.contact?.customFields ?? [];
    const match = fields.find((f) => f.id === fieldId);
    return match?.field_value ?? match?.value ?? null;
  } catch {
    return null;
  }
}

// Read a single custom field value from a GHL opportunity.
// Used by Alex bot handlers to load bot_context before each call.
export async function getGhlOpportunityCustomField(
  ghlOpportunityId: string,
  fieldId: string,
): Promise<string | null> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${encodeURIComponent(ghlOpportunityId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      opportunity?: { customFields?: Array<{ id: string; value?: string; field_value?: string }> };
    };
    const fields = data?.opportunity?.customFields ?? [];
    const match = fields.find((f) => f.id === fieldId);
    return match?.field_value ?? match?.value ?? null;
  } catch {
    return null;
  }
}

// Search for a GHL contact by phone number. Returns contact ID if found, null otherwise.
export async function findGhlContactByPhone(
  phone: string,
): Promise<string | null> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return null;
  try {
    const digits = phone.replace(/\D/g, "");
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&phone=${encodeURIComponent(digits)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { contact?: { id?: string } };
    return data?.contact?.id ?? null;
  } catch {
    return null;
  }
}

// Assign a rep (by GHL user ID) to an existing GHL opportunity.
export async function assignGhlOpportunityRep(
  ghlOpportunityId: string,
  ghlUserId: string,
): Promise<void> {
  const { opportunities } = getClients();
  await opportunities.update(ghlOpportunityId, { assignedTo: ghlUserId });
}

// Write a single custom field value to a GHL opportunity.
// Used to store sr_inspection_id and sr_pipeline_context.
export async function writeGhlOpportunityCustomField(
  ghlOpportunityId: string,
  fieldId: string,
  value: string,
): Promise<void> {
  const { opportunities } = getClients();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (opportunities as any).update(ghlOpportunityId, {
    customFields: [{ id: fieldId, value, field_value: value }],
  });
}
