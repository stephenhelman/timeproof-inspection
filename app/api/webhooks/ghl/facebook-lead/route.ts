import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getZipTier } from "@/src/lib/service-zones";
import { handleTier1Lead, handleTier2Lead, handleOutOfAreaLead } from "@/src/lib/ghl-lead-handlers";

// ============================================================
// GHL FACEBOOK LEAD PAYLOAD MAP
// Update this if GHL changes their webhook payload shape.
// All field extraction lives here — nowhere else in the route.
// customData-first: GHL standard workflow webhooks wrap all fields in customData.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGhlFacebookPayload(raw: any) {
  const data = raw?.customData ?? raw;
  const firstName = data.first_name ?? data.firstName ?? "";
  const lastName = data.last_name ?? data.lastName ?? "";
  const name = (data.contact_name ?? `${firstName} ${lastName}`.trim()) || "Unknown";
  const phone = data.phone ?? data.phone_raw ?? "";
  const zip = (
    data.customField?.lead_zip ??
    data.lead_zip ??
    data.zip ??
    data.customData?.lead_zip ??
    ""
  ).trim();
  const ghlContactId = data.contact_id ?? data.contactId ?? data.id ?? "";
  const facebookLeadId: string | null = data.facebook_lead_id ?? null;
  return { name, phone, zip, ghlContactId, facebookLeadId, source: "facebook-inspection" as const };
}
// ============================================================

export async function POST(request: NextRequest) {
  // Always 200 after secret check — GHL retries on anything else
  let raw: unknown = null;

  const secret = request.headers.get("x-ghl-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    raw = await request.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      await prisma.webhookLog.create({
        data: {
          source: "ghl_facebook",
          payload: {},
          status: "error",
          errorMessage: "invalid_json",
        },
      });
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 200 });
    }

    const norm = normalizeGhlFacebookPayload(raw);

    if (!norm.name || !norm.phone) {
      await prisma.webhookLog.create({
        data: {
          source: "ghl_facebook",
          payload: raw as object,
          normalized: norm,
          status: "error",
          errorMessage: "missing_required_fields",
        },
      });
      return NextResponse.json({ error: "missing_required_fields" }, { status: 200 });
    }

    const tier = getZipTier(norm.zip);

    const lead = await prisma.lead.create({
      data: {
        customerName: norm.name,
        phone: norm.phone,
        streetAddress: "",
        city: "",
        state: "",
        zip: norm.zip,
        sourceZip: norm.zip,
        sourceTier: tier,
        source: norm.source,
        ghlContactId: norm.ghlContactId || null,
        facebookLeadId: norm.facebookLeadId,
        status: tier === "out_of_area" ? "OUT_OF_AREA" : "NEW",
        smsConsentAt: new Date(),
        smsConsentText: "Consent given via Facebook Lead Ad form",
        ...(process.env.GHL_DEFAULT_ASSIGNEE_ID
          ? { assignedUserId: process.env.GHL_DEFAULT_ASSIGNEE_ID }
          : {}),
      },
    });

    const handlerArgs = {
      lead,
      ghlContactId: norm.ghlContactId,
      name: norm.name,
      zip: norm.zip,
      tier,
    };

    if (tier === "primary") {
      await handleTier1Lead(handlerArgs);
    } else if (tier === "secondary") {
      await handleTier2Lead(handlerArgs);
    } else {
      await handleOutOfAreaLead(handlerArgs);
    }

    await prisma.webhookLog.create({
      data: {
        source: "ghl_facebook",
        payload: raw as object,
        normalized: norm,
        status: "success",
        leadId: lead.id,
      },
    });

    return NextResponse.json({ success: true, leadId: lead.id, tier });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[facebook-lead] uncaught error:", message);
    try {
      await prisma.webhookLog.create({
        data: {
          source: "ghl_facebook",
          payload: (raw as object) ?? {},
          status: "error",
          errorMessage: message,
        },
      });
    } catch (logErr) {
      console.error("[facebook-lead] failed to write error log:", logErr);
    }
    // Return 200 — never return 5xx to GHL or it will retry indefinitely
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
