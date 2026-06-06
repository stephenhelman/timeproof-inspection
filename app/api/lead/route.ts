import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canCreateLead, canViewAllLeads, buildLeadScope } from "@/src/lib/permissions";
import {
  upsertGhlContact,
  createGhlOpportunity,
  findGhlContactByPhone,
} from "@/src/lib/ghl-contacts";
import { createSrLead } from "@/src/lib/ghl-custom-object";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canCreateLead(user.role)) return forbidden("Your role cannot create leads");

  const body = await req.json().catch(() => ({}));
  const {
    customerName,
    streetAddress,
    address,
    city,
    state,
    zip,
    phone,
    email,
    assignedTech,
    source,
    highestEstimateValue,
    jobCompletionDate,
    status,
    assignedUserId,
    setterUserId,
    smsConsentAt,
    smsConsentText,
    syncGhl,
  } = body;

  if (!customerName || !streetAddress) {
    return NextResponse.json(
      { error: "customerName and streetAddress are required" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const lead = await prisma.lead.create({
    data: {
      customerName,
      streetAddress,
      address: address || null,
      city: city || "",
      state: state || "",
      zip: zip || "",
      phone: phone || null,
      email: email || null,
      assignedTech: assignedTech || null,
      source: source || "manual",
      highestEstimateValue: highestEstimateValue ?? null,
      jobCompletionDate: jobCompletionDate ? new Date(jobCompletionDate) : null,
      status: status || "NEW",
      assignedUserId: assignedUserId || user.id,
      setterUserId: setterUserId || null,
      smsConsentAt: smsConsentAt ? new Date(smsConsentAt) : null,
      smsConsentIp: smsConsentAt ? ip : null,
      smsConsentText: smsConsentText || null,
    },
    include: { inspections: true },
  });

  // GHL sync — only for manual rep-created leads (syncGhl: true)
  if (syncGhl && phone) {
    void syncLeadToGhl(lead.id, {
      customerName,
      phone,
      email: email || undefined,
      streetAddress: streetAddress || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
    }).catch((err) => console.error("[POST /api/lead] GHL sync error:", err));
  }

  return NextResponse.json(lead, { status: 201 });
}

async function syncLeadToGhl(
  leadId: string,
  fields: {
    customerName: string;
    phone: string;
    email?: string;
    streetAddress?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  },
): Promise<void> {
  const { customerName, phone, email, streetAddress, address, city, state, zip } = fields;
  const nameParts = customerName.trim().split(/\s+/);

  try {
    // Phone dedup: check GHL first, then upsert
    const existingGhlContactId = await findGhlContactByPhone(phone);

    const { ghlContactId } = await upsertGhlContact(
      {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || "",
        phone,
        email,
        address1: streetAddress || address || undefined,
        city,
        state,
        postalCode: zip,
        srBotStage: "silent",
        srSource: "manual",
        leadId,
      },
      existingGhlContactId ?? undefined,
    );

    await prisma.lead.update({ where: { id: leadId }, data: { ghlContactId } });

    // Create inspection pipeline opportunity at New Lead stage
    let ghlOpportunityId: string | null = null;
    if (process.env.GHL_PIPELINE_INSPECTION && process.env.GHL_STAGE_NEW_LEAD) {
      try {
        ghlOpportunityId = await createGhlOpportunity({
          ghlContactId,
          contactName: customerName,
          pipelineId: process.env.GHL_PIPELINE_INSPECTION,
          pipelineStageId: process.env.GHL_STAGE_NEW_LEAD,
          sourceName: "door-inspection",
        });
        await prisma.lead.update({
          where: { id: leadId },
          data: { ghlOpportunityId },
        });
      } catch (err) {
        console.error("[syncLeadToGhl] createGhlOpportunity failed:", err);
      }
    }

    // Create SrLead record (GHL custom object + DB)
    await createSrLead(ghlContactId, leadId, {
      sr_lead_id: leadId,
      sr_tier: "primary",
      sr_zone: "el_paso_central",
      sr_status: "NEW",
      sr_qualify_status: "complete",
      sr_bot_stage: "silent",
      sr_source: "manual",
      sr_opted_out: false,
    });
  } catch (err) {
    console.error("[syncLeadToGhl] failed — logging to WebhookLog:", err);
    await prisma.webhookLog.create({
      data: {
        source: "lead_ghl_sync_failed",
        payload: { leadId, phone },
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        leadId,
      },
    }).catch(() => null);
  }
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Resolve subordinate IDs for SETTER_MANAGER scoping
  let subordinateIds: string[] | undefined;
  if (user.role === "SETTER_MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    subordinateIds = reports.map((r) => r.id);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const revivalStatus = searchParams.get("revivalStatus");
  const assignedTech = searchParams.get("assignedTech");
  const source = searchParams.get("source");
  const zip = searchParams.get("zip");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const sortBy = searchParams.get("sortBy");
  const sortDir = (searchParams.get("sortDir") || "asc") as "asc" | "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = buildLeadScope(user.id, user.role, subordinateIds) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: Record<string, any> = {};

  if (status) filters.status = status;
  if (revivalStatus) filters.revivalStatus = revivalStatus;
  if (assignedTech) filters.assignedTech = { contains: assignedTech, mode: "insensitive" };
  if (source) filters.source = source;
  if (zip) filters.zip = { contains: zip, mode: "insensitive" };
  if (dateFrom || dateTo) {
    filters.createdAt = {};
    if (dateFrom) filters.createdAt.gte = new Date(dateFrom);
    if (dateTo) filters.createdAt.lte = new Date(dateTo);
  }

  const where = Object.keys(scope).length > 0
    ? { AND: [scope, filters] }
    : filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: Record<string, any> = { updatedAt: "desc" };
  if (sortBy === "zip") orderBy = { zip: sortDir };
  else if (sortBy === "highestEstimateValue") orderBy = { highestEstimateValue: sortDir };

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { inspections: true } },
      inspections: {
        where: { status: "scheduled" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, status: true },
      },
    },
  });

  return NextResponse.json(leads);
}
