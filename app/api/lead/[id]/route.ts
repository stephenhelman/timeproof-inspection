import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      inspections: {
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      },
      assignedUser: { select: { id: true, name: true, email: true } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  const allowedFields = [
    "customerName",
    "address",
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
      // Parse date fields
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
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
