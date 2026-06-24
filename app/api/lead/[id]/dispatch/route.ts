import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms } from "@/src/lib/ghl-sms";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canEditLead } from "@/src/lib/permissions";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { inspections: { where: { status: "scheduled" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditLead(user.id, user.role, lead)) return forbidden();

  const inspection = lead.inspections[0];
  if (!inspection) return NextResponse.json({ error: "No scheduled inspection found" }, { status: 400 });
  if (inspection.dispatchedAt) return NextResponse.json({ error: "Already dispatched" }, { status: 409 });

  const [updatedInspection, updatedLead] = await prisma.$transaction([
    prisma.inspection.update({
      where: { id: inspection.id },
      data: { dispatchedAt: new Date() },
    }),
    prisma.lead.update({
      where: { id: params.id },
      data: { status: "EN_ROUTE" },
    }),
  ]);

  if (lead.ghlContactId && lead.phone) {
    const firstName = lead.customerName.trim().split(/\s+/)[0];
    await sendGhlSms(
      lead.ghlContactId,
      `Hi ${firstName}! Your Qntum Roofing inspector is on the way. We'll see you shortly — usually within 15–30 minutes.`
    ).catch((err) => console.warn("[dispatch] SMS failed:", err));
  }

  void updatedInspection;
  return NextResponse.json(updatedLead);
}
