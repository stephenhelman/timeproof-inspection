import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms } from "@/src/lib/ghl-sms";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { inspections: { where: { status: "scheduled" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
