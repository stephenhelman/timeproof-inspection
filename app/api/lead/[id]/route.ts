import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { autoFlagRevival } from "@/src/lib/leads";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      inspections: {
        orderBy: { createdAt: "desc" },
      },
      assignedUser: { select: { id: true, name: true, email: true } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // REP can only see their assigned leads
  if (user?.role === "REP" && lead.assignedUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user?.role === "REP" && existing.assignedUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    "appointmentDate",
    "jobCompletionDate",
    "assignedUserId",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body) {
      const val = body[key];
      if (
        (key === "appointmentDate" ||
          key === "jobCompletionDate" ||
          key === "revivalCalledAt") &&
        val
      ) {
        updateData[key] = new Date(val);
      } else {
        updateData[key] = val;
      }
    }
  }

  // Auto-set revivalOutcome when status is set to REVIVAL_RECOVERED
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
      inspections: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Auto-flag for revival when applicable
  await autoFlagRevival(id);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade: delete all inspections (and their children) before deleting the lead
  // The lead relation on Inspection uses onDelete: SetNull, so we manually delete first
  await prisma.inspection.deleteMany({ where: { leadId: id } });
  await prisma.lead.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
