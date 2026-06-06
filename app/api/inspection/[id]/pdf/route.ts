import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { generateInspectionPDF } from "@/src/lib/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { photoNumber: "asc" } },
    },
  });

  if (!inspection || inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfBuffer = await generateInspectionPDF(inspection);
  const safeName = inspection.customerName?.replace(/[^a-z0-9]/gi, "-") || "inspection";
  const date = new Date(inspection.date).toISOString().split("T")[0];

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inspection-${safeName}-${date}.pdf"`,
    },
  });
}
