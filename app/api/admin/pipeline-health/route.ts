import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canAccessManagerViews } from "@/src/lib/permissions";

// Alex manages initial contact: qualifying, nurture, booking stages
const ALEX_STAGES = ["qualifying", "nurture", "booking"];
// Jordan manages post-appointment: revival, reschedule, finance stages
const JORDAN_STAGES = ["revival", "reschedule", "finance"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canAccessManagerViews(user.role)) return forbidden();

  const [
    alexCount,
    jordanCount,
    inspectionOutcomes,
    tasksPending,
    revivalStatuses,
  ] = await Promise.all([
    // Active Alex sequences
    prisma.srLead.count({
      where: { srBotStage: { in: ALEX_STAGES } },
    }),

    // Active Jordan sequences
    prisma.srLead.count({
      where: { srBotStage: { in: JORDAN_STAGES } },
    }),

    // Inspection pipeline stage distribution
    prisma.inspection.groupBy({
      by: ["outcome"],
      _count: { _all: true },
      orderBy: { _count: { outcome: "desc" } },
    }),

    // Pending tasks by type
    prisma.task.groupBy({
      by: ["type"],
      where: { status: "PENDING" },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
    }),

    // Revival pipeline stage distribution (Lead.revivalStatus)
    prisma.lead.groupBy({
      by: ["revivalStatus"],
      where: { revivalStatus: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { revivalStatus: "desc" } },
    }),
  ]);

  return NextResponse.json({
    botSequences: {
      alex: alexCount,
      jordan: jordanCount,
    },
    inspectionStages: inspectionOutcomes.map((r) => ({
      stage: r.outcome ?? "draft",
      count: r._count._all,
    })),
    revivalStages: revivalStatuses.map((r) => ({
      stage: r.revivalStatus ?? "unknown",
      count: r._count._all,
    })),
    tasksPending: tasksPending.map((r) => ({
      type: r.type,
      count: r._count._all,
    })),
  });
}
