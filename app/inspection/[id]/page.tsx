import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import Stepper from "@/src/components/inspection/Stepper";

export default async function InspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      structures: { orderBy: { order: "asc" } },
      photos: { orderBy: { photoNumber: "asc" } },
      quote: true,
      reportVisits: { include: { sections: true } },
      lead: { select: { id: true, customerName: true } },
    },
  });

  if (!inspection || inspection.userId !== session.user.id)
    redirect("/dashboard");

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Stepper inspectionId={id} initialData={inspection as any} lead={inspection.lead} />
  );
}
