import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/src/lib/prisma";
import { upsertGhlContact, createGhlOpportunity } from "@/src/lib/ghl-contacts";
import { createSrLead } from "@/src/lib/ghl-custom-object";
import { resolveSource } from "@/src/lib/source-utils";
import { getZoneForZip } from "@/src/lib/service-zones";

function generateGuideSlug(firstName: string, city: string): string {
  const cleanFirst = firstName.toLowerCase().trim().replace(/[^a-z]/g, '').slice(0, 12);
  const cleanCity  = city.toLowerCase().trim().replace(/[^a-z ]/g, '').replace(/\s+/g, '').slice(0, 12);
  const suffix     = Math.random().toString(36).slice(2, 6);
  return `${cleanFirst}-${cleanCity}-${suffix}`;
}

const VALID_SOURCES = ['facebook-guide', 'door', 'card', 'organic'] as const;
type ValidSource = typeof VALID_SOURCES[number];

function normalizeSource(raw?: string): ValidSource {
  const trimmed = raw?.trim() ?? '';
  return (VALID_SOURCES as readonly string[]).includes(trimmed) ? (trimmed as ValidSource) : 'organic';
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
    roofType?:      string;
    roofAge?:       string;
    issuesNoticed?: string[];
    lastInspected?: string;
    name?:          string;
    phone?:         string;
    street?:        string;
    city?:          string;
    state?:         string;
    zip?:           string;
    source?:        string;
    rep?:           string;
  };

  if (!name?.trim() || !phone?.trim() || !roofType?.trim()) {
    return NextResponse.json(
      { error: "name, phone, and roofType are required" },
      { status: 400 }
    );
  }

  const secret         = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const firstName      = name.trim().split(" ")[0];
  const issuesArray    = Array.isArray(issuesNoticed) ? issuesNoticed : [];
  const guideUnlockedAt = new Date();
  const cityVal        = city?.trim() ?? "";
  const resolvedSource = resolveSource(source, "guide");

  let lead = await prisma.lead.findFirst({
    where:   { phone: phone.trim() },
    orderBy: { createdAt: "desc" },
  });

  if (lead?.guideSlug) {
    return NextResponse.json({
      slug:     lead.guideSlug,
      guideUrl: `/roof-guide/${lead.guideSlug}`,
    });
  }

  if (lead) {
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        roofType:      roofType.trim(),
        roofAge:       roofAge?.trim() ?? lead.roofAge,
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim() ?? lead.lastInspected,
        guideSource:   normalizeSource(source),
        rep:           rep?.trim() ?? lead.rep,
        guideUnlockedAt,
        ...(cityVal            && { city:          cityVal }),
        ...(state?.trim()      && { state:         state.trim() }),
        ...(zip?.trim()        && { zip:           zip.trim() }),
        ...(street?.trim()     && { streetAddress: street.trim() }),
      },
    });
  } else {
    lead = await prisma.lead.create({
      data: {
        customerName:  name.trim(),
        phone:         phone.trim(),
        streetAddress: street?.trim() ?? "",
        city:          cityVal,
        state:         state?.trim() ?? "TX",
        zip:           zip?.trim() ?? "",
        source:        source?.trim() ?? "free-guide",
        roofType:      roofType.trim(),
        roofAge:       roofAge?.trim() ?? null,
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim() ?? null,
        guideSource:   normalizeSource(source),
        rep:           rep?.trim() ?? null,
        status:        "NEW",
        guideUnlockedAt,
      },
    });
  }

  // Sign guide JWT — no expiry, guide access is permanent
  const token = await new SignJWT({
    leadId:        lead.id,
    roofType:      roofType.trim(),
    roofAge:       roofAge?.trim() ?? "",
    issuesNoticed: issuesArray,
    firstName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);

  const slug = generateGuideSlug(firstName, cityVal || "elpaso");
  await prisma.lead.update({
    where: { id: lead.id },
    data:  { guideToken: token, guideSlug: slug },
  });

  // Only create GHL contact + opportunity for new leads (no ghlContactId yet)
  if (!lead.ghlContactId) {
    try {
      const { ghlContactId } = await upsertGhlContact({
        firstName:     firstName,
        lastName:      name.trim().split(" ").slice(1).join(" "),
        phone:         phone.trim(),
        address1:      street?.trim(),
        city:          cityVal || undefined,
        state:         state?.trim(),
        postalCode:    zip?.trim(),
        srSource:      resolvedSource,
        srBotStage:    "nurture",
        leadId:        lead.id,
        rep:           rep?.trim() ?? "",
        roofType:      roofType.trim(),
        roofAge:       roofAge?.trim(),
        issuesNoticed: issuesArray.join(","),
        lastInspected: lastInspected?.trim(),
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data:  { ghlContactId },
      });

      await createSrLead(ghlContactId, lead.id, {
        sr_lead_id:        lead.id,
        sr_tier:           "primary",
        sr_zone:           getZoneForZip(zip?.trim() ?? "") ?? "unknown",
        sr_status:         "NEW",
        sr_qualify_status: "pending",
        sr_bot_stage:      "nurture",
        sr_source:         resolvedSource as Parameters<typeof createSrLead>[2]["sr_source"],
        sr_opted_out:      false,
      });

      const ghlOpportunityId = await createGhlOpportunity({
        ghlContactId,
        contactName:     lead.customerName,
        pipelineId:      process.env.GHL_PIPELINE_ROOF_GUIDE!,
        pipelineStageId: process.env.GHL_STAGE_GUIDE_SUBMITTED!,
        sourceName:      resolvedSource,
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data:  { ghlOpportunityId },
      });
    } catch (err) {
      console.error("[guide/intake] GHL sync failed:", err);
    }
  }

  return NextResponse.json({
    slug,
    guideUrl: `/roof-guide/${slug}`,
  });
}
