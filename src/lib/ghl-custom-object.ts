// SR Lead custom object — mirrors our app lead state inside GHL.
// The object schema must be created manually in GHL before this code is active.
// All three exported functions fail silently — never throw to callers.

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
  sr_status:          "NEW" | "INSPECTION_SCHEDULED" | "INSPECTION_COMPLETE" | "DEMO_NOT_SOLD" | "DENIED" | "NO_SHOW" | "SOLD" | "DEAD";
  sr_qualify_status:  "pending" | "qualified" | "complete";
  sr_bot_stage:       "qualifying" | "booking" | "revival" | "silent";
  sr_appointment_at?: string;
  sr_source:          "facebook" | "manual" | "organic" | "webhook";
  sr_opted_out:       boolean;
}

// Returns the GHL record ID and fields, or null on any error.
async function getRecord(
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
      console.error(`[sr-lead] getSrLead GET failed — HTTP ${res.status}`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const record = data?.records?.[0];
    if (!record) return null;
    return { recordId: record.id as string, fields: record.fields as SrLeadFields };
  } catch (err) {
    console.error("[sr-lead] getSrLead error:", err);
    return null;
  }
}

export async function createSrLead(
  ghlContactId: string,
  fields: SrLeadFields
): Promise<string> {
  const objectId = process.env.GHL_SR_LEAD_OBJECT_ID;
  if (!objectId) {
    console.error("[sr-lead] GHL_SR_LEAD_OBJECT_ID is not set — skipping createSrLead");
    return "";
  }
  try {
    const res = await fetch(`${GHL_BASE}/objects/${objectId}/records`, {
      method: "POST",
      headers: ghlHeaders(),
      body: JSON.stringify({
        fields,
        associations: [{ objectId: "contact", recordId: ghlContactId }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sr-lead] createSrLead failed — HTTP ${res.status}: ${body}`);
      return "";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    return (data?.record?.id ?? data?.id ?? "") as string;
  } catch (err) {
    console.error("[sr-lead] createSrLead error:", err);
    return "";
  }
}

export async function updateSrLead(
  ghlContactId: string,
  updates: Partial<SrLeadFields>
): Promise<void> {
  const objectId = process.env.GHL_SR_LEAD_OBJECT_ID;
  if (!objectId) {
    console.error("[sr-lead] GHL_SR_LEAD_OBJECT_ID is not set — skipping updateSrLead");
    return;
  }
  try {
    const record = await getRecord(ghlContactId);
    if (!record) {
      console.error(`[sr-lead] updateSrLead — no record found for contact ${ghlContactId}`);
      return;
    }
    const res = await fetch(`${GHL_BASE}/objects/${objectId}/records/${record.recordId}`, {
      method: "PUT",
      headers: ghlHeaders(),
      body: JSON.stringify({ fields: updates }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sr-lead] updateSrLead failed — HTTP ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("[sr-lead] updateSrLead error:", err);
  }
}

export async function getSrLead(ghlContactId: string): Promise<SrLeadFields | null> {
  const record = await getRecord(ghlContactId);
  return record?.fields ?? null;
}
