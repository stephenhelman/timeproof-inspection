import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";

export default async function NewInspectionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const inspection = await prisma.inspection.create({
    data: { userId: session.user.id },
  });

  redirect(`/inspection/${inspection.id}`);
}
