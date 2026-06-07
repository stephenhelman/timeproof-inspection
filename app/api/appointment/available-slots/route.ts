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
  const preferredDate = searchParams.get("preferredDate") ?? null; // YYYY-MM-DD
  const startHourRaw = searchParams.get("startHour");
  const specificStartHour = startHourRaw ? parseInt(startHourRaw, 10) : undefined;

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

  const allSlots = await getAvailableSlots(zone, isDistance, "any", specificStartHour);

  // If a preferred date was requested, filter to that date first.
  // Fall back to all available slots if none match (date or time out of range).
  if (preferredDate) {
    const matching = allSlots.filter((s) => s.date === preferredDate);
    if (matching.length > 0) {
      return NextResponse.json({ slots: matching, zone, fallback: false });
    }
    // No match on preferred date — fetch fallback without time restriction
    const fallbackSlots = specificStartHour
      ? await getAvailableSlots(zone, isDistance)
      : allSlots;
    return NextResponse.json({ slots: fallbackSlots, zone, fallback: true });
  }

  return NextResponse.json({ slots: allSlots, zone, fallback: false });
}
