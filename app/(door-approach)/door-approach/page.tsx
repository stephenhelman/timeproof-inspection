import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import DoorApproachPage from "@/src/components/door-approach/DoorApproachPage";

export default async function DoorApproachRoute() {
  const session = await auth();
  if (!session?.user) return null;

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { repSlug: true },
  });

  return <DoorApproachPage repSlug={dbUser.repSlug ?? null} />;
}
