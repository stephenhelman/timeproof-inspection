import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { reportUuid: uuid },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { device, userAgent, sections = [] } = body;

  const visitCount = await prisma.reportVisit.count({
    where: { inspectionId: inspection.id },
  });

  await prisma.reportVisit.create({
    data: {
      inspectionId: inspection.id,
      device: device || null,
      userAgent: userAgent || null,
      visitNumber: visitCount + 1,
      sections: {
        create: sections.map((s: { sectionKey: string; secondsViewed: number }) => ({
          sectionKey: s.sectionKey,
          secondsViewed: s.secondsViewed || 0,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
