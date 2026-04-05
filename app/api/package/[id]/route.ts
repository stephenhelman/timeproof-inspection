import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

function calcNisi(basePrice: number, np: boolean, lp: boolean, fsp: boolean) {
  return (
    basePrice *
    (1 - (np ? 0.05 : 0)) *
    (1 - (lp ? 0.1 : 0)) *
    (1 - (fsp ? 0.1 : 0))
  );
}

async function getOwnedPackage(id: string, userId: string) {
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: { inspection: true },
  });
  if (!pkg || pkg.inspection.userId !== userId) return null;
  return pkg;
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
  const pkg = await getOwnedPackage(id, session.user.id);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const basePrice = body.basePrice ?? pkg.basePrice;
  const np = body.nationalPromo ?? pkg.nationalPromo;
  const lp = body.localPromo ?? pkg.localPromo;
  const fsp = body.fsp ?? pkg.fsp;
  const nisi = calcNisi(basePrice, np, lp, fsp);

  // If marking as recommended, clear recommended from all siblings first
  if (body.recommended === true) {
    await prisma.package.updateMany({
      where: { inspectionId: pkg.inspectionId, id: { not: id } },
      data: { recommended: false },
    });
  }

  const updated = await prisma.package.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      basePrice,
      nationalPromo: np,
      localPromo: lp,
      fsp,
      nisi,
      ...(body.recommended !== undefined && { recommended: body.recommended }),
    },
  });

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
  const pkg = await getOwnedPackage(id, session.user.id);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.package.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
