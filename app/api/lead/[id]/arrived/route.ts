import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canEditLead } from "@/src/lib/permissions";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      inspections: {
        where: { status: "scheduled" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditLead(user.id, user.role, lead)) return forbidden();

  const inspection = lead.inspections[0];
  if (!inspection)
    return NextResponse.json(
      { error: "No scheduled inspection found" },
      { status: 400 },
    );
  if (inspection.arrivedAt)
    return NextResponse.json(
      { error: "Already marked arrived" },
      { status: 409 },
    );

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
