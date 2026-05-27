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
