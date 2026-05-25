import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/src/lib/prisma";
import { createGhlOpportunity, updateGhlContactFields } from "@/src/lib/ghl-contacts";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import { resolveSource } from "@/src/lib/source-utils";

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
    // 1. Update GHL contact with qualify form data
    await updateGhlContactFields(updatedLead.ghlContactId, {
      roofAge:       roofAge ?? undefined,
      issuesNoticed: Array.isArray(knownIssues)
                       ? knownIssues.join(",")
                       : knownIssues ?? undefined,
      lastInspected: lastInspected ?? undefined,
    }).catch(err => console.error("[qualify/complete] updateGhlContactFields failed:", err));

    // 2. Create opportunity — triggers GHL Workflow 2 which fires qualify bot opener
    if (!updatedLead.ghlOpportunityId) {
      try {
        const resolvedSource  = resolveSource(updatedLead.source, "inspection");
        const ghlOpportunityId = await createGhlOpportunity({
          ghlContactId:    updatedLead.ghlContactId,
          contactName:     updatedLead.customerName,
          pipelineId:      process.env.GHL_PIPELINE_INSPECTION!,
          pipelineStageId: process.env.GHL_STAGE_NEW_LEAD!,
          sourceName:      resolvedSource,
        });

        await prisma.lead.update({
          where: { id: updatedLead.id },
          data:  { ghlOpportunityId },
        });
      } catch (err) {
        console.error("[qualify/complete] createGhlOpportunity failed:", err);
        // Non-blocking — lead is saved; bot may need manual activation if this fails
      }
    }

    // 3. Mark qualify complete — do NOT change sr_bot_stage; Alex owns that
    await updateSrLead(updatedLead.id, {
      sr_qualify_status: "complete",
    }).catch(err => console.error("[qualify/complete] updateSrLead failed:", err));
  }

  return NextResponse.json({ success: true });
}
