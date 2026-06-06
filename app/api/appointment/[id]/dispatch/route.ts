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
          address: true,
          streetAddress: true,
          city: true,
          state: true,
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

  if (appointment.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: `Cannot dispatch from status: ${appointment.status}` },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "EN_ROUTE" },
  });

  const lead = appointment.lead;
  const ghlContactId = lead.ghlContactId;

  // Send homeowner "on the way" SMS
  if (ghlContactId && lead.customerName) {
    const firstName = lead.customerName.trim().split(/\s+/)[0];
    const address =
      lead.address ??
      [lead.streetAddress, lead.city, lead.state].filter(Boolean).join(", ") ??
      "your home";
    const sms = `Hi ${firstName}! Your Scope Reports inspector is on the way to ${address}. We'll see you soon!`;
    await sendGhlSms(ghlContactId, sms).catch((err) =>
      console.error("[dispatch] homeowner SMS failed:", err),
    );
  }

  // GHL opportunity stage sync (optional env var)
  if (lead.ghlOpportunityId && process.env.GHL_STAGE_EN_ROUTE) {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_EN_ROUTE).catch(
      (err) => console.error("[dispatch] GHL stage sync failed:", err),
    );
  }

  return NextResponse.json(updated);
}
