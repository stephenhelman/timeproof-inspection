import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead } from "@/src/lib/ghl-custom-object";

type Outcome =
  | "sold"
  | "demo_not_sold"
  | "credit_fail"
  | "no_show"
  | "porched"
  | "reschedule"
  | "escalate";

const VALID_OUTCOMES = new Set<string>([
  "sold",
  "demo_not_sold",
  "credit_fail",
  "no_show",
  "porched",
  "reschedule",
  "escalate",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { outcome, inspectionId: bodyInspectionId, ...fork } = body as {
    outcome: Outcome;
    inspectionId?: string;
    [k: string]: unknown;
  };

  if (!VALID_OUTCOMES.has(outcome))
    return NextResponse.json({ error: "Invalid outcome" }, { status: 422 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      inspections: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ghlId = lead.ghlContactId;
  const inspId = bodyInspectionId ?? lead.inspections[0]?.id ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";

  try {
    // ── SOLD ────────────────────────────────────────────────────────────────
    if (outcome === "sold") {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({ where: { id: params.id }, data: { status: "SOLD" } });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "sold", status: "complete" },
          });
      });
      if (ghlId) {
        await addGhlTag(ghlId, "sr_sold").catch(() => {});
        await updateSrLead(ghlId, { sr_status: "SOLD", sr_bot_stage: "silent" }).catch(() => {});
      }
      await notifyManager(
        `SOLD — ${lead.customerName}\n${lead.streetAddress}, ${lead.city}\n${appUrl}/leads/${params.id}`
      ).catch(() => {});
    }

    // ── DEMO NOT SOLD ────────────────────────────────────────────────────────
    else if (outcome === "demo_not_sold") {
      if (fork.dispoDecisionMakerPresent === undefined || fork.dispoDecisionMakerPresent === null)
        return NextResponse.json({ error: "Decision maker field is required" }, { status: 422 });
      if (!fork.dispoPrimaryObjection)
        return NextResponse.json({ error: "Primary objection is required" }, { status: 422 });

      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: "DEMO_NOT_SOLD",
            dispoDecisionMakerPresent: fork.dispoDecisionMakerPresent as boolean,
            dispoPrimaryObjection: (fork.dispoPrimaryObjection as string) ?? null,
            dispoNotes: (fork.dispoNotes as string | null) ?? null,
          },
        });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "demo_not_sold" },
          });
      });
      if (ghlId) {
        await addGhlTag(ghlId, "sr_follow_up").catch(() => {});
        await updateSrLead(ghlId, { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "revival" }).catch(() => {});
      }
    }

    // ── CREDIT FAIL ──────────────────────────────────────────────────────────
    else if (outcome === "credit_fail") {
      const lender = (fork.lenderAttempted as string | null) ?? null;
      const rawNotes = (fork.dispoNotes as string | null) ?? null;
      const combined = [lender ? `Lender: ${lender}` : null, rawNotes].filter(Boolean).join("\n") || null;

      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: "QUOTED",
            lenderAttempted: !!lender,
            dispoNotes: combined,
          },
        });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "credit_fail" },
          });
      });
      if (ghlId) {
        await addGhlTag(ghlId, "sr_credit_fail").catch(() => {});
        await updateSrLead(ghlId, { sr_status: "DENIED", sr_bot_stage: "silent" }).catch(() => {});
      }
    }

    // ── NO SHOW ──────────────────────────────────────────────────────────────
    else if (outcome === "no_show") {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: "NO_SHOW",
            dispoNotes: (fork.dispoNotes as string | null) ?? null,
          },
        });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "no_show" },
          });
      });
      if (ghlId) {
        await addGhlTag(ghlId, "sr_follow_up").catch(() => {});
        await updateSrLead(ghlId, { sr_status: "NO_SHOW", sr_bot_stage: "revival" }).catch(() => {});
      }
    }

    // ── PORCHED ──────────────────────────────────────────────────────────────
    else if (outcome === "porched") {
      const waitTime = (fork.waitTime as string | null) ?? null;
      const responded = fork.respondedToContact as boolean | null;
      const rawNotes = (fork.dispoNotes as string | null) ?? null;
      const combined = [
        waitTime ? `Wait: ${waitTime}` : null,
        responded !== null ? `Responded: ${responded ? "Yes" : "No"}` : null,
        rawNotes,
      ]
        .filter(Boolean)
        .join("\n") || null;

      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: "NO_SHOW",
            rescheduleReason: "porched",
            dispoNotes: combined,
          },
        });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "porched" },
          });
      });
      if (ghlId) {
        await addGhlTag(ghlId, "sr_porched").catch(() => {});
        await updateSrLead(ghlId, { sr_status: "NO_SHOW", sr_bot_stage: "revival" }).catch(() => {});
      }
    }

    // ── RESCHEDULE ───────────────────────────────────────────────────────────
    else if (outcome === "reschedule") {
      if (!fork.rescheduleReason)
        return NextResponse.json({ error: "Reschedule reason is required" }, { status: 422 });

      await prisma.lead.update({
        where: { id: params.id },
        data: {
          rescheduleReason: fork.rescheduleReason as string,
          dispoNotes: (fork.dispoNotes as string | null) ?? null,
        },
      });
      // Status stays INSPECTION_SCHEDULED — intentionally not changed.
    }

    // ── ESCALATE ─────────────────────────────────────────────────────────────
    else if (outcome === "escalate") {
      const rawNotes = (fork.dispoNotes as string | null) ?? null;
      if (ghlId) {
        await addGhlTag(ghlId, "sr_escalation").catch(() => {});
        await updateSrLead(ghlId, { sr_bot_stage: "silent" }).catch(() => {});
      }
      await notifyManager(
        `Escalation needed — ${lead.customerName}\n${lead.streetAddress}, ${lead.city}\n${appUrl}/leads/${params.id}${rawNotes ? `\n\nNotes: ${rawNotes}` : ""}`
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dispo]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
