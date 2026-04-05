import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

async function getOwnedInspection(id: string, userId: string) {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      customer: true,
      structures: { orderBy: { order: "asc" } },
      photos: { orderBy: { photoNumber: "asc" } },
      quote: true,
      reportVisits: { include: { sections: true } },
    },
  });
  if (!inspection || inspection.userId !== userId) return null;
  return inspection;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const inspection = await getOwnedInspection(id, session.user.id);
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(inspection);
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
  const existing = await getOwnedInspection(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { quote: quoteData, ...inspectionData } = body;

  // Update customer fields if present
  const customerFields = ["customerName", "address", "phone", "email", "heardAboutUs"];
  const hasCustomerData = customerFields.some((f) => f in inspectionData);

  if (hasCustomerData && existing.customerId) {
    const { customerName, address, phone, email, heardAboutUs, ...rest } = inspectionData;
    await prisma.customer.update({
      where: { id: existing.customerId },
      data: {
        ...(customerName !== undefined && { name: customerName }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(heardAboutUs !== undefined && { heardAboutUs }),
      },
    });
    Object.assign(inspectionData, rest);
    delete inspectionData.customerName;
    delete inspectionData.address;
    delete inspectionData.phone;
    delete inspectionData.email;
    delete inspectionData.heardAboutUs;
  } else if (hasCustomerData && !existing.customerId) {
    const { customerName, address, phone, email, heardAboutUs } = inspectionData;
    const customer = await prisma.customer.create({
      data: {
        name: customerName || "",
        address: address || "",
        phone: phone || null,
        email: email || null,
        heardAboutUs: heardAboutUs || null,
      },
    });
    inspectionData.customerId = customer.id;
    delete inspectionData.customerName;
    delete inspectionData.address;
    delete inspectionData.phone;
    delete inspectionData.email;
    delete inspectionData.heardAboutUs;
  }

  // Upsert quote if provided
  if (quoteData) {
    const { basePrice, nationalPromo, localPromo, fsp, commissionRate, estMonthly } = quoteData;
    const bp = basePrice ?? existing.quote?.basePrice ?? 0;
    const np = nationalPromo ?? existing.quote?.nationalPromo ?? false;
    const lp = localPromo ?? existing.quote?.localPromo ?? false;
    const fspVal = fsp ?? existing.quote?.fsp ?? false;
    const cr = commissionRate ?? existing.quote?.commissionRate ?? 0;

    const discountMultiplier =
      (1 - (np ? 0.05 : 0)) *
      (1 - (lp ? 0.1 : 0)) *
      (1 - (fspVal ? 0.1 : 0));
    const nisi = bp * discountMultiplier;
    const commission = nisi * cr;

    await prisma.quote.upsert({
      where: { inspectionId: id },
      create: {
        inspectionId: id,
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
        ...(basePrice !== undefined && { basePrice: bp }),
        ...(nationalPromo !== undefined && { nationalPromo: np }),
        ...(localPromo !== undefined && { localPromo: lp }),
        ...(fsp !== undefined && { fsp: fspVal }),
        ...(commissionRate !== undefined && { commissionRate: cr }),
        nisi,
        commission,
        ...(estMonthly !== undefined && { estMonthly }),
      },
    });
  }

  // Update inspection fields
  const allowedFields = [
    "repName", "status", "ownershipLength", "previousRoofWork", "previousRoofWhen",
    "activeLeaks", "leakLocation", "allDecisionMakers", "priorities", "findings",
    "findingsNotes", "driveFolderId", "driveFolderUrl", "productionNotes", "gateCode",
    "hasPets", "accessIssues", "hoaRestrictions", "hoaDetails", "colorSelected",
    "specialRequests", "followUpNotes", "customerId",
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in inspectionData) updateData[key] = inspectionData[key];
  }

  const updated = await prisma.inspection.update({
    where: { id },
    data: updateData,
    include: {
      customer: true,
      structures: { orderBy: { order: "asc" } },
      photos: { orderBy: { photoNumber: "asc" } },
      quote: true,
      reportVisits: { include: { sections: true } },
    },
  });

  return NextResponse.json(updated);
}
