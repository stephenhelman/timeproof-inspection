import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";
import { addGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import { moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: inspectionId } = await params;
  const body = await req.json().catch(() => ({})) as { notes?: string };
  const notes = (body.notes ?? "").trim();

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          streetAddress: true,
          city: true,
          ghlContactId: true,
          ghlOpportunityId: true,
        },
      },
    },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  const lead = inspection.lead;
  if (!lead) {
    return NextResponse.json({ error: "No lead linked to this inspection" }, { status: 422 });
  }

  // Find a manager to assign the Task to. Prefer SALES_MANAGER, then REGIONAL, then ADMIN.
  const manager = await prisma.user.findFirst({
    where: { role: { in: ["SALES_MANAGER", "REGIONAL", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  // Create Task if a manager is found
  if (manager) {
    await prisma.task.create({
      data: {
        leadId: lead.id,
        inspectionId,
        assignedUserId: manager.id,
        type: "ESCALATION",
        status: "PENDING",
        context: notes || `Escalated by ${user.email} from inspection ${inspectionId}`,
        availableOutcomes: ["resolved", "escalated_to_manager", "lead_dead"],
        createdBy: "BOT",
      },
    });
  }

  // GHL writes
  const ghlId = lead.ghlContactId;
  const oppId = lead.ghlOpportunityId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";

  if (ghlId) {
    await addGhlTag(ghlId, "sr_escalation").catch(async (err) => {
      await prisma.webhookLog.create({
        data: {
          source: "escalate_tag",
          payload: { inspectionId, leadId: lead.id } as Prisma.InputJsonObject,
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
          leadId: lead.id,
        },
      }).catch(() => {});
    });

    await updateSrLead(ghlId, { sr_bot_stage: "silent" }).catch(async (err) => {
      await prisma.webhookLog.create({
        data: {
          source: "escalate_sr_update",
          payload: { inspectionId, leadId: lead.id },
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
          leadId: lead.id,
        },
      }).catch(() => {});
    });

    if (oppId && process.env.GHL_STAGE_MANAGER_REVIEW) {
      await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_MANAGER_REVIEW).catch(async (err) => {
        await prisma.webhookLog.create({
          data: {
            source: "escalate_stage",
            payload: { inspectionId, leadId: lead.id },
            status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
            leadId: lead.id,
          },
        }).catch(() => {});
      });
    }
  }

  await notifyManager(
    `Escalation — ${lead.customerName}\n${lead.streetAddress ?? ""}, ${lead.city ?? ""}\n${appUrl}/leads/${lead.id}${notes ? `\n\nNotes: ${notes}` : ""}`,
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
