import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

async function getOwnedFacet(id: string, userId: string) {
  const facet = await prisma.facet.findUnique({
    where: { id },
    include: { structure: { include: { inspection: true } } },
  });
  if (!facet || facet.structure.inspection.userId !== userId) return null;
  return facet;
}

// PRESERVED — not active in Qntum build (measurement fields removed from schema)
async function recomputeStructureTotals(structureId: string) {
  return prisma.structure.findUnique({
    where: { id: structureId },
    include: { facets: { orderBy: { order: "asc" } } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const facet = await getOwnedFacet(id, session.user.id);
  if (!facet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updatedFacet = await prisma.facet.update({ where: { id }, data: body });

  // Recompute structure totals and return both
  const updatedStructure = await recomputeStructureTotals(facet.structureId);

  return NextResponse.json({ facet: updatedFacet, structure: updatedStructure });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const facet = await getOwnedFacet(id, session.user.id);
  if (!facet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { structureId } = facet;
  await prisma.facet.delete({ where: { id } });

  const updatedStructure = await recomputeStructureTotals(structureId);

  return NextResponse.json({ structure: updatedStructure });
}
