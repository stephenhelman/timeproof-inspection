import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { inspectionId, basePrice, nationalPromo, localPromo, fsp, commissionRate, estMonthly } = body;

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bp = basePrice ?? 0;
  const np = nationalPromo ?? false;
  const lp = localPromo ?? false;
  const fspVal = fsp ?? false;
  const cr = commissionRate ?? 0;

  const discountMultiplier =
    (1 - (np ? 0.05 : 0)) *
    (1 - (lp ? 0.1 : 0)) *
    (1 - (fspVal ? 0.1 : 0));
  const nisi = bp * discountMultiplier;
  const commission = nisi * cr;

  const quote = await prisma.quote.upsert({
    where: { inspectionId },
    create: {
      inspectionId,
      basePrice: bp,
      nationalPromo: np,
      localPromo: lp,
      fsp: fspVal,
      commissionRate: cr,
      nisi,
      commission,
      estMonthly: estMonthly ?? null,
    },
    update: {
      basePrice: bp,
      nationalPromo: np,
      localPromo: lp,
      fsp: fspVal,
      commissionRate: cr,
      nisi,
      commission,
      ...(estMonthly !== undefined && { estMonthly }),
    },
  });

  return NextResponse.json(quote);
}
