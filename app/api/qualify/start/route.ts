import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/src/lib/prisma";

const SMS_CONSENT_TEXT =
  "By providing your phone number, you consent to receive text messages from Qntum Roofing regarding your inspection request. Message and data rates may apply. Reply STOP at any time to opt out.";

async function fireGhlWebhook(payload: object) {
  const url = process.env.GHL_LEADS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[qualify/start] GHL webhook failed:", err);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, phone, email, zip, tier, token } = body as {
    name?: string;
    phone?: string;
    email?: string;
    zip?: string;
    tier?: string;
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

  const resolvedZip = (jwtPayload.zip as string) ?? zip ?? "";
  const resolvedTier = (jwtPayload.tier as string) ?? tier ?? "";
  const smsConsentAt = new Date();
  const smsConsentIp = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";

  let lead;

  // Phase 3: Facebook leads will have a leadId pre-baked in the JWT
  if (jwtPayload.leadId && typeof jwtPayload.leadId === "string") {
    const existing = await prisma.lead.findUnique({ where: { id: jwtPayload.leadId } });
    if (existing) {
      lead = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          customerName: existing.customerName || name,
          phone: existing.phone || phone,
          email: existing.email || email,
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
        customerName: name,
        phone,
        email,
        streetAddress: "",
        city: "",
        state: "",
        zip: resolvedZip,
        sourceZip: resolvedZip,
        sourceTier: resolvedTier,
        source: "organic",
        smsConsentAt,
        smsConsentIp,
        smsConsentText: SMS_CONSENT_TEXT,
      },
    });
  }

  // Issue a new JWT that includes the leadId so /api/qualify/complete can update the record
  const expiryMinutes = parseInt(process.env.QUALIFY_TOKEN_EXPIRY_MINUTES ?? "15", 10);
  const newToken = await new SignJWT({
    zip: resolvedZip,
    tier: resolvedTier,
    leadId: lead.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(secret);

  await fireGhlWebhook({
    event: "lead_captured",
    lead_id: lead.id,
    name,
    phone,
    email,
    zip: resolvedZip,
    tier: resolvedTier,
    source: lead.source,
    captured_at: smsConsentAt.toISOString(),
    sms_consent: true,
    sms_consent_at: smsConsentAt.toISOString(),
    sms_consent_ip: smsConsentIp,
  });

  return NextResponse.json({ token: newToken });
}
