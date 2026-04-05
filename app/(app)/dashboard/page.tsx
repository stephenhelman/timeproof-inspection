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
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <NewInspectionButton />
      </div>

      <StatsBar
        total={inspections.length}
        thisMonth={thisMonth}
        totalViews={totalViews}
        avgViews={avgViews}
      />

      <div className="flex flex-col gap-4">
        {inspections.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No inspections yet.</p>
            <p className="text-sm mt-1">Tap &quot;+ New Inspection&quot; to get started.</p>
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
