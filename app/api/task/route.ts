import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";
import { hasRank } from "@/src/lib/permissions";
import type { TaskStatus, TaskType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status") as TaskStatus | null;
  const typeFilter = searchParams.get("type") as TaskType | null;
  const assignedUserFilter = searchParams.get("assignedUserId");
  const leadIdFilter = searchParams.get("leadId");
  const inspectionIdFilter = searchParams.get("inspectionId");

  const isManager = hasRank(user.role, "SALES_MANAGER");

  // Non-managers only see their own tasks
  const assignedUserId =
    !isManager ? user.id : assignedUserFilter ?? undefined;

  const tasks = await prisma.task.findMany({
    where: {
      ...(assignedUserId ? { assignedUserId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(leadIdFilter ? { leadId: leadIdFilter } : {}),
      ...(inspectionIdFilter ? { inspectionId: inspectionIdFilter } : {}),
    },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          streetAddress: true,
          city: true,
          state: true,
        },
      },
      inspection: {
        select: { id: true },
      },
      assignedUser: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(tasks);
}
