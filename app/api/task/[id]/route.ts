import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { hasRank } from "@/src/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          streetAddress: true,
          city: true,
          state: true,
          zip: true,
          status: true,
          phone: true,
        },
      },
      inspection: {
        select: { id: true, status: true, createdAt: true },
      },
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isManager = hasRank(user.role, "SALES_MANAGER");
  if (!isManager && task.assignedUserId !== user.id) return forbidden();

  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, assignedUserId: true, availableOutcomes: true, status: true },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isManager = hasRank(user.role, "SALES_MANAGER");
  if (!isManager && task.assignedUserId !== user.id) return forbidden();

  const body = await req.json().catch(() => ({})) as { outcome?: string };

  if (!body.outcome) {
    return NextResponse.json({ error: "outcome is required" }, { status: 422 });
  }

  if (
    task.availableOutcomes.length > 0 &&
    !task.availableOutcomes.includes(body.outcome)
  ) {
    return NextResponse.json({ error: "Invalid outcome for this task type" }, { status: 422 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      outcome: body.outcome,
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
