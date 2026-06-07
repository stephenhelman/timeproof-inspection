import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

interface EngagementInput {
  photoId: string;
  dwellMs: number;
  slideIndex: number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { reportUuid: uuid },
  });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { engagements } = body as { engagements?: unknown };

  if (!Array.isArray(engagements) || engagements.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Attach to the most recent ReportVisit for this inspection
  const recentVisit = await prisma.reportVisit.findFirst({
    where: { inspectionId: inspection.id },
    orderBy: { visitedAt: "desc" },
  });
  if (!recentVisit) return NextResponse.json({ ok: true });

  // Validate photo IDs belong to this inspection
  const inputPhotoIds = (engagements as EngagementInput[]).map((e) => e.photoId);
  const validPhotos = await prisma.photo.findMany({
    where: { id: { in: inputPhotoIds }, inspectionId: inspection.id },
    select: { id: true },
  });
  const validPhotoIds = new Set(validPhotos.map((p) => p.id));

  const safe = (engagements as EngagementInput[]).filter(
    (e) =>
      validPhotoIds.has(e.photoId) &&
      typeof e.dwellMs === "number" &&
      typeof e.slideIndex === "number" &&
      e.dwellMs > 0,
  );

  if (safe.length > 0) {
    await prisma.photoEngagement.createMany({
      data: safe.map((e) => ({
        reportVisitId: recentVisit.id,
        photoId: e.photoId,
        dwellMs: e.dwellMs,
        slideIndex: e.slideIndex,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
