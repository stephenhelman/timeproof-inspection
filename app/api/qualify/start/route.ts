import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/src/lib/prisma";
import { upsertGhlContact, createGhlOpportunity, updateGhlContactFields } from "@/src/lib/ghl-contacts";
import { createSrLead, updateSrLead } from "@/src/lib/ghl-custom-object";
import { resolveSource } from "@/src/lib/source-utils";
import { getZoneForZip } from "@/src/lib/service-zones";

const SMS_CONSENT_TEXT =
  "By providing your phone number, you consent to receive text messages from Qntum Roofing regarding your inspection request. Message and data rates may apply. Reply STOP at any time to opt out.";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, phone, email, zip, tier, token } = body as {
    name?:  string;
    phone?: string;
    email?: string;
    zip?:   string;
    tier?:  string;
    token?: string;
  };

  if (!token || !name || !phone || !email) {
    return NextResponse.json({ error: "name, phone, email, and token are required" }, { status: 400 });
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  let jwtPayload: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(token, secret);
    jwtPayload = payload as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const resolvedZip  = (jwtPayload.zip  as string) ?? zip  ?? "";
  const resolvedTier = (jwtPayload.tier as string) ?? tier ?? "";
  const smsConsentAt = new Date();
  const smsConsentIp = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";

  let lead;

  // Facebook leads have a leadId pre-baked in the JWT
  if (jwtPayload.leadId && typeof jwtPayload.leadId === "string") {
    const existing = await prisma.lead.findUnique({ where: { id: jwtPayload.leadId } });
    if (existing) {
      lead = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          customerName: existing.customerName || name,
          phone:        existing.phone        || phone,
          email:        existing.email        || email,
          smsConsentAt,
          smsConsentIp,
          smsConsentText: SMS_CONSENT_TEXT,
        },
      });
    }
  }

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        customerName:   name,
        phone,
        email,
        streetAddress:  "",
        city:           "",
        state:          "",
        zip:            resolvedZip,
        sourceZip:      resolvedZip,
        sourceTier:     resolvedTier,
        source:         "organic",
        smsConsentAt,
        smsConsentIp,
        smsConsentText: SMS_CONSENT_TEXT,
      },
    });
  }

  // Issue a new JWT with leadId so /api/qualify/complete can update the record
  const expiryMinutes = parseInt(process.env.QUALIFY_TOKEN_EXPIRY_MINUTES ?? "15", 10);
  const newToken = await new SignJWT({
    zip:    resolvedZip,
    tier:   resolvedTier,
    leadId: lead.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(secret);

  if (lead.ghlContactId) {
    // Existing Facebook lead returning to fill the form — GHL contact already exists
    await Promise.allSettled([
      updateSrLead(lead.id, {
        sr_bot_stage:      "qualifying",
        sr_qualify_status: "pending",
      }),
      updateGhlContactFields(lead.ghlContactId, {
        srBotStage: "qualifying",
      }),
    ]).catch(err => console.error("[qualify/start] GHL update failed for existing lead:", err));
  } else {
    // New organic/card/door lead — create GHL contact, SR Lead, and opportunity
    try {
      const resolvedSource = resolveSource(lead.source, "inspection");
      const firstName      = name.trim().split(" ")[0];
      const lastName       = name.trim().split(" ").slice(1).join(" ");

      const { ghlContactId } = await upsertGhlContact({
        firstName,
        lastName,
        phone,
        email,
        srSource:   resolvedSource,
        srBotStage: "qualifying",
        leadId:     lead.id,
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data:  { ghlContactId },
      });

      await createSrLead(ghlContactId, lead.id, {
        sr_lead_id:        lead.id,
        sr_tier:           (resolvedTier as "primary" | "secondary" | "out_of_area") || "primary",
        sr_zone:           getZoneForZip(resolvedZip) ?? "unknown",
        sr_status:         "NEW",
        sr_qualify_status: "pending",
        sr_bot_stage:      "qualifying",
        sr_source:         resolvedSource as Parameters<typeof createSrLead>[2]["sr_source"],
        sr_opted_out:      false,
      });

      const ghlOpportunityId = await createGhlOpportunity({
        ghlContactId,
        contactName:     lead.customerName,
        pipelineId:      process.env.GHL_PIPELINE_INSPECTION!,
        pipelineStageId: process.env.GHL_STAGE_NEW_LEAD!,
        sourceName:      resolvedSource,
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data:  { ghlOpportunityId },
      });
    } catch (err) {
      console.error("[qualify/start] GHL sync failed:", err);
    }
  }

  return NextResponse.json({ token: newToken });
}
