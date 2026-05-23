import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { getAvailableSlots } from "@/src/lib/bot-engine";
import { getZoneForZip, isDistanceZone } from "@/src/lib/service-zones";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { sourceZip: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zone = lead.sourceZip ? getZoneForZip(lead.sourceZip) : null;
  const distanceZone = zone ? isDistanceZone(zone) : false;
  const slots = await getAvailableSlots(zone ?? "el_paso_central", distanceZone);

  return NextResponse.json({ slots, zone });
}
