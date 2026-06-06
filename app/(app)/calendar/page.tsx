import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { hasRank } from "@/src/lib/permissions";
import CalendarView from "./CalendarView";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { date: dateParam } = await searchParams;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // Determine the date to show
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Managers see all reps' appointments; reps see their own
  const isManager = dbUser ? hasRank(dbUser.role, "SALES_MANAGER") : false;

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: dayStart, lte: dayEnd },
      ...(isManager ? {} : { assignedUserId: session.user.id }),
      status: { not: "CANCELLED" },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      lead: {
        select: {
          id: true,
          customerName: true,
          address: true,
          streetAddress: true,
          city: true,
          state: true,
        },
      },
      inspection: { select: { id: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  const serialized = appointments.map((a) => ({
    ...a,
    scheduledAt: a.scheduledAt.toISOString(),
  }));

  return (
    <CalendarView
      appointments={serialized}
      currentDate={dayStart.toISOString()}
      isManager={isManager}
    />
  );
}
