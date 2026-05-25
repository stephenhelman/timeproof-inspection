// GHL MANUAL SETUP REQUIRED:
// 1. Create workflow: Trigger = webhook received at this route
//    Action: Add tag "source_free_guide" to contact
//    Action: Set active conversation webhook to:
//            app.scopereports.com/api/webhooks/ghl/nurture
// 2. Create workflow: Trigger = tag "source_free_guide" added
//    Action: Fire webhook to /api/webhooks/ghl/nurture
//    Body: { contact_id: "{{contact.id}}", message: "new_guide_lead" }
// 3. Map webhook fields in GHL:
//    roof_type → custom field
//    roof_age  → custom field
//    issues_noticed → custom field
//    source → custom field
//    rep → custom field

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/src/lib/prisma";

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
    console.error("[guide/intake] GHL webhook failed:", err);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const {
    roofType,
    roofAge,
    issuesNoticed,
    lastInspected,
    name,
    phone,
    address,
    source,
    rep,
  } = body as {
    roofType?: string;
    roofAge?: string;
    issuesNoticed?: string[];
    lastInspected?: string;
    name?: string;
    phone?: string;
    address?: string;
    source?: string;
    rep?: string;
  };

  if (!name?.trim() || !phone?.trim() || !roofType?.trim()) {
    return NextResponse.json(
      { error: "name, phone, and roofType are required" },
      { status: 400 }
    );
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const firstName = name.trim().split(" ")[0];
  const issuesArray = Array.isArray(issuesNoticed) ? issuesNoticed : [];
  const guideUnlockedAt = new Date();

  let lead = await prisma.lead.findFirst({
    where: { phone: phone.trim() },
    orderBy: { createdAt: "desc" },
  });

  if (lead?.guideToken) {
    // Already has a token — return existing guide URL
    return NextResponse.json({
      token: lead.guideToken,
      guideUrl: `/roof-guide/${lead.guideToken}`,
    });
  }

  if (lead) {
    // Exists without token — update fields and issue token below
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        roofType: roofType.trim(),
        roofAge: roofAge?.trim() ?? lead.roofAge,
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim() ?? lead.lastInspected,
        guideSource: source?.trim() ?? null,
        rep: rep?.trim() ?? lead.rep,
        guideUnlockedAt,
      },
    });
  } else {
    // New lead — create record
    lead = await prisma.lead.create({
      data: {
        customerName: name.trim(),
        phone: phone.trim(),
        streetAddress: address?.trim() ?? "",
        city: "",
        state: "",
        zip: "",
        source: source?.trim() ?? "free-guide",
        roofType: roofType.trim(),
        roofAge: roofAge?.trim() ?? null,
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim() ?? null,
        guideSource: source?.trim() ?? null,
        rep: rep?.trim() ?? null,
        status: "NEW",
        guideUnlockedAt,
      },
    });
  }

  // Sign guide JWT — no expiry, guide access is permanent
  const token = await new SignJWT({
    leadId: lead.id,
    roofType: roofType.trim(),
    roofAge: roofAge?.trim() ?? "",
    issuesNoticed: issuesArray,
    firstName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);

  // Persist token on lead record
  await prisma.lead.update({
    where: { id: lead.id },
    data: { guideToken: token },
  });

  // Fire GHL webhook
  await fireGhlWebhook({
    event: "guide_lead_captured",
    lead_id: lead.id,
    name: name.trim(),
    phone: phone.trim(),
    address: address?.trim() ?? "",
    roof_type: roofType.trim(),
    roof_age: roofAge?.trim() ?? "",
    issues_noticed: issuesArray.join(","),
    last_inspected: lastInspected?.trim() ?? "",
    source: source?.trim() ?? "",
    rep: rep?.trim() ?? "",
    captured_at: guideUnlockedAt.toISOString(),
  });

  return NextResponse.json({
    token,
    guideUrl: `/roof-guide/${token}`,
  });
}
