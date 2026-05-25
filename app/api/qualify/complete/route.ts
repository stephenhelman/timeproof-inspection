import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag } from "@/src/lib/ghl-sms";
import { moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";
import { updateSrLead } from "@/src/lib/ghl-custom-object";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { token, roofAge, knownIssues, lastInspected, bestTime, decisionMakerHome } = body as {
    token?:               string;
    roofAge?:             string;
    knownIssues?:         string[];
    lastInspected?:       string;
    bestTime?:            string;
    decisionMakerHome?:   string;
  };

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  let jwtPayload: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(token, secret);
    jwtPayload = payload as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const leadId = jwtPayload.leadId as string | undefined;
  if (!leadId) {
    return NextResponse.json({ error: "Token does not contain a leadId" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const tier               = jwtPayload.tier as string | undefined;
  const qualifyCompletedAt = new Date();

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      roofAge,
      knownIssues:       knownIssues ?? [],
      lastInspected,
      bestTime,
      decisionMakerHome,
      qualifyCompletedAt,
      ...(tier === "primary" ? { status: "INSPECTION_SCHEDULED" } : {}),
    },
  });

  if (updatedLead.ghlContactId) {
    await Promise.allSettled([
      addGhlTag(updatedLead.ghlContactId, "qualify_complete"),
      updateSrLead(updatedLead.id, {
        sr_qualify_status: "complete",
        sr_bot_stage:      "booking",
      }),
      updatedLead.ghlOpportunityId
        ? moveGhlOpportunityStage(
            updatedLead.ghlOpportunityId,
            process.env.GHL_STAGE_BOOKING!
          )
        : Promise.resolve(),
    ]).catch(err => console.error("[qualify/complete] GHL sync failed:", err));
  }

  return NextResponse.json({ success: true });
}
