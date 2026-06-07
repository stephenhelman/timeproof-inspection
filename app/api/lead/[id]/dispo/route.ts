import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  moveGhlOpportunityStage,
  writeGhlOpportunityCustomField,
} from "@/src/lib/ghl-contacts";

type Outcome =
  | "sold"
  | "demo_not_sold"
  | "no_show"
  | "porched"
  | "reschedule";

const VALID_OUTCOMES = new Set<string>([
  "sold",
  "demo_not_sold",
  "no_show",
  "porched",
  "reschedule",
]);

// Logs a GHL sync call attempt to WebhookLog. Never throws.
async function logGhlSync(
  leadId: string,
  source: string,
  status: "ok" | "error",
  errorMessage?: string,
  payload?: Prisma.InputJsonObject,
) {
  await prisma.webhookLog
    .create({
      data: {
        source,
        payload: payload ?? Prisma.JsonNull,
        status,
        errorMessage: errorMessage ?? null,
        leadId,
      },
    })
    .catch((err) => console.error("[dispo] webhookLog create failed:", err));
}

// Writes sr_inspection_id and sr_appointment_id to GHL opportunity. Logs result.
async function writeDispoIdsToGhl(
  leadId: string,
  ghlOpportunityId: string,
  inspectionId: string | null,
  appointmentId: string | null,
) {
  if (inspectionId && process.env.GHL_FIELD_OPP_SR_INSPECTION_ID) {
    try {
      await writeGhlOpportunityCustomField(
        ghlOpportunityId,
        process.env.GHL_FIELD_OPP_SR_INSPECTION_ID,
        inspectionId,
      );
      await logGhlSync(leadId, "dispo_write_inspection_id", "ok", undefined, {
        ghlOpportunityId,
        inspectionId,
      });
    } catch (err) {
      await logGhlSync(
        leadId,
        "dispo_write_inspection_id",
        "error",
        err instanceof Error ? err.message : String(err),
        { ghlOpportunityId, inspectionId },
      );
    }
  }

  if (appointmentId && process.env.GHL_FIELD_OPP_SR_APPOINTMENT_ID) {
    try {
      await writeGhlOpportunityCustomField(
        ghlOpportunityId,
        process.env.GHL_FIELD_OPP_SR_APPOINTMENT_ID,
        appointmentId,
      );
      await logGhlSync(leadId, "dispo_write_appointment_id", "ok", undefined, {
        ghlOpportunityId,
        appointmentId,
      });
    } catch (err) {
      await logGhlSync(
        leadId,
        "dispo_write_appointment_id",
        "error",
        err instanceof Error ? err.message : String(err),
        { ghlOpportunityId, appointmentId },
      );
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const {
    outcome,
    inspectionId: bodyInspectionId,
    appointmentId: bodyAppointmentId,
    ...fork
  } = body as {
    outcome: Outcome;
    inspectionId?: string;
    appointmentId?: string;
    [k: string]: unknown;
  };

  if (!VALID_OUTCOMES.has(outcome))
    return NextResponse.json({ error: "Invalid outcome" }, { status: 422 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      inspections: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          appointment: { select: { id: true } },
        },
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ghlId = lead.ghlContactId;
  const oppId = lead.ghlOpportunityId;
  const inspId = bodyInspectionId ?? lead.inspections[0]?.id ?? null;
  const apptId =
    bodyAppointmentId ??
    (lead.inspections[0]?.appointment?.id ?? null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";

  try {
    // ── SOLD ──────────────────────────────────────────────────────────────────
    if (outcome === "sold") {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: { status: "PENDING_SOLD_CONFIRMATION" },
        });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "sold" },
          });
      });

      if (ghlId) {
        try {
          await addGhlTag(ghlId, "sr_sold");
          await logGhlSync(params.id, "dispo_sold_tag", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_sold_tag", "error", err instanceof Error ? err.message : String(err));
        }

        try {
          await updateSrLead(ghlId, { sr_status: "SOLD", sr_bot_stage: "silent" });
          await logGhlSync(params.id, "dispo_sold_sr_update", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_sold_sr_update", "error", err instanceof Error ? err.message : String(err));
        }

        if (oppId) {
          if (process.env.GHL_STAGE_PENDING_SOLD) {
            try {
              await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_PENDING_SOLD);
              await logGhlSync(params.id, "dispo_sold_stage", "ok", undefined, { stage: "PENDING_SOLD" });
            } catch (err) {
              await logGhlSync(params.id, "dispo_sold_stage", "error", err instanceof Error ? err.message : String(err));
            }
          }
          await writeDispoIdsToGhl(params.id, oppId, inspId, apptId);
        }
      }

      await notifyManager(
        `SOLD (pending confirmation) — ${lead.customerName}\n${lead.streetAddress}, ${lead.city}\n${appUrl}/leads/${params.id}`,
      ).catch(() => {});
    }

    // ── DEMO NOT SOLD ─────────────────────────────────────────────────────────
    else if (outcome === "demo_not_sold") {
      if (!fork.dispoPrimaryObjection)
        return NextResponse.json({ error: "Primary objection is required" }, { status: 422 });

      const objection = fork.dispoPrimaryObjection as string;
      const isFinanceDecline = objection === "finance_decline";

      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: "DEMO_NOT_SOLD",
            dispoPrimaryObjection: objection,
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
        if (isFinanceDecline) {
          try {
            await addGhlTag(ghlId, "sr_finance_declined");
            await logGhlSync(params.id, "dispo_dns_finance_tag", "ok");
          } catch (err) {
            await logGhlSync(params.id, "dispo_dns_finance_tag", "error", err instanceof Error ? err.message : String(err));
          }
          try {
            await updateSrLead(ghlId, { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "finance" });
            await logGhlSync(params.id, "dispo_dns_finance_sr", "ok");
          } catch (err) {
            await logGhlSync(params.id, "dispo_dns_finance_sr", "error", err instanceof Error ? err.message : String(err));
          }
          if (oppId && process.env.GHL_STAGE_FINANCE_DISCOVERY) {
            try {
              await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_FINANCE_DISCOVERY);
              await logGhlSync(params.id, "dispo_dns_finance_stage", "ok");
            } catch (err) {
              await logGhlSync(params.id, "dispo_dns_finance_stage", "error", err instanceof Error ? err.message : String(err));
            }
          }
        } else {
          try {
            await addGhlTag(ghlId, "sr_follow_up");
            await logGhlSync(params.id, "dispo_dns_tag", "ok");
          } catch (err) {
            await logGhlSync(params.id, "dispo_dns_tag", "error", err instanceof Error ? err.message : String(err));
          }
          try {
            await updateSrLead(ghlId, { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "revival" });
            await logGhlSync(params.id, "dispo_dns_sr", "ok");
          } catch (err) {
            await logGhlSync(params.id, "dispo_dns_sr", "error", err instanceof Error ? err.message : String(err));
          }
          if (oppId && process.env.GHL_STAGE_DEMO_NOT_SOLD) {
            try {
              await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_DEMO_NOT_SOLD);
              await logGhlSync(params.id, "dispo_dns_stage", "ok");
            } catch (err) {
              await logGhlSync(params.id, "dispo_dns_stage", "error", err instanceof Error ? err.message : String(err));
            }
          }
        }

        if (oppId) await writeDispoIdsToGhl(params.id, oppId, inspId, apptId);
      }
    }

    // ── NO SHOW ───────────────────────────────────────────────────────────────
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
        try {
          await addGhlTag(ghlId, "sr_no_show");
          await logGhlSync(params.id, "dispo_noshow_tag", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_noshow_tag", "error", err instanceof Error ? err.message : String(err));
        }
        try {
          await updateSrLead(ghlId, { sr_status: "NO_SHOW", sr_bot_stage: "revival" });
          await logGhlSync(params.id, "dispo_noshow_sr", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_noshow_sr", "error", err instanceof Error ? err.message : String(err));
        }
        if (oppId) {
          if (process.env.GHL_STAGE_NO_SHOW) {
            try {
              await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_NO_SHOW);
              await logGhlSync(params.id, "dispo_noshow_stage", "ok");
            } catch (err) {
              await logGhlSync(params.id, "dispo_noshow_stage", "error", err instanceof Error ? err.message : String(err));
            }
          }
          await writeDispoIdsToGhl(params.id, oppId, inspId, apptId);
        }
      }
    }

    // ── PORCHED ───────────────────────────────────────────────────────────────
    else if (outcome === "porched") {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: params.id },
          data: {
            status: "NO_SHOW",
            rescheduleReason: "porched",
            dispoNotes: (fork.dispoNotes as string | null) ?? null,
          },
        });
        if (inspId)
          await tx.inspection.update({
            where: { id: inspId },
            data: { outcome: "porched" },
          });
      });

      if (ghlId) {
        try {
          await addGhlTag(ghlId, "sr_porched");
          await logGhlSync(params.id, "dispo_porched_tag", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_porched_tag", "error", err instanceof Error ? err.message : String(err));
        }
        try {
          await updateSrLead(ghlId, { sr_status: "NO_SHOW", sr_bot_stage: "revival" });
          await logGhlSync(params.id, "dispo_porched_sr", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_porched_sr", "error", err instanceof Error ? err.message : String(err));
        }
        if (oppId) {
          if (process.env.GHL_STAGE_FOLLOW_UP_ACTIVE) {
            try {
              await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_FOLLOW_UP_ACTIVE);
              await logGhlSync(params.id, "dispo_porched_stage", "ok");
            } catch (err) {
              await logGhlSync(params.id, "dispo_porched_stage", "error", err instanceof Error ? err.message : String(err));
            }
          }
          await writeDispoIdsToGhl(params.id, oppId, inspId, apptId);
        }
      }
    }

    // ── RESCHEDULE ────────────────────────────────────────────────────────────
    else if (outcome === "reschedule") {
      // path: "manual" | "office"
      const reschedulePath = (fork.reschedulePath as string | null) ?? "office";

      await prisma.lead.update({
        where: { id: params.id },
        data: {
          rescheduleReason: reschedulePath,
          dispoNotes: (fork.dispoNotes as string | null) ?? null,
        },
      });

      if (ghlId) {
        try {
          await addGhlTag(ghlId, "sr_reschedule");
          await logGhlSync(params.id, "dispo_reschedule_tag", "ok");
        } catch (err) {
          await logGhlSync(params.id, "dispo_reschedule_tag", "error", err instanceof Error ? err.message : String(err));
        }

        if (reschedulePath === "office") {
          try {
            await updateSrLead(ghlId, { sr_bot_stage: "reschedule" });
            await logGhlSync(params.id, "dispo_reschedule_office_sr", "ok");
          } catch (err) {
            await logGhlSync(params.id, "dispo_reschedule_office_sr", "error", err instanceof Error ? err.message : String(err));
          }
        }

        if (oppId) {
          if (process.env.GHL_STAGE_RESCHEDULING) {
            try {
              await moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_RESCHEDULING);
              await logGhlSync(params.id, "dispo_reschedule_stage", "ok");
            } catch (err) {
              await logGhlSync(params.id, "dispo_reschedule_stage", "error", err instanceof Error ? err.message : String(err));
            }
          }
          await writeDispoIdsToGhl(params.id, oppId, inspId, apptId);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dispo]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
