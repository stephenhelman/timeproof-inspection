import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag, notifyManager } from "@/src/lib/ghl-sms";

const VALID_OUTCOMES = [
  "SOLD",
  "PENDING_SOLD_CONFIRMATION",
  "DEMO_NOT_SOLD",
  "DENIED",
  "NO_SHOW",
  "QUOTED",
  "REVIVAL_PENDING",
  "DEAD",
] as const;

type Outcome = (typeof VALID_OUTCOMES)[number];

const OUTCOME_TO_STATUS: Record<Outcome, string> = {
  SOLD: "SOLD",
  PENDING_SOLD_CONFIRMATION: "PENDING_SOLD_CONFIRMATION",
  DEMO_NOT_SOLD: "DEMO_NOT_SOLD",
  DENIED: "DENIED",
  NO_SHOW: "NO_SHOW",
  QUOTED: "QUOTED",
  REVIVAL_PENDING: "REVIVAL_PENDING",
  DEAD: "DEAD",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { outcome, dispoDecisionMakerPresent, dispoPrimaryObjection, dispoNotes, lenderAttempted } = body;

  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 422 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { inspections: { where: { status: "scheduled" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = OUTCOME_TO_STATUS[outcome as Outcome];

  const leadUpdate: Record<string, unknown> = {
    status: newStatus,
    dispoDecisionMakerPresent: dispoDecisionMakerPresent ?? null,
    dispoPrimaryObjection: dispoPrimaryObjection ?? null,
    dispoNotes: dispoNotes ?? null,
    lenderAttempted: lenderAttempted ?? null,
  };

  if (outcome === "PENDING_SOLD_CONFIRMATION") {
    leadUpdate.pendingSoldAt = new Date();
    leadUpdate.pendingSoldConfirmedBy = null;
  }

  const inspectionId = lead.inspections[0]?.id;

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: params.id }, data: leadUpdate });
    if (inspectionId) {
      await tx.inspection.update({ where: { id: inspectionId }, data: { outcome, status: "complete" } });
    }
  });

  // Side effects outside transaction
  if (lead.ghlContactId) {
    if (outcome === "REVIVAL_PENDING") {
      await addGhlTag(lead.ghlContactId, "sr_follow_up").catch((e) =>
        console.warn("[dispo] addGhlTag sr_follow_up failed:", e)
      );
    }
    if (outcome === "DEAD") {
      await addGhlTag(lead.ghlContactId, "sr_dead").catch((e) =>
        console.warn("[dispo] addGhlTag sr_dead failed:", e)
      );
    }
  }

  if (outcome === "SOLD") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
    await notifyManager(
      `SOLD — ${lead.customerName}\n${lead.streetAddress}, ${lead.city}\n${appUrl}/leads/${params.id}`
    ).catch((e) => console.warn("[dispo] notifyManager failed:", e));
  }

  const updated = await prisma.lead.findUnique({ where: { id: params.id } });
  return NextResponse.json(updated);
}
