import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { hasRank } from "@/src/lib/permissions";
import { sendGhlSms } from "@/src/lib/ghl-sms";
import { moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";

export async function POST(
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
          customerName: true,
          ghlContactId: true,
          ghlOpportunityId: true,
        },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (!hasRank(user.role, "SALES_MANAGER") && appointment.assignedUserId !== user.id) {
    return forbidden();
  }

  if (appointment.status !== "EN_ROUTE") {
    return NextResponse.json(
      { error: `Cannot arrive from status: ${appointment.status}` },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "IN_PROGRESS" },
  });

  const lead = appointment.lead;
  const ghlContactId = lead.ghlContactId;

  // Send homeowner arrival SMS
  if (ghlContactId && lead.customerName) {
    const firstName = lead.customerName.trim().split(/\s+/)[0];
    const sms = `Hi ${firstName}, your inspector has arrived! We're at the door — looking forward to meeting you.`;
    await sendGhlSms(ghlContactId, sms).catch((err) =>
      console.error("[arrive] homeowner SMS failed:", err),
    );
  }

  // GHL opportunity stage sync (optional env var)
  if (lead.ghlOpportunityId && process.env.GHL_STAGE_IN_PROGRESS) {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_IN_PROGRESS).catch(
      (err) => console.error("[arrive] GHL stage sync failed:", err),
    );
  }

  return NextResponse.json(updated);
}
