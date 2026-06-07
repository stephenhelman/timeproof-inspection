import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import type { TaskType, TaskSource } from "@prisma/client";

const CURATED_OUTCOMES: Record<string, string[]> = {
  SETTER_FOLLOWUP: ["contacted", "no_answer", "not_interested", "appointment_set"],
  REP_FOLLOWUP: ["contacted", "appointment_set", "not_interested", "needs_escalation"],
  FINANCE_REVIEW: ["path_identified", "no_path", "credit_repair_referred"],
  ZIP_REVIEW: ["approved", "rejected", "referred_to_partner"],
  MANUAL_BOOKING: ["booked", "no_answer", "not_interested", "dead"],
  ESCALATION: ["resolved", "escalated_to_manager", "lead_dead"],
};

const VALID_TASK_TYPES = new Set<string>([
  "SETTER_FOLLOWUP",
  "REP_FOLLOWUP",
  "FINANCE_REVIEW",
  "ZIP_REVIEW",
  "MANUAL_BOOKING",
  "ESCALATION",
]);

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ghl-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || body.type !== "TASK_CREATE") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { taskType, ghlUserId, leadId, inspectionId, context } = body as {
    type: string;
    taskType?: string;
    ghlUserId?: string;
    leadId?: string;
    inspectionId?: string;
    context?: string;
  };

  if (!taskType || !VALID_TASK_TYPES.has(taskType)) {
    return NextResponse.json({ error: "Invalid taskType" }, { status: 422 });
  }
  if (!ghlUserId) {
    return NextResponse.json({ error: "ghlUserId is required" }, { status: 422 });
  }
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 422 });
  }
  if (!context) {
    return NextResponse.json({ error: "context is required" }, { status: 422 });
  }

  const assignedUser = await prisma.user.findFirst({
    where: { ghlUserId },
    select: { id: true },
  });

  if (!assignedUser) {
    return NextResponse.json(
      { error: `No user found with ghlUserId: ${ghlUserId}` },
      { status: 404 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (inspectionId) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { id: true },
    });
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }
  }

  const task = await prisma.task.create({
    data: {
      leadId,
      inspectionId: inspectionId ?? null,
      assignedUserId: assignedUser.id,
      type: taskType as TaskType,
      status: "PENDING",
      context,
      availableOutcomes: CURATED_OUTCOMES[taskType] ?? [],
      createdBy: "GHL_WEBHOOK" as TaskSource,
    },
  });

  return NextResponse.json({ ok: true, taskId: task.id });
}
