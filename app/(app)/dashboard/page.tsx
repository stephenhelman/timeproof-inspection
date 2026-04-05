import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import StatsBar from "@/src/components/dashboard/StatsBar";
import InspectionCard from "@/src/components/dashboard/InspectionCard";
import NewInspectionButton from "@/src/components/dashboard/NewInspectionButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [inspections, allVisits] = await Promise.all([
    prisma.inspection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: true,
        structures: true,
        quote: true,
        reportVisits: { orderBy: { visitedAt: "asc" } },
      },
    }),
    prisma.reportVisit.findMany({
      where: { inspection: { userId } },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = inspections.filter((i) => new Date(i.createdAt) >= monthStart).length;
  const totalViews = allVisits.length;
  const avgViews = inspections.length > 0 ? totalViews / inspections.length : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-text-primary text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-text-secondary text-base mt-1">Manage your roof inspections</p>
        </div>
        <NewInspectionButton />
      </div>

      <StatsBar
        total={inspections.length}
        thisMonth={thisMonth}
        totalViews={totalViews}
        avgViews={avgViews}
      />

      <div className="flex flex-col gap-4">
        <h2 className="text-text-secondary text-sm font-semibold uppercase tracking-wider">
          Inspections
        </h2>
        {inspections.length === 0 ? (
          <div className="text-center py-20 bg-bg-surface border border-border rounded-2xl">
            <p className="text-text-secondary text-xl font-medium">No inspections yet</p>
            <p className="text-text-hint text-base mt-2">Tap &quot;+ New Inspection&quot; to get started.</p>
          </div>
        ) : (
          inspections.map((inspection) => (
            <InspectionCard key={inspection.id} inspection={inspection} />
          ))
        )}
      </div>
    </div>
  );
}
