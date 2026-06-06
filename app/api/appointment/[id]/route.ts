import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { hasRank } from "@/src/lib/permissions";
import type { AppointmentStatus } from "@prisma/client";

const VALID_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          streetAddress: true,
          city: true,
          state: true,
          address: true,
          phone: true,
          ghlOpportunityId: true,
        },
      },
      inspection: {
        select: { id: true, reportUuid: true, status: true },
      },
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (
    !hasRank(user.role, "SALES_MANAGER") &&
    appointment.assignedUserId !== user.id
  ) {
    return forbidden();
  }

  return NextResponse.json(appointment);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { assignedUserId: true, status: true },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (
    !hasRank(user.role, "SALES_MANAGER") &&
    appointment.assignedUserId !== user.id
  ) {
    return forbidden();
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { status } = body;

  if (!status || !VALID_STATUSES.includes(status as AppointmentStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: status as AppointmentStatus },
  });

  return NextResponse.json(updated);
}
