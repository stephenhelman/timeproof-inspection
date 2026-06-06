import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { autoFlagRevival } from "@/src/lib/leads";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canViewLead, canEditLead, canDeleteLead } from "@/src/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      inspections: { orderBy: { createdAt: "desc" } },
      assignedUser: { select: { id: true, name: true, email: true } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canViewLead(user.id, user.role, lead)) return forbidden();

  return NextResponse.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditLead(user.id, user.role, existing)) return forbidden();

  const body = await req.json().catch(() => ({}));

  const allowedFields = [
    "customerName",
    "streetAddress",
    "city",
    "state",
    "zip",
    "phone",
    "email",
    "assignedTech",
    "createdBy",
    "source",
    "externalId",
    "highestEstimateValue",
    "priorQuoteUrl",
    "eagleViewUrl",
    "status",
    "revivalStatus",
    "revivalOutcome",
    "revivalNotes",
    "revivalCalledAt",
    "revivalCalledBy",
    "jobCompletionDate",
    "assignedUserId",
    "setterUserId",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body) {
      const val = body[key];
      if (
        (key === "jobCompletionDate" ||
          key === "revivalCalledAt") &&
        val
      ) {
        updateData[key] = new Date(val);
      } else {
        updateData[key] = val;
      }
    }
  }

  if (
    updateData.status === "REVIVAL_RECOVERED" &&
    !updateData.revivalOutcome &&
    existing.revivalOutcome === null
  ) {
    updateData.revivalOutcome = "RECOVERED";
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: {
      inspections: { orderBy: { createdAt: "desc" } },
    },
  });

  await autoFlagRevival(id);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canDeleteLead(user.role)) return forbidden("Only admins can delete leads");

  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.inspection.deleteMany({ where: { leadId: id } });
  await prisma.lead.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
