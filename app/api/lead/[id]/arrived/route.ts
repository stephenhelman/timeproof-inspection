import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { inspections: { where: { status: "scheduled" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inspection = lead.inspections[0];
  if (!inspection) return NextResponse.json({ error: "No scheduled inspection found" }, { status: 400 });
  if (inspection.arrivedAt) return NextResponse.json({ error: "Already marked arrived" }, { status: 409 });

  const [, updatedLead] = await prisma.$transaction([
    prisma.inspection.update({
      where: { id: inspection.id },
      data: { arrivedAt: new Date() },
    }),
    prisma.lead.update({
      where: { id: params.id },
      data: { status: "INSPECTION_IN_PROGRESS" },
    }),
  ]);

  return NextResponse.json(updatedLead);
}
