// ── DISPOSITION HANDLER — UNIFIED §8 MODEL (Sprint 7) ────────────────────────
//
// Per ARCHITECTURE §8 ("the unified handoff principle"), the dispo handler's job
// is narrow and the same for every outcome:
//
//   1. RESOLVE the Inspection opportunity (won/lost) — the reporting metric.
//   2. Write sr_dispo_context (the nuance, scoped by destination stage).
//   3. Add a reporting tag (filtering/reporting only — NEVER an activation trigger).
//   4. CREATE the Revival opp at the correct destination STAGE — the SERVER decides
//      the stage (this is where revival-vs-finance branches), GHL is dumb.
//   5. Sync currentPhase + phaseHistory atomically with the stage change (audit #3).
//
// What it deliberately does NOT do (handlers/GHL own these):
//   - It does NOT fire the Jordan activation webhook — GHL fires that on the stage
//     change (Sprint 8). The handler's job ends at "Revival opp placed at correct stage".
//   - It does NOT set Jordan recovery-context (affordabilityIsReal, rescheduleSubCase,
//     primaryObjection seed) — the Jordan handlers DERIVE those at activation from
//     (stage + sr_dispo_context).
//   - It does NOT branch revival-vs-finance anywhere but in the destination STAGE.
//   - It does NOT trigger anything on tags.
//
// The whole routing table lives as DATA (planDispo) and a single generic executor
// runs it — so the handler is simpler, not more complex.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { addGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  resolveGhlOpportunity,
  createGhlOpportunity,
  writeGhlOpportunityCustomField,
  writeGhlContactCustomField,
} from "@/src/lib/ghl-contacts";
import { syncPhaseTransition } from "@/src/lib/conversation";
import { planDispo, VALID_OUTCOMES, type Outcome } from "@/src/lib/bot-v2/dispo-plan";
import { purgePipelineTags } from "@/src/lib/bot-v2/pipeline-tags";

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

// Writes sr_inspection_id and sr_appointment_id to a GHL opportunity. Logs result.
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

  // Resolve the routing plan (ARCHITECTURE §8 table). Validation lives here.
  const plan = planDispo(outcome, fork);
  if ("error" in plan)
    return NextResponse.json({ error: plan.error }, { status: 422 });

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
  const inspectionOppId = lead.ghlOpportunityId; // the Inspection-pipeline opp
  const inspId = bodyInspectionId ?? lead.inspections[0]?.id ?? null;
  const apptId =
    bodyAppointmentId ?? (lead.inspections[0]?.appointment?.id ?? null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";

  try {
    // ── 1. DB writes — atomic (audit #3: phase sync rides the SAME transaction) ──
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: params.id },
        data: {
          ...(plan.leadStatus ? { status: plan.leadStatus } : {}),
          ...plan.leadData,
          srDispoContext: plan.srDispoContext, // durable local mirror of the §8 nuance
        },
      });

      if (inspId && plan.inspectionOutcome) {
        await tx.inspection.update({
          where: { id: inspId },
          data: { outcome: plan.inspectionOutcome },
        });
      }

      // Phase change → mirror srBotStage on the DB SrLead row AND sync the
      // Conversation phase (currentPhase + phaseHistory) atomically, exactly like
      // every other transition (transitionLead). Skipped for Book Now (no phase change).
      if (plan.botStage) {
        await tx.srLead
          .update({
            where: { leadId: params.id },
            data: {
              srBotStage: plan.botStage,
              ...(plan.srStatus ? { srStatus: plan.srStatus } : {}),
              updatedAt: new Date(),
            },
          })
          .catch((e) =>
            console.warn("[dispo] srLead.update failed (may not exist):", e),
          );

        await syncPhaseTransition(tx, ghlId ?? "", plan.botStage, plan.exitSignal, {
          leadId: params.id,
        });
      }
    });

    // ── 2. GHL side-effects (best-effort, logged) ──
    if (ghlId) {
      // 2a. Reporting tag (filtering/reporting ONLY — never an activation trigger).
      if (plan.reportingTag) {
        try {
          await addGhlTag(ghlId, plan.reportingTag);
          await logGhlSync(params.id, `dispo_${outcome}_tag`, "ok", undefined, { tag: plan.reportingTag });
        } catch (err) {
          await logGhlSync(params.id, `dispo_${outcome}_tag`, "error", err instanceof Error ? err.message : String(err));
        }
      }

      // 2b. GHL SrLead custom-object mirror (visibility only; routing reads the DB).
      if (plan.botStage) {
        try {
          await updateSrLead(ghlId, {
            sr_bot_stage: plan.botStage as never,
            ...(plan.srStatus ? { sr_status: plan.srStatus as never } : {}),
          });
          await logGhlSync(params.id, `dispo_${outcome}_sr`, "ok");
        } catch (err) {
          await logGhlSync(params.id, `dispo_${outcome}_sr`, "error", err instanceof Error ? err.message : String(err));
        }
      }

      // 2c. sr_dispo_context contact field (the durable raw nuance, §8). Guarded
      // on the field id — created GHL-side in Sprint 8; until then the durable
      // mirror is Lead.srDispoContext (written above).
      if (plan.srDispoContext && process.env.GHL_FIELD_SR_DISPO_CONTEXT) {
        try {
          await writeGhlContactCustomField(ghlId, process.env.GHL_FIELD_SR_DISPO_CONTEXT, plan.srDispoContext);
          await logGhlSync(params.id, `dispo_${outcome}_context`, "ok", undefined, { srDispoContext: plan.srDispoContext });
        } catch (err) {
          await logGhlSync(params.id, `dispo_${outcome}_context`, "error", err instanceof Error ? err.message : String(err));
        }
      }

      // 2d. RESOLVE the Inspection opp (won/lost) — the reporting metric.
      if (inspectionOppId && plan.inspectionResolveStage && plan.inspectionStatus) {
        try {
          await resolveGhlOpportunity(inspectionOppId, plan.inspectionResolveStage, plan.inspectionStatus);
          await logGhlSync(params.id, `dispo_${outcome}_resolve_inspection`, "ok", undefined, { status: plan.inspectionStatus });
        } catch (err) {
          await logGhlSync(params.id, `dispo_${outcome}_resolve_inspection`, "error", err instanceof Error ? err.message : String(err));
        }
      }

      // 2d-bis. PURGE the LEFT (Inspection) pipeline's tag set (§12 Pattern B).
      // Order is resolve → purge → create: after resolve (so won/lost is recorded)
      // and before create (so the new Revival pipeline never inherits Inspection
      // working tags). Critically this strips the stale `sr_appointment_set` so the
      // Booking Pending early-exit guard stays truthful when this lead later rebooks.
      if (plan.purgePipeline) {
        const purged = await purgePipelineTags(ghlId, plan.purgePipeline);
        await logGhlSync(params.id, `dispo_${outcome}_purge`, "ok", undefined, {
          pipeline: plan.purgePipeline,
          tags: [...purged],
        });
      }

      // 2e. CREATE the Revival opp at the destination STAGE (the §8 handoff).
      // SPRINT 8: GHL fires the Jordan activation webhook on THIS stage change.
      if (plan.revivalStage && process.env.GHL_PIPELINE_REVIVAL) {
        try {
          const revivalOppId = await createGhlOpportunity({
            ghlContactId: ghlId,
            contactName: lead.customerName ?? "Homeowner",
            pipelineId: process.env.GHL_PIPELINE_REVIVAL,
            pipelineStageId: plan.revivalStage,
            sourceName: plan.revivalSourceName,
          });
          // The Revival opp is now the active opp Jordan works (REBOOKED stage
          // moves, etc.); point the lead at it. The Inspection opp is resolved.
          await prisma.lead.update({
            where: { id: params.id },
            data: { ghlOpportunityId: revivalOppId },
          });
          await writeDispoIdsToGhl(params.id, revivalOppId, inspId, apptId);
          await logGhlSync(params.id, `dispo_${outcome}_create_revival`, "ok", undefined, {
            revivalOppId,
            stage: plan.revivalStage,
          });
        } catch (err) {
          await logGhlSync(params.id, `dispo_${outcome}_create_revival`, "error", err instanceof Error ? err.message : String(err));
        }
      } else if (inspectionOppId && !plan.revivalStage) {
        // No Revival opp (e.g. SOLD): keep the dispo ids on the Inspection opp.
        await writeDispoIdsToGhl(params.id, inspectionOppId, inspId, apptId);
      }
    }

    // ── 3. Manager notification (SOLD pending confirmation) ──
    if (plan.managerNotify) {
      await notifyManager(
        `SOLD (pending confirmation) — ${lead.customerName}\n${lead.streetAddress}, ${lead.city}\n${appUrl}/leads/${params.id}`,
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dispo]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
