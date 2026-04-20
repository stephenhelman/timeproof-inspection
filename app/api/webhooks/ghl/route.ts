import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { STAGE_MAP } from "@/src/lib/ghl-stage-map";

export async function POST(req: Request) {
  const secret = req.headers.get("x-ghl-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  console.log("[GHL webhook] inbound payload:", JSON.stringify(body));

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const newStage: string | undefined = body?.customData?.newStage;
  const scopeReportsLeadId: string | undefined = body?.customData?.scopeReportsLeadId;

  if (!newStage) {
    return NextResponse.json({ error: "customData.newStage is required" }, { status: 400 });
  }
  if (!scopeReportsLeadId) {
    return NextResponse.json({ error: "customData.scopeReportsLeadId is required" }, { status: 400 });
  }

  const mappedFields = STAGE_MAP[newStage];
  if (!mappedFields) {
    // Unknown stage — return 200 silently so GHL does not retry
    console.log(`[GHL webhook] unknown stage "${newStage}" — ignored`);
    return NextResponse.json({ ignored: true, newStage });
  }

  const lead = await prisma.lead.findUnique({ where: { id: scopeReportsLeadId } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (mappedFields.status)        updateData.status        = mappedFields.status;
  if (mappedFields.revivalStatus) updateData.revivalStatus = mappedFields.revivalStatus;
  if (mappedFields.revivalOutcome) updateData.revivalOutcome = mappedFields.revivalOutcome;

  await prisma.lead.update({ where: { id: scopeReportsLeadId }, data: updateData });

  return NextResponse.json({ updated: true, leadId: scopeReportsLeadId, newStage });
}
