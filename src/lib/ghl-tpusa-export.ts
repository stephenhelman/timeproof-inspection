// TPUSA EXPORT — legacy admin export for TimeProof USA contacts/opportunities.
// ghl-service.ts was renamed to ghl-contacts.ts during the Qntum refactor.
// This file preserves the original TPUSA logic so the admin export route continues
// to work. Review with admin before deleting.

import { ContactsClient, OpportunitiesClient } from "ghl-sdk";
import type { Lead } from "@prisma/client";

const FIELD_IDS = {
  tpusa_lead_id:          process.env.GHL_FIELD_LEAD_ID           ?? "tpusa_lead_id",
  tpusa_highest_estimate: process.env.GHL_FIELD_HIGHEST_ESTIMATE  ?? "tpusa_highest_estimate",
  tpusa_assigned_tech:    process.env.GHL_FIELD_ASSIGNED_TECH     ?? "tpusa_assigned_tech",
  tpusa_source:           process.env.GHL_FIELD_SOURCE            ?? "tpusa_source",
  tpusa_zip:              process.env.GHL_FIELD_ZIP               ?? "tpusa_zip",
};

function getClients() {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    contacts:      new ContactsClient(key),
    opportunities: new OpportunitiesClient(key),
  };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName:  parts.slice(1).join(" "),
  };
}

function buildContactPayload(lead: Lead) {
  const { firstName, lastName } = splitName(lead.customerName);
  return {
    firstName,
    lastName,
    phone:       lead.phone ?? undefined,
    address1:    lead.streetAddress,
    city:        lead.city,
    state:       lead.state,
    postalCode:  lead.zip,
    tags:        ["tpusa"] as unknown as string[][],
    customFields: [
      { id: FIELD_IDS.tpusa_lead_id,          value: lead.id },
      { id: FIELD_IDS.tpusa_highest_estimate,  value: String(lead.highestEstimateValue ?? "") },
      { id: FIELD_IDS.tpusa_assigned_tech,     value: lead.assignedTech ?? "" },
      { id: FIELD_IDS.tpusa_source,            value: lead.source },
      { id: FIELD_IDS.tpusa_zip,               value: lead.zip },
    ],
  };
}

async function createOrUpdateContact(lead: Lead): Promise<string> {
  const { contacts } = getClients();
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error("GHL_LOCATION_ID is not set");

  if (lead.ghlContactId) {
    const { firstName, lastName } = splitName(lead.customerName);
    const res = await contacts.update(lead.ghlContactId, {
      firstName,
      lastName,
      phone:      lead.phone ?? undefined,
      address1:   lead.streetAddress,
      city:       lead.city,
      state:      lead.state,
      postalCode: lead.zip,
      tags:       ["tpusa"],
      customFields: [
        { id: FIELD_IDS.tpusa_lead_id,          field_value: lead.id },
        { id: FIELD_IDS.tpusa_highest_estimate,  field_value: String(lead.highestEstimateValue ?? "") },
        { id: FIELD_IDS.tpusa_assigned_tech,     field_value: lead.assignedTech ?? "" },
        { id: FIELD_IDS.tpusa_source,            field_value: lead.source },
        { id: FIELD_IDS.tpusa_zip,               field_value: lead.zip },
      ],
    });
    const contactId = res.contact?.id;
    if (!contactId) throw new Error(`GHL update contact returned no ID for lead ${lead.id}`);
    return contactId;
  }

  const payload = buildContactPayload(lead);
  const res = await contacts.create({ ...payload, locationId });
  const contactId = res.contact?.id;
  if (!contactId) throw new Error(`GHL create contact returned no ID for lead ${lead.id}`);
  return contactId;
}

async function createOpportunities(
  ghlContactId: string,
  contactName:  string
): Promise<void> {
  const { opportunities } = getClients();
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error("GHL_LOCATION_ID is not set");

  const revivalPipelineId = process.env.GHL_PIPELINE_ID_REVIVAL;
  const dialerPipelineId  = process.env.GHL_PIPELINE_ID_DIALER;
  if (!revivalPipelineId) throw new Error("GHL_PIPELINE_ID_REVIVAL is not set");
  if (!dialerPipelineId)  throw new Error("GHL_PIPELINE_ID_DIALER is not set");

  await opportunities.create({
    pipelineId: revivalPipelineId,
    locationId,
    name:       `${contactName} - Revival`,
    status:     "open",
    contactId:  ghlContactId,
    ...(process.env.GHL_STAGE_ID_REVIVAL_PENDING
      ? { pipelineStageId: process.env.GHL_STAGE_ID_REVIVAL_PENDING }
      : {}),
  });

  await opportunities.create({
    pipelineId: dialerPipelineId,
    locationId,
    name:       `${contactName} - Dialer`,
    status:     "open",
    contactId:  ghlContactId,
    ...(process.env.GHL_STAGE_ID_DIALER_DAY1
      ? { pipelineStageId: process.env.GHL_STAGE_ID_DIALER_DAY1 }
      : {}),
  });
}

export async function exportLead(lead: Lead): Promise<string> {
  const isFirstExport = !lead.ghlContactId;
  const ghlContactId  = await createOrUpdateContact(lead);
  if (isFirstExport) {
    await createOpportunities(ghlContactId, lead.customerName);
  }
  return ghlContactId;
}
