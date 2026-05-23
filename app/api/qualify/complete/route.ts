import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag } from "@/src/lib/ghl-sms";

async function fireGhlWebhook(payload: object) {
  const url = process.env.GHL_LEADS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[qualify/complete] GHL webhook failed:", err);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { token, roofAge, knownIssues, lastInspected, bestTime, decisionMakerHome } = body as {
    token?: string;
    roofAge?: string;
    knownIssues?: string[];
    lastInspected?: string;
    bestTime?: string;
    decisionMakerHome?: string;
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

  const tier = jwtPayload.tier as string | undefined;
  const qualifyCompletedAt = new Date();

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      roofAge,
      knownIssues: knownIssues ?? [],
      lastInspected,
      bestTime,
      decisionMakerHome,
      qualifyCompletedAt,
      ...(tier === "primary" ? { status: "INSPECTION_SCHEDULED" } : {}),
    },
  });

  if (updatedLead.ghlContactId) {
    try {
      await addGhlTag(updatedLead.ghlContactId, "qualify_complete");
    } catch (err) {
      console.error("[qualify/complete] addGhlTag failed:", err);
    }
  }

  await fireGhlWebhook({
    event: "lead_qualified",
    lead_id: updatedLead.id,
    name: updatedLead.customerName,
    phone: updatedLead.phone,
    zip: updatedLead.sourceZip,
    roof_age: roofAge,
    known_issues: knownIssues,
    last_inspected: lastInspected,
    best_time: bestTime,
    decision_maker_home: decisionMakerHome,
    qualified_at: qualifyCompletedAt.toISOString(),
  });

  return NextResponse.json({ success: true });
}
