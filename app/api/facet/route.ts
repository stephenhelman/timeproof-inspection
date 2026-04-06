import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { structureId, name, order } = await req.json();

  // Verify ownership via structure → inspection
  const structure = await prisma.structure.findUnique({
    where: { id: structureId },
    include: { inspection: true },
  });

  if (!structure || structure.inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const facet = await prisma.facet.create({
    data: { structureId, name: name ?? "Facet", order: order ?? 0 },
  });

  return NextResponse.json({ facet }, { status: 201 });
}
