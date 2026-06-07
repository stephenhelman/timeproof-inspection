import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canViewInspection, canEditInspection, canDeleteInspection } from "@/src/lib/permissions";

async function fetchInspection(id: string) {
  return prisma.inspection.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { photoNumber: "asc" } },
      reportVisits: { include: { sections: true } },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const inspection = await fetchInspection(id);
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canViewInspection(user.id, user.role, inspection)) return forbidden();

  return NextResponse.json(inspection);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = await fetchInspection(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditInspection(user.id, user.role, existing)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const inspectionData = body;

  const allowedFields = [
    "customerName", "address", "phone", "email",
    "repName", "status",
    "ownershipLength", "previousRoofWork", "previousRoofWhen",
    "previousRoofWhy", "previousRoofNotes", "previousWork",
    "activeLeaks", "leakLocation", "issues", "thingsToKnow",
    "allDecisionMakers", "priorities", "findings",
    "findingsNotes", "productionNotes", "gateCode",
    "hasPets", "accessIssues", "hoaRestrictions", "hoaDetails", "colorSelected",
    "specialRequests", "followUpNotes",
    "northStar", "focusDrivers", "timeInHome", "yearBuilt", "ageOfRoof",
    "lastReplacedBy", "pastRepairs", "otherProjects", "hoaPresent", "hoaName",
    "issuesConcerns", "issueDuration", "issueImpact", "rootCauseBeliefBefore",
    "triggerMoment", "priorMeetingHad", "priorMeetingWho", "priorMeetingRecommended",
    "priorMeetingWhyNotFixed", "noPriorMeetingReason", "winDefinition",
    "personalFamily", "personalOccupation", "personalRecreation", "personalIdentity",
    "decisionMakers", "decisionMakersWho", "setterName",
    "problemAwarenessBefore", "problemAwarenessAfter",
    "intakePass1Complete", "intakePass2Complete",
    "repNotes", "diagnosis", "warningSignsCovered", "qntumExportedAt",
    "intakePass1", "warningSignResponses", "intakePass2",
    "aiDiagnosisDescription", "aiGeneratedAt",
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in inspectionData) updateData[key] = inspectionData[key];
  }

  const updated = await prisma.inspection.update({
    where: { id },
    data: updateData,
    include: {
      photos: { orderBy: { photoNumber: "asc" } },
      reportVisits: { include: { sections: true } },
    },
  });

  if (updateData.status === "complete" && existing.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: existing.leadId }, select: { status: true } });
    if (lead && ["NEW", "INSPECTION_SCHEDULED", "REVIVAL_PENDING"].includes(lead.status)) {
      await prisma.lead.update({ where: { id: existing.leadId }, data: { status: "INSPECTION_COMPLETE" } });
    }
  }

  if (updateData.status === "sold" && existing.leadId) {
    await prisma.lead.update({ where: { id: existing.leadId }, data: { status: "SOLD" } });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = await prisma.inspection.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canDeleteInspection(user.id, user.role, existing)) return forbidden();

  await prisma.inspection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
