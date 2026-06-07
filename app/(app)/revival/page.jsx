import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { canAccessManagerViews } from "@/src/lib/permissions";
import RevivalQueue from "./RevivalQueue";

// Jordan's active bot stages
const JORDAN_STAGES = ["revival", "reschedule", "finance"];

export default async function RevivalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!dbUser || !canAccessManagerViews(dbUser.role)) redirect("/dashboard");

  // Leads currently in Jordan's active sequences
  const srLeads = await prisma.srLead.findMany({
    where: { srBotStage: { in: JORDAN_STAGES } },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          streetAddress: true,
          city: true,
          state: true,
          phone: true,
          status: true,
          dispoPrimaryObjection: true,
          revivalStatus: true,
          ghlContactId: true,
          inspections: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              outcome: true,
              appointment: {
                select: { scheduledAt: true },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  // Fetch bot context summaries from BotThread in parallel
  const ghlContactIds = srLeads
    .map((s) => s.lead?.ghlContactId)
    .filter(Boolean);

  const botThreads = await prisma.botThread.findMany({
    where: {
      ghlContactId: { in: ghlContactIds },
      botType: { in: ["revival", "reschedule", "finance"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { ghlContactId: true, metadata: true, botType: true, updatedAt: true },
  });

  // Build a map from ghlContactId → latest bot summary
  const botSummaryMap = {};
  for (const t of botThreads) {
    if (!botSummaryMap[t.ghlContactId]) {
      const meta = t.metadata;
      botSummaryMap[t.ghlContactId] = (meta?.summary) ?? null;
    }
  }

  const rows = srLeads
    .filter((s) => s.lead)
    .map((s) => {
      const lead = s.lead;
      const latestInspection = lead.inspections[0] ?? null;
      const scheduledAt = latestInspection?.appointment?.scheduledAt ?? null;
      const daysSince = scheduledAt
        ? Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 86_400_000)
        : null;

      return {
        leadId: lead.id,
        customerName: lead.customerName,
        streetAddress: lead.streetAddress,
        city: lead.city,
        state: lead.state,
        phone: lead.phone,
        leadStatus: lead.status,
        dispoPrimaryObjection: lead.dispoPrimaryObjection,
        revivalStatus: lead.revivalStatus,
        botStage: s.srBotStage,
        botContextSummary: lead.ghlContactId ? (botSummaryMap[lead.ghlContactId] ?? null) : null,
        daysSince,
        inspectionId: latestInspection?.id ?? null,
        inspectionOutcome: latestInspection?.outcome ?? null,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      };
    });

  return <RevivalQueue rows={rows} />;
}
