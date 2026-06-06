import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";
import { getAvailableSlots } from "@/src/lib/bot-engine";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { sourceZip: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const zone = lead.sourceZip
    ? (getZoneForZip(lead.sourceZip) ?? "el_paso_central")
    : "el_paso_central";
  const isDistance = isDistanceZone(zone);

  const slots = await getAvailableSlots(zone, isDistance);

  return NextResponse.json({ slots, zone });
}
