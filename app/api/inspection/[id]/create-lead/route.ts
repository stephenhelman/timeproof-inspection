import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

// Creates a Lead from an inspection's customer info and links it.
// Idempotent — returns existing leadId if the inspection already has one.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inspection = await prisma.inspection.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      leadId: true,
      customerName: true,
      address: true,
      phone: true,
      email: true,
    },
  });

  if (!inspection || inspection.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (inspection.leadId) return NextResponse.json({ leadId: inspection.leadId });

  const customerName = inspection.customerName?.trim();
  if (!customerName) {
    return NextResponse.json(
      { error: "Fill out the customer name in Step 1 before dispos-ing." },
      { status: 422 }
    );
  }

  const lead = await prisma.lead.create({
    data: {
      customerName,
      streetAddress: inspection.address?.trim() ?? "",
      city: "",
      state: "TX",
      zip: "",
      phone: inspection.phone?.trim() ?? null,
      source: "manual",
      status: "NEW",
      assignedUserId: inspection.userId,
    },
  });

  await prisma.inspection.update({
    where: { id: inspection.id },
    data: { leadId: lead.id },
  });

  return NextResponse.json({ leadId: lead.id });
}
