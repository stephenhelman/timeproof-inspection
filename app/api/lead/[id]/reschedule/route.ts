import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms } from "@/src/lib/ghl-sms";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canEditLead } from "@/src/lib/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body?.newDatetime || !body?.reason) {
    return NextResponse.json(
      { error: "newDatetime and reason are required" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      inspections: {
        where: { status: "scheduled" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditLead(user.id, user.role, lead)) return forbidden();

  const newDate = new Date(body.newDatetime);
  if (isNaN(newDate.getTime())) {
    return NextResponse.json({ error: "Invalid newDatetime" }, { status: 422 });
  }

  const inspection = lead.inspections[0];

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: params.id },
      data: {
        status: "INSPECTION_SCHEDULED",
        rescheduleReason: body.reason,
      },
    });
  });

  if (lead.ghlContactId) {
    const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
    const dayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: tz,
    }).format(newDate);
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(newDate);
    const firstName = lead.customerName.trim().split(/\s+/)[0];
    await sendGhlSms(
      lead.ghlContactId,
      `Hi ${firstName}! Your inspection has been rescheduled to ${dayLabel} at ${timeLabel.toLowerCase()}. See you then!`,
    ).catch((e) => console.warn("[reschedule] SMS failed:", e));
  }

  const updated = await prisma.lead.findUnique({ where: { id: params.id } });
  return NextResponse.json(updated);
}
