import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const where = user?.role === "REP" ? { assignedUserId: session.user.id } : {};

  const [zipsRaw, techsRaw] = await Promise.all([
    prisma.lead.findMany({
      where: { ...where, zip: { not: "" } },
      select: { zip: true },
      distinct: ["zip"],
      orderBy: { zip: "asc" },
    }),
    prisma.lead.findMany({
      where: { ...where, assignedTech: { not: null } },
      select: { assignedTech: true },
      distinct: ["assignedTech"],
      orderBy: { assignedTech: "asc" },
    }),
  ]);

  return NextResponse.json({
    zips: zipsRaw.map((r) => r.zip),
    techs: techsRaw.map((r) => r.assignedTech).filter(Boolean),
  });
}
