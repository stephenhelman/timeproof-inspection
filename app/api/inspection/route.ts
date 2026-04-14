import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const inspections = await prisma.inspection.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
      quote: true,
      _count: { select: { reportVisits: true } },
    },
  });

  return NextResponse.json(inspections);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { customerName, address, phone, email, heardAboutUs, repName } = body;

  let customerId: string | undefined;

  if (customerName || address) {
    const customer = await prisma.customer.create({
      data: {
        name: customerName || "",
        address: address || "",
        phone: phone || null,
        email: email || null,
        heardAboutUs: heardAboutUs || null,
      },
    });
    customerId = customer.id;
  }

  const inspection = await prisma.inspection.create({
    data: {
      userId: session.user.id,
      customerId: customerId || null,
      repName: repName || null,
    },
    include: {
      customer: true,
      structures: true,
      photos: true,
      packages: { orderBy: { order: "asc" } },
      quote: true,
    },
  });

  return NextResponse.json(inspection, { status: 201 });
}
