import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import Stepper from "@/src/components/inspection/Stepper";
import { hasRank } from "@/src/lib/permissions";

export default async function InspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { photoNumber: "asc" } },
      reportVisits: { include: { sections: true } },
      lead: { select: { id: true, customerName: true } },
      appointment: { select: { id: true, status: true } },
    },
  });

  // Managers can view any inspection; reps can only view their own
  const isManager = dbUser ? hasRank(dbUser.role, "SALES_MANAGER") : false;
  if (!inspection || (!isManager && inspection.userId !== session.user.id))
    redirect("/dashboard");

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Stepper
      inspectionId={id}
      initialData={inspection as any}
      lead={inspection.lead}
      appointment={inspection.appointment}
    />
  );
}
