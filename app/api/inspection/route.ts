import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";
import { canViewInspection } from "@/src/lib/permissions";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // Admins and managers can see all; others see only their own
  const where = {
    ...(canViewInspection(user.id, user.role, { userId: "" })
      ? {}
      : { userId: user.id }),
    ...(status ? { status } : {}),
  };

  // For roles that can view all, don't restrict by userId
  const scopedWhere =
    user.role === "ADMIN" || user.role === "REGIONAL" || user.role === "SALES_MANAGER"
      ? status ? { status } : {}
      : { userId: user.id, ...(status ? { status } : {}) };

  const inspections = await prisma.inspection.findMany({
    where: scopedWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      quote: true,
      _count: { select: { reportVisits: true } },
    },
  });

  return NextResponse.json(inspections);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { repName } = body;

  const inspection = await prisma.inspection.create({
    data: {
      userId: user.id,
      repName: repName || null,
    },
    include: {
      structures: true,
      photos: true,
      packages: { orderBy: { order: "asc" } },
      quote: true,
    },
  });

  return NextResponse.json(inspection, { status: 201 });
}
