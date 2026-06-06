import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { hasRank } from "@/src/lib/permissions";
import {
  createAppointmentWithInspection,
  slotToUtc,
  deriveZoneForLead,
} from "@/src/lib/appointment-service";
import type { AppointmentSource } from "@prisma/client";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const canViewAll = hasRank(user.role, "SALES_MANAGER");

  const appointments = await prisma.appointment.findMany({
    where: canViewAll ? {} : { assignedUserId: user.id },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          streetAddress: true,
          city: true,
          state: true,
          address: true,
        },
      },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { leadId, slotDate, slotTime, slotLabel, assignedUserId } = body as {
    leadId?: string;
    slotDate?: string;
    slotTime?: string;
    slotLabel?: string;
    assignedUserId?: string;
  };

  if (!leadId || !slotDate || !slotTime) {
    return NextResponse.json(
      { error: "leadId, slotDate, and slotTime are required" },
      { status: 400 },
    );
  }

  // Validate date/time format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !/^\d{2}:\d{2}$/.test(slotTime)) {
    return NextResponse.json(
      { error: "slotDate must be YYYY-MM-DD and slotTime must be HH:mm" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { assignedUserId: true, sourceZip: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const resolvedAssignedUserId =
    (assignedUserId as string | undefined) ?? lead.assignedUserId ?? user.id;

  // REPs can only book for themselves or leads assigned to them
  if (
    !hasRank(user.role, "SALES_MANAGER") &&
    resolvedAssignedUserId !== user.id
  ) {
    return forbidden("You can only book appointments for yourself");
  }

  const scheduledAt = slotToUtc(slotDate, slotTime);
  const zone = deriveZoneForLead(lead.sourceZip ?? null);

  try {
    const result = await createAppointmentWithInspection({
      leadId,
      assignedUserId: resolvedAssignedUserId,
      scheduledAt,
      slotLabel: slotLabel ?? undefined,
      zone,
      createdBy: "REP" as AppointmentSource,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/appointment]", err);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
