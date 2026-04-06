import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

async function getOwnedStructure(id: string, userId: string) {
  const structure = await prisma.structure.findUnique({
    where: { id },
    include: {
      inspection: true,
      facets: { orderBy: { order: "asc" } },
    },
  });
  if (!structure || structure.inspection.userId !== userId) return null;
  return structure;
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
  const structure = await getOwnedStructure(id, session.user.id);
  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.structure.update({ where: { id }, data: body });
  return NextResponse.json(updated);
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
  const structure = await getOwnedStructure(id, session.user.id);
  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.structure.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
