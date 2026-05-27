// SR Lead custom object — mirrors our app lead state inside GHL.
// The object schema must be created manually in GHL before this code is active.
// DB is the source of truth. GHL is kept in sync but failures are non-blocking.

import { prisma } from "@/src/lib/prisma";
import type { SrLead } from "@prisma/client";

const GHL_BASE = "https://services.leadconnectorhq.com";

function ghlHeaders(): HeadersInit {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Version": "2021-04-15",
  };
}

export interface SrLeadFields {
  sr_lead_id:         string;
  sr_tier:            "primary" | "secondary" | "out_of_area";
  sr_zone:            string;
  sr_status:          "NEW" | "INSPECTION_SCHEDULED" | "INSPECTION_COMPLETE" | "DEMO_NOT_SOLD" | "DENIED" | "NO_SHOW" | "SOLD" | "DEAD" | "QUOTED";
  sr_qualify_status:  "pending" | "qualified" | "complete";
  sr_bot_stage:       "nurture" | "qualifying" | "booking" | "revival" | "reschedule" | "finance" | "silent";
  sr_appointment_at?: string;
  sr_source:          "facebook-inspection" | "facebook-guide" | "card-inspection" | "card-guide" | "door-inspection" | "door-guide" | "organic-inspection" | "organic-guide" | "manual";
  sr_opted_out:       boolean;
}

// ── Internal GHL-only helpers (not exported) ──────────────────────────────────

async function getRecordFromGhl(
  ghlContactId: string
): Promise<{ recordId: string; fields: SrLeadFields } | null> {
  const objectId = process.env.GHL_SR_LEAD_OBJECT_ID;
  if (!objectId) {
    console.error("[sr-lead] GHL_SR_LEAD_OBJECT_ID is not set — SR Lead sync disabled");
    return null;
  }
  try {
    const res = await fetch(
      `${GHL_BASE}/objects/${objectId}/records?contactId=${encodeURIComponent(ghlContactId)}`,
      { headers: ghlHeaders() }
    );
    if (!res.ok) {
      console.error(`[sr-lead] getRecord GET failed — HTTP ${res.status}`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const record = data?.records?.[0];
    if (!record) return null;
    return { recordId: record.id as string, fields: record.fields as SrLeadFields };
  } catch (err) {
    console.error("[sr-lead] getRecord error:", err);
    return null;
  }
}

async function createSrLeadInGhl(
  ghlContactId: string,
  fields: SrLeadFields
): Promise<string> {
  const objectId   = process.env.GHL_SR_LEAD_OBJECT_ID;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!objectId) {
    console.error("[sr-lead] GHL_SR_LEAD_OBJECT_ID is not set — skipping GHL create");
    return "";
  }
  if (!locationId) {
    console.error("[sr-lead] GHL_LOCATION_ID is not set — skipping GHL create");
    return "";
  }
  try {
    // Step 1: create the record with properties
    const createRes = await fetch(`${GHL_BASE}/objects/${objectId}/records`, {
      method: "POST",
      headers: ghlHeaders(),
      body: JSON.stringify({
        locationId,
        properties: {
          sr_lead_id:        fields.sr_lead_id,
          sr_tier:           fields.sr_tier,
          sr_zone:           fields.sr_zone,
          sr_status:         fields.sr_status,
          sr_qualify_status: fields.sr_qualify_status,
          sr_bot_stage:      fields.sr_bot_stage,
          sr_source:         fields.sr_source,
          sr_opted_out:      fields.sr_opted_out,
        },
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      console.error(`[sr-lead] createSrLeadInGhl POST failed — HTTP ${createRes.status}: ${body}`);
      return "";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createData: any = await createRes.json();
    const recordId = (createData?.record?.id ?? createData?.id ?? "") as string;
    if (!recordId) {
      console.error("[sr-lead] createSrLeadInGhl: no recordId in response", createData);
      return "";
    }

    // Step 2: associate the record with the GHL contact
    const assocRes = await fetch(
      `${GHL_BASE}/objects/${objectId}/records/${recordId}/associations`,
      {
        method: "POST",
        headers: ghlHeaders(),
        body: JSON.stringify({
          locationId,
          associations: [{ objectType: "contact", objectId: ghlContactId }],
        }),
      }
    );
    if (!assocRes.ok) {
      const body = await assocRes.text().catch(() => "");
      console.error(`[sr-lead] createSrLeadInGhl association failed — HTTP ${assocRes.status}: ${body}`);
      // Record was created — still return the ID so DB stays in sync
    }

    return recordId;
  } catch (err) {
    console.error("[sr-lead] createSrLeadInGhl error:", err);
    return "";
  }
}

async function updateSrLeadInGhl(
  ghlRecordId: string,
  updates: Partial<SrLeadFields>
): Promise<void> {
  const objectId = process.env.GHL_SR_LEAD_OBJECT_ID;
  if (!objectId) {
    console.error("[sr-lead] GHL_SR_LEAD_OBJECT_ID is not set — skipping GHL update");
    return;
  }
  const locationId = process.env.GHL_LOCATION_ID ?? "";
  try {
    const res = await fetch(`${GHL_BASE}/objects/${objectId}/records/${ghlRecordId}`, {
      method: "PUT",
      headers: ghlHeaders(),
      body: JSON.stringify({ locationId, properties: { ...updates } }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sr-lead] updateSrLeadInGhl failed — HTTP ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("[sr-lead] updateSrLeadInGhl error:", err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Create SR Lead in GHL and DB simultaneously. Returns ghlRecordId.
export async function createSrLead(
  ghlContactId: string,
  leadId: string,
  fields: SrLeadFields
): Promise<string> {
  // 1. Create in GHL
  const ghlRecordId = await createSrLeadInGhl(ghlContactId, fields);

  // 2. Update Lead with ghlRecordId
  if (ghlRecordId) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { ghlRecordId },
    }).catch(err => console.error("[sr-lead] lead.update ghlRecordId failed:", err));
  }

  // 3. Create SrLead in DB
  await prisma.srLead.create({
    data: {
      leadId,
      ghlContactId,
      ghlRecordId: ghlRecordId || null,
      srLeadId:        fields.sr_lead_id,
      srTier:          fields.sr_tier,
      srZone:          fields.sr_zone,
      srStatus:        fields.sr_status,
      srQualifyStatus: fields.sr_qualify_status,
      srBotStage:      fields.sr_bot_stage,
      srSource:        fields.sr_source,
      srOptedOut:      fields.sr_opted_out,
    },
  }).catch(err => console.error("[sr-lead] srLead.create failed:", err));

  return ghlRecordId;
}

// Update SR Lead in GHL and DB in parallel using stored ghlRecordId — no GHL lookup needed.
export async function updateSrLead(
  leadId: string,
  updates: Partial<SrLeadFields>
): Promise<void> {
  const srLead = await prisma.srLead.findUnique({ where: { leadId } });

  if (!srLead) {
    console.error("[sr-lead] updateSrLead: SrLead not found in DB for leadId", leadId);
    return;
  }

  // Build DB update from partial fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbUpdate: any = { updatedAt: new Date() };
  if (updates.sr_status         !== undefined) dbUpdate.srStatus         = updates.sr_status;
  if (updates.sr_bot_stage      !== undefined) dbUpdate.srBotStage       = updates.sr_bot_stage;
  if (updates.sr_qualify_status !== undefined) dbUpdate.srQualifyStatus  = updates.sr_qualify_status;
  if (updates.sr_appointment_at !== undefined) dbUpdate.srAppointmentAt  = new Date(updates.sr_appointment_at);
  if (updates.sr_opted_out      !== undefined) dbUpdate.srOptedOut       = updates.sr_opted_out;

  await Promise.allSettled([
    prisma.srLead.update({ where: { leadId }, data: dbUpdate })
      .catch(err => console.error("[sr-lead] srLead.update failed:", err)),
    srLead.ghlRecordId
      ? updateSrLeadInGhl(srLead.ghlRecordId, updates)
          .catch(err => console.error("[sr-lead] GHL SR Lead sync failed:", err))
      : Promise.resolve(),
  ]);
}

// Read SR Lead from DB with GHL self-heal fallback.
export async function getSrLeadFromDb(
  leadId: string,
  ghlContactId: string
): Promise<SrLead | null> {
  const existing = await prisma.srLead.findUnique({ where: { leadId } });
  if (existing) return existing;

  // Self-heal: fetch from GHL and write to DB
  console.warn("[sr-lead] getSrLeadFromDb: missing for leadId", leadId, "— fetching from GHL");

  try {
    const ghlData = await getRecordFromGhl(ghlContactId);
    if (!ghlData) return null;

    const healed = await prisma.srLead.create({
      data: {
        leadId,
        ghlContactId,
        ghlRecordId:     ghlData.recordId,
        srLeadId:        ghlData.fields.sr_lead_id ?? leadId,
        srTier:          ghlData.fields.sr_tier,
        srZone:          ghlData.fields.sr_zone,
        srStatus:        ghlData.fields.sr_status,
        srQualifyStatus: ghlData.fields.sr_qualify_status,
        srBotStage:      ghlData.fields.sr_bot_stage,
        srSource:        ghlData.fields.sr_source,
        srOptedOut:      ghlData.fields.sr_opted_out ?? false,
      },
    });

    return healed;
  } catch (err) {
    console.error("[sr-lead] getSrLeadFromDb: self-heal failed", err);
    return null;
  }
}

// Read SR Lead fields from GHL directly (used by self-heal).
export async function getSrLeadFromGhl(ghlContactId: string): Promise<SrLeadFields | null> {
  const record = await getRecordFromGhl(ghlContactId);
  return record?.fields ?? null;
}
