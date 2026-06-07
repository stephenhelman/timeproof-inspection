import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { logWebhookHit } from "@/src/lib/bot-webhook-utils";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ghl-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ghlContactId, ghlRecordId, srLeadId, ghlOpportunityId } = body as {
    ghlContactId?: string;
    ghlRecordId?: string;
    srLeadId?: string;
    ghlOpportunityId?: string;
  };

  if (!ghlContactId) {
    return NextResponse.json({ error: "ghlContactId is required" }, { status: 400 });
  }
  if (!ghlRecordId) {
    return NextResponse.json({ error: "ghlRecordId is required" }, { status: 400 });
  }
  if (!srLeadId) {
    return NextResponse.json({ error: "srLeadId is required" }, { status: 400 });
  }

  const srLead = await prisma.srLead.findFirst({
    where: { ghlContactId },
  });

  if (!srLead) {
    await logWebhookHit({
      source: "sr_lead_created",
      payload: body,
      success: false,
      error: `SrLead not found for ghlContactId: ${ghlContactId}`,
    });
    return NextResponse.json({ error: "SrLead not found" }, { status: 404 });
  }

  try {
    const srLeadUpdate: { ghlRecordId: string; srLeadId?: string } = { ghlRecordId };
    if (srLeadId !== srLead.srLeadId) {
      srLeadUpdate.srLeadId = srLeadId;
    }

    await prisma.srLead.update({
      where: { id: srLead.id },
      data: srLeadUpdate,
    });

    if (ghlOpportunityId) {
      const lead = await prisma.lead.findUnique({
        where: { id: srLead.leadId },
        select: { id: true, ghlOpportunityId: true },
      });
      if (lead && !lead.ghlOpportunityId) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { ghlOpportunityId },
        });
      }
    }

    await logWebhookHit({
      source: "sr_lead_created",
      payload: body,
      success: true,
      leadId: srLead.leadId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sr-lead-created] DB write failed:", message);
    await logWebhookHit({
      source: "sr_lead_created",
      payload: body,
      success: false,
      error: message,
      leadId: srLead.leadId,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
