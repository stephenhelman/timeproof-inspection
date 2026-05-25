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

function generateGuideSlug(firstName: string, city: string): string {
  const cleanFirst = firstName.toLowerCase().trim().replace(/[^a-z]/g, '').slice(0, 12);
  const cleanCity = city.toLowerCase().trim().replace(/[^a-z ]/g, '').replace(/\s+/g, '').slice(0, 12);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${cleanFirst}-${cleanCity}-${suffix}`;
}

const VALID_SOURCES = ['facebook-guide', 'door', 'card', 'organic'] as const;
type ValidSource = typeof VALID_SOURCES[number];

function normalizeSource(raw?: string): ValidSource {
  const trimmed = raw?.trim() ?? '';
  return (VALID_SOURCES as readonly string[]).includes(trimmed) ? (trimmed as ValidSource) : 'organic';
}

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
    street,
    city,
    state,
    zip,
    source,
    rep,
  } = body as {
    roofType?: string;
    roofAge?: string;
    issuesNoticed?: string[];
    lastInspected?: string;
    name?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
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
  const cityVal = city?.trim() ?? "";

  let lead = await prisma.lead.findFirst({
    where: { phone: phone.trim() },
    orderBy: { createdAt: "desc" },
  });

  if (lead?.guideSlug) {
    // Already has a slug — return existing guide URL
    return NextResponse.json({
      slug: lead.guideSlug,
      guideUrl: `/roof-guide/${lead.guideSlug}`,
    });
  }

  if (lead) {
    // Exists without slug — update fields and issue token below
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        roofType: roofType.trim(),
        roofAge: roofAge?.trim() ?? lead.roofAge,
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim() ?? lead.lastInspected,
        guideSource: normalizeSource(source),
        rep: rep?.trim() ?? lead.rep,
        guideUnlockedAt,
        ...(cityVal && { city: cityVal }),
        ...(state?.trim() && { state: state.trim() }),
        ...(zip?.trim() && { zip: zip.trim() }),
        ...(street?.trim() && { streetAddress: street.trim() }),
      },
    });
  } else {
    // New lead — create record
    lead = await prisma.lead.create({
      data: {
        customerName: name.trim(),
        phone: phone.trim(),
        streetAddress: street?.trim() ?? "",
        city: cityVal,
        state: state?.trim() ?? "TX",
        zip: zip?.trim() ?? "",
        source: source?.trim() ?? "free-guide",
        roofType: roofType.trim(),
        roofAge: roofAge?.trim() ?? null,
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim() ?? null,
        guideSource: normalizeSource(source),
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

  // Generate slug and persist token + slug
  const slug = generateGuideSlug(firstName, cityVal || "elpaso");
  await prisma.lead.update({
    where: { id: lead.id },
    data: { guideToken: token, guideSlug: slug },
  });

  // Fire GHL webhook
  await fireGhlWebhook({
    event: "guide_lead_captured",
    lead_id: lead.id,
    name: name.trim(),
    phone: phone.trim(),
    address: [street?.trim(), cityVal, state?.trim(), zip?.trim()].filter(Boolean).join(", "),
    roof_type: roofType.trim(),
    roof_age: roofAge?.trim() ?? "",
    issues_noticed: issuesArray.join(","),
    last_inspected: lastInspected?.trim() ?? "",
    source: source?.trim() ?? "",
    rep: rep?.trim() ?? "",
    captured_at: guideUnlockedAt.toISOString(),
  });

  return NextResponse.json({
    slug,
    guideUrl: `/roof-guide/${slug}`,
  });
}
